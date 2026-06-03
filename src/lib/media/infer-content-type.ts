/**
 * Infer a concrete media MIME type from a file's extension when the browser
 * reports an empty or generic type. Some files (e.g. videos saved from
 * messaging apps, or AirDropped clips) arrive with `file.type === ""` or
 * `application/octet-stream`; uploading them as-is makes the backend reject
 * the part (415) and, worse, persists a non-video content_type so the gallery
 * can't tell it's a video. Normalising here keeps the stored content_type
 * correct end-to-end.
 */

const EXT_TO_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
};

const GENERIC_TYPES = new Set(["", "application/octet-stream"]);

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

/** Best-effort concrete MIME for a file, falling back to extension mapping. */
export function inferContentType(file: File): string {
  if (!GENERIC_TYPES.has(file.type)) return file.type;
  return EXT_TO_MIME[extensionOf(file.name)] ?? file.type;
}

/**
 * Return the file unchanged when its type is already concrete, otherwise a copy
 * re-tagged with the extension-inferred MIME so the upload part carries it.
 */
export function withInferredContentType(file: File): File {
  if (!GENERIC_TYPES.has(file.type)) return file;
  const inferred = EXT_TO_MIME[extensionOf(file.name)];
  if (!inferred) return file;
  return new File([file], file.name, { type: inferred, lastModified: file.lastModified });
}
