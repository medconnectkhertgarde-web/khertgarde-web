const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3/files";
const GOOGLE_FOLDER_MIME = "application/vnd.google-apps.folder";
const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";
const GOOGLE_SHEET_MIME = "application/vnd.google-apps.spreadsheet";
const GOOGLE_SLIDES_MIME = "application/vnd.google-apps.presentation";

const DRIVE_REQUEST_TIMEOUT_MS = 4500;
const DRIVE_REQUEST_ATTEMPTS = 2;
const DRIVE_MAX_CONCURRENT_REQUESTS = 4;
const MEMORY_CACHE_FRESH_MS = 30_000;
const MEMORY_CACHE_STALE_MS = 15 * 60_000;

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  createdTime?: string;
  modifiedTime?: string;
  description?: string;
  resourceKey?: string;
  webViewLink?: string;
  webContentLink?: string;
}

interface DriveListResponse {
  nextPageToken?: string;
  files?: DriveFile[];
  error?: {
    message?: string;
  };
}

interface FolderReference {
  id: string;
  resourceKey?: string;
}

interface PublicStudy {
  id: string;
  title: string;
  summary: string;
  category: string;
  published_at: string | null;
  filename: string;
  mime_type: string;
  preview_url: string;
  view_url: string;
  download_url: string | null;
}

interface CachedStudies {
  studies: PublicStudy[];
  syncedAt: string;
  cachedAt: number;
}

class DriveRequestError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "DriveRequestError";
    this.status = status;
  }
}

class Semaphore {
  private active = 0;
  private readonly queue: Array<() => void> = [];

  constructor(private readonly limit: number) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }

    this.active += 1;

    try {
      return await task();
    } finally {
      this.active -= 1;
      this.queue.shift()?.();
    }
  }
}

let memoryCache: CachedStudies | null = null;

function ensureStudiesEnvironmentLoaded() {
  if (
    process.env.GOOGLE_DRIVE_API_KEY?.trim() &&
    process.env.GOOGLE_DRIVE_FOLDER_URL?.trim()
  ) {
    return;
  }

  // Vercel normally injects environment variables into functions. On local
  // Windows development, the CLI can occasionally start the function worker
  // without forwarding .env.local. Node 22 can load the file directly, so use
  // that only as a local fallback. In production these files are absent and
  // normal Vercel environment variables remain the source of truth.
  const runtimeProcess = process as typeof process & {
    loadEnvFile?: (path?: string) => void;
  };

  if (typeof runtimeProcess.loadEnvFile !== "function") return;

  const candidates = [
    ".env.local",
    ".env.development.local",
    ".vercel/.env.development.local",
  ];

  for (const candidate of candidates) {
    if (
      process.env.GOOGLE_DRIVE_API_KEY?.trim() &&
      process.env.GOOGLE_DRIVE_FOLDER_URL?.trim()
    ) {
      break;
    }

    try {
      runtimeProcess.loadEnvFile(candidate);
    } catch {
      // Missing local env files are expected in production and are harmless.
    }
  }
}

function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");

  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
}

function parseFolderReference(input: string | undefined): FolderReference | null {
  const raw = input?.trim();
  if (!raw) return null;

  if (/^[A-Za-z0-9_-]{10,}$/.test(raw)) {
    return { id: raw };
  }

  try {
    const url = new URL(raw);
    const pathMatch = url.pathname.match(/\/folders\/([A-Za-z0-9_-]+)/);
    const id = pathMatch?.[1] ?? url.searchParams.get("id") ?? undefined;

    if (!id || !/^[A-Za-z0-9_-]{10,}$/.test(id)) return null;

    return {
      id,
      resourceKey: url.searchParams.get("resourcekey") ?? undefined,
    };
  } catch {
    return null;
  }
}

