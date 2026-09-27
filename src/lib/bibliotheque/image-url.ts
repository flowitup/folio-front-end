/**
 * Library product image from a supplier link — client-side helpers.
 *
 * The server fetches the image (supplier CDNs are hotlink-protected) and only
 * accepts HTTPS links on its supplier allowlist. These helpers catch an
 * obviously wrong link before the round-trip and turn the BE error code into
 * the key of a translated message under `bibliotheque.imageUrl.errors`.
 */

export type ImageUrlErrorKey =
  | "invalid"
  | "blocked"
  | "notImage"
  | "tooLarge"
  | "forbidden"
  | "failed";

/** True for a parseable absolute https:// URL — the only scheme the BE fetches. */
export function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value.trim()).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Map the BE error code of POST /bibliotheque/products/<id>/image-from-url to
 * a message key. Anything unrecognised — including the 500 the BE returns when
 * the supplier's server errors or times out — means the download failed.
 */
export function imageUrlErrorKey(code?: string): ImageUrlErrorKey {
  switch (code) {
    case "ValidationError":
      return "invalid";
    case "SsrfBlocked":
      return "blocked";
    case "UnsupportedMediaType":
      return "notImage";
    case "FileTooLarge":
      return "tooLarge";
    case "Forbidden":
      return "forbidden";
    default:
      return "failed";
  }
}
