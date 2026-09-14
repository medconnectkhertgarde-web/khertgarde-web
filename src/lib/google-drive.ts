const GOOGLE_DRIVE_ID_PATTERN = /^[a-zA-Z0-9_-]{10,}$/;

export function extractGoogleDriveFileId(value: string | null | undefined): string | null {
  const input = value?.trim();
  if (!input) return null;

  if (GOOGLE_DRIVE_ID_PATTERN.test(input)) return input;

  try {
    const url = new URL(input);

    const fileMatch = url.pathname.match(/\/file\/d\/([^/]+)/);
    if (fileMatch?.[1] && GOOGLE_DRIVE_ID_PATTERN.test(fileMatch[1])) {
      return fileMatch[1];
    }

    const id = url.searchParams.get("id");
    if (id && GOOGLE_DRIVE_ID_PATTERN.test(id)) return id;
  } catch {
    return null;
  }

  return null;
}

export function getGoogleDriveUrls(value: string | null | undefined) {
  const fileId = extractGoogleDriveFileId(value);
  if (!fileId) return null;

  const encodedId = encodeURIComponent(fileId);

  return {
    fileId,
    preview: `https://drive.google.com/file/d/${encodedId}/preview`,
    view: `https://drive.google.com/file/d/${encodedId}/view`,
    download: `https://drive.usercontent.google.com/download?id=${encodedId}&export=download`,
  };
}