function titleFromFilename(filename: string) {
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/\s*\(\d+\)\s*$/, "")
    .replace(/_+/g, " ")
    .replace(/\bclinical\s+study\s+guide\b/gi, "")
    .replace(/\bclinical\s+study\b/gi, "")
    .replace(/\bstudy\s+guide\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDescription(description: string | undefined) {
  const value = description?.trim();
  if (!value) return { category: "", summary: "" };

  let category = "";
  let summary = "";
  const leftover: string[] = [];

  for (const line of value.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const categoryMatch = trimmed.match(/^category\s*:\s*(.+)$/i);
    if (categoryMatch?.[1]) {
      category = categoryMatch[1].trim();
      continue;
    }

    const summaryMatch = trimmed.match(/^summary\s*:\s*(.+)$/i);
    if (summaryMatch?.[1]) {
      summary = summaryMatch[1].trim();
      continue;
    }

    leftover.push(trimmed);
  }

  if (!summary && leftover.length > 0) summary = leftover.join(" ");
  return { category, summary };
}

function inferCategory(filename: string) {
  const name = filename.toLowerCase();

  if (/pediatric|paediatric/.test(name)) return "Pediatrics";
  if (/liver cancer|colon cancer|colorectal|oncology|cancer/.test(name)) return "Oncology";
  if (/chronic kidney|acute kidney|kidney disease|renal|nephro/.test(name)) return "Nephrology";
  if (/diabetic ketoacidosis|\bdka\b|endocrin/.test(name)) return "Endocrinology";
  if (/stroke|cerebrovascular|neurolog/.test(name)) return "Neurology";
  if (/sepsis|septic shock|critical care|shock/.test(name)) return "Critical Care";
  if (/measles|dengue|infectious|infection/.test(name)) return "Infectious Disease";

  return "Clinical Study";
}

function appendResourceKey(urlString: string, resourceKey: string | undefined) {
  if (!resourceKey) return urlString;

  const url = new URL(urlString);
  if (!url.searchParams.has("resourcekey")) {
    url.searchParams.set("resourcekey", resourceKey);
  }
  return url.toString();
}

function previewUrl(file: DriveFile) {
  const id = encodeURIComponent(file.id);
  let url: string;

  switch (file.mimeType) {
    case GOOGLE_DOC_MIME:
      url = `https://docs.google.com/document/d/${id}/preview`;
      break;
    case GOOGLE_SHEET_MIME:
      url = `https://docs.google.com/spreadsheets/d/${id}/preview`;
      break;
    case GOOGLE_SLIDES_MIME:
      url = `https://docs.google.com/presentation/d/${id}/preview`;
      break;
    default:
      url = `https://drive.google.com/file/d/${id}/preview`;
  }

  return appendResourceKey(url, file.resourceKey);
}

function viewUrl(file: DriveFile) {
  if (file.webViewLink) return file.webViewLink;
  return appendResourceKey(
    `https://drive.google.com/file/d/${encodeURIComponent(file.id)}/view`,
    file.resourceKey,
  );
}

function downloadUrl(file: DriveFile): string | null {
  if (file.webContentLink) return file.webContentLink;

  const id = encodeURIComponent(file.id);
  let url: string;

  switch (file.mimeType) {
    case GOOGLE_DOC_MIME:
      url = `https://docs.google.com/document/d/${id}/export?format=pdf`;
      break;
    case GOOGLE_SHEET_MIME:
      url = `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`;
      break;
    case GOOGLE_SLIDES_MIME:
      url = `https://docs.google.com/presentation/d/${id}/export?format=pdf`;
      break;
    default:
      url = `https://drive.usercontent.google.com/download?id=${id}&export=download`;
  }

  return appendResourceKey(url, file.resourceKey);
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function shouldRetryDriveError(error: unknown) {
  if (error instanceof DriveRequestError) {
    return error.status === 429 || (typeof error.status === "number" && error.status >= 500);
  }

  if (error instanceof Error) {
    return error.name === "AbortError" || /fetch|network|socket|timeout|econnreset|epipe/i.test(error.message);
  }

  return false;
}

async function fetchDrivePage(
  url: string,
  headers: Headers,
  semaphore: Semaphore,
): Promise<DriveListResponse> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= DRIVE_REQUEST_ATTEMPTS; attempt += 1) {
    try {
      return await semaphore.run(async () => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), DRIVE_REQUEST_TIMEOUT_MS);

        try {
          const response = await fetch(url, {
            headers,
            signal: controller.signal,
          });

          const payload = (await response.json()) as DriveListResponse;

          if (!response.ok) {
            const reason =
              payload.error?.message || `Google Drive API returned HTTP ${response.status}`;
            throw new DriveRequestError(reason, response.status);
          }

          return payload;
        } finally {
          clearTimeout(timer);
        }
      });
    } catch (error) {
      lastError = error;

      if (attempt >= DRIVE_REQUEST_ATTEMPTS || !shouldRetryDriveError(error)) {
        throw error;
      }

      await delay(200 * attempt);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Google Drive request failed");
}

