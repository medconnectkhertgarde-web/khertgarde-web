const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3/files";
const GOOGLE_FOLDER_MIME = "application/vnd.google-apps.folder";
const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";
const GOOGLE_SHEET_MIME = "application/vnd.google-apps.spreadsheet";
const GOOGLE_SLIDES_MIME = "application/vnd.google-apps.presentation";

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

  // Allow a raw folder ID too, even though the intended configuration is a full folder URL.
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
  let url: string | null = null;

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

async function listFolder(
  folder: FolderReference,
  apiKey: string,
  depth = 0,
  seen = new Set<string>(),
): Promise<DriveFile[]> {
  if (seen.has(folder.id)) return [];
  seen.add(folder.id);

  const output: DriveFile[] = [];
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

    const response = await fetch(`${DRIVE_API_BASE}?${params.toString()}`, { headers });
    const payload = (await response.json()) as DriveListResponse;

    if (!response.ok) {
      const reason = payload.error?.message || `Google Drive API returned HTTP ${response.status}`;
      throw new Error(reason);
    }

    const files = payload.files ?? [];

    for (const file of files) {
      if (!file.id || !file.name || !file.mimeType) continue;

      if (file.mimeType === GOOGLE_FOLDER_MIME) {
        // Automatically include studies organized into category subfolders, up to 3 levels deep.
        if (depth < 3) {
          const nested = await listFolder(
            { id: file.id, resourceKey: file.resourceKey },
            apiKey,
            depth + 1,
            seen,
          );
          output.push(...nested);
        }
        continue;
      }

      // Ignore obvious hidden/system artifacts while keeping all real Drive-viewable study files.
      if (file.name.startsWith(".") || file.name === "Thumbs.db" || file.name === "desktop.ini") continue;
      output.push(file);
    }

    pageToken = payload.nextPageToken;
  } while (pageToken);

  return output;
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

export async function GET() {
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY?.trim();
  const folder = parseFolderReference(process.env.GOOGLE_DRIVE_FOLDER_URL);

  if (!apiKey || !folder) {
    return json(
      {
        error:
          "Google Drive studies are not configured. Set GOOGLE_DRIVE_API_KEY and GOOGLE_DRIVE_FOLDER_URL in Vercel.",
      },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  try {
    const files = await listFolder(folder, apiKey);
    const studies = files
      .map(toPublicStudy)
      .sort((a, b) => {
        const left = a.published_at ? Date.parse(a.published_at) : 0;
        const right = b.published_at ? Date.parse(b.published_at) : 0;
        return right - left || a.title.localeCompare(b.title);
      });

    return json(
      {
        studies,
        synced_at: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          // The portfolio refreshes automatically while avoiding a Drive API request on every page view.
          // New uploads become visible after the short CDN cache window expires.
          "Cache-Control": "public, s-maxage=30",
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Google Drive error";
    console.error("Unable to list the public Google Drive studies folder:", message);

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
