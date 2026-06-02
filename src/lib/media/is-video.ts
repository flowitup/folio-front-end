/**
 * Pure media-kind helper, safe to import from both server and client
 * components (no next/headers or server-only deps — unlike project-photos.ts).
 */
export function isVideo(contentType: string | null | undefined): boolean {
  return !!contentType && contentType.startsWith("video/");
}