async function listFolder(
  folder: FolderReference,
  apiKey: string,
  semaphore: Semaphore,
  depth = 0,
  seen = new Set<string>(),
): Promise<DriveFile[]> {
  if (seen.has(folder.id)) return [];
  seen.add(folder.id);

  const entries: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      key: apiKey,
      q: `'${folder.id}' in parents and trashed = false`,
      fields:
        "nextPageToken,files(id,name,mimeType,createdTime,modifiedTime,description,resourceKey,webViewLink,webContentLink)",
      pageSize: "1000",
      orderBy: "createdTime desc",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });

    if (pageToken) params.set("pageToken", pageToken);

    const headers = new Headers({ Accept: "application/json" });
    if (folder.resourceKey) {
      headers.set("X-Goog-Drive-Resource-Keys", `${folder.id}/${folder.resourceKey}`);
    }

    const payload = await fetchDrivePage(
      `${DRIVE_API_BASE}?${params.toString()}`,
      headers,
      semaphore,
    );

    entries.push(...(payload.files ?? []));
    pageToken = payload.nextPageToken;
  } while (pageToken);

  const files: DriveFile[] = [];
  const subfolders: FolderReference[] = [];

  for (const file of entries) {
    if (!file.id || !file.name || !file.mimeType) continue;

    if (file.mimeType === GOOGLE_FOLDER_MIME) {
      if (depth < 3) {
        subfolders.push({ id: file.id, resourceKey: file.resourceKey });
      }
      continue;
    }

    if (file.name.startsWith(".") || file.name === "Thumbs.db" || file.name === "desktop.ini") {
      continue;
    }

    files.push(file);
  }

  // Scan sibling subfolders concurrently, while the shared semaphore keeps the
  // total number of simultaneous Drive API requests bounded.
  const nestedGroups = await Promise.all(
    subfolders.map(async (subfolder) => {
      try {
        return await listFolder(subfolder, apiKey, semaphore, depth + 1, seen);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown nested-folder error";
        console.warn(`Skipping an unavailable Google Drive subfolder (${subfolder.id}):`, message);
        return [];
      }
    }),
  );

  for (const nested of nestedGroups) files.push(...nested);
  return files;
}

function toPublicStudy(file: DriveFile): PublicStudy {
  const metadata = parseDescription(file.description);
  const title = titleFromFilename(file.name) || file.name;

  return {
    id: file.id,
    title,
    summary: metadata.summary,
    category: metadata.category || inferCategory(file.name),
    published_at: file.createdTime ?? file.modifiedTime ?? null,
    filename: file.name,
    mime_type: file.mimeType,
    preview_url: previewUrl(file),
    view_url: viewUrl(file),
    download_url: downloadUrl(file),
  };
}

function sortStudies(files: DriveFile[]) {
  return files
    .map(toPublicStudy)
    .sort((a, b) => {
      const left = a.published_at ? Date.parse(a.published_at) : 0;
      const right = b.published_at ? Date.parse(b.published_at) : 0;
      return right - left || a.title.localeCompare(b.title);
    });
}

function successResponse(cache: CachedStudies, cacheState: "fresh" | "refreshed" | "stale") {
  return json(
    {
      studies: cache.studies,
      synced_at: cache.syncedAt,
      cache: cacheState,
    },
    {
      status: 200,
      headers: {
        // Visitors get a fast cached response. Vercel may serve the previous successful
        // response while it refreshes in the background, keeping Drive hiccups invisible.
        "Cache-Control": "public, max-age=0, s-maxage=45, stale-while-revalidate=600",
      },
    },
  );
}

export async function GET() {
  ensureStudiesEnvironmentLoaded();

  const apiKey = process.env.GOOGLE_DRIVE_API_KEY?.trim();
  const folderUrl = process.env.GOOGLE_DRIVE_FOLDER_URL?.trim();
  const folder = parseFolderReference(folderUrl);

  if (!apiKey || !folder) {
    const missing = [
      !apiKey ? "GOOGLE_DRIVE_API_KEY" : null,
      !folderUrl ? "GOOGLE_DRIVE_FOLDER_URL" : null,
      folderUrl && !folder ? "GOOGLE_DRIVE_FOLDER_URL (invalid folder URL or ID)" : null,
    ].filter(Boolean);

    return json(
      {
        error:
          "Google Drive studies are not configured for this runtime. Configure the missing values in Vercel Development or .env.local.",
        missing,
      },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  const now = Date.now();

  if (memoryCache && now - memoryCache.cachedAt < MEMORY_CACHE_FRESH_MS) {
    return successResponse(memoryCache, "fresh");
  }

  try {
    const semaphore = new Semaphore(DRIVE_MAX_CONCURRENT_REQUESTS);
    const files = await listFolder(folder, apiKey, semaphore);
    const studies = sortStudies(files);
    const syncedAt = new Date().toISOString();

    memoryCache = {
      studies,
      syncedAt,
      cachedAt: Date.now(),
    };

    return successResponse(memoryCache, "refreshed");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Google Drive error";
    console.error("Unable to list the public Google Drive studies folder:", message);

    // If this warm function has a recent successful result, prefer that over blanking the
    // entire studies section during a temporary Google/network problem.
    if (memoryCache && now - memoryCache.cachedAt < MEMORY_CACHE_STALE_MS) {
      return successResponse(memoryCache, "stale");
    }

    return json(
      {
        error:
          "Clinical studies could not be loaded from Google Drive. Confirm the folder is shared as Anyone with the link, the Drive API is enabled, and the API key is valid.",
      },
      {
        status: 502,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
