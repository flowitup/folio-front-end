/**
 * Size budget for one import request.
 *
 * The import dialogs send each request through a Next server action, whose
 * request body is capped by `serverActions.bodySizeLimit` (1 MB by default;
 * next.config.ts does not raise it). A body over the cap is refused by Next
 * before it reaches the API, so requests are sized well under it: the
 * serialized action arguments add some overhead to the plain JSON measured
 * here (escaping, the action envelope).
 */

export const MAX_ACTION_PAYLOAD_BYTES = 512 * 1024;

const encoder = new TextEncoder();

/** UTF-8 length of the JSON text of `value`. */
export function jsonByteLength(value: unknown): number {
  return encoder.encode(JSON.stringify(value)).length;
}
