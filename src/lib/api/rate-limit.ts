/**
 * Reading an API 429 and telling the user how long to wait.
 *
 * Every limiter 429 from the API carries a `Retry-After` header (exposed
 * through CORS) and a `retry_after` field in its JSON body. Screens used to
 * answer a 429 with "réessayez" and no time, or a generic failure, so users
 * retried at once (and failed again) or thought the feature was broken.
 */

/** Seconds from a Retry-After header value (delta-seconds or an HTTP date). */
export function parseRetryAfter(value: string | null | undefined): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return seconds > 0 ? Math.ceil(seconds) : null;
  const date = Date.parse(value);
  if (Number.isNaN(date)) return null;
  const delta = Math.ceil((date - Date.now()) / 1000);
  return delta > 0 ? delta : null;
}

function retryAfterFromBody(body: unknown): number | null {
  if (!body || typeof body !== "object") return null;
  const raw = (body as { retry_after?: unknown; retryAfter?: unknown }).retry_after ??
    (body as { retryAfter?: unknown }).retryAfter;
  const seconds = typeof raw === "string" ? Number(raw) : raw;
  return typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0
    ? Math.ceil(seconds)
    : null;
}

/** Seconds to wait for a 429 `response` (header first, then the JSON body if given). */
export function retryAfterOfResponse(response: Response, body?: unknown): number | null {
  return parseRetryAfter(response.headers.get("Retry-After")) ?? retryAfterFromBody(body);
}

/**
 * Seconds to wait carried by an error (an ApiError's `retryAfter`, or the
 * `retry_after` of its data), or null when unknown.
 */
export function retryAfterOf(err: unknown): number | null {
  if (!err || typeof err !== "object") return null;
  const direct = (err as { retryAfter?: unknown }).retryAfter;
  if (typeof direct === "number" && Number.isFinite(direct) && direct > 0) return Math.ceil(direct);
  return (
    retryAfterFromBody((err as { data?: unknown }).data) ??
    retryAfterFromBody((err as { body?: unknown }).body)
  );
}

/** True when `err` is (or wraps) an HTTP 429. */
export function isRateLimitError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const status = (err as { status?: unknown }).status;
  return status === 429;
}

type CommonTranslator = (key: string, values?: Record<string, string | number>) => string;

/**
 * The localized "too many requests" sentence for a wait of `seconds`, from a
 * translator bound to the `common` namespace (useTranslations("common") or
 * getTranslations("common")).
 */
export function rateLimitMessage(tCommon: CommonTranslator, seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return tCommon("rateLimit.unknown");
  if (seconds < 90) return tCommon("rateLimit.seconds", { seconds: Math.ceil(seconds) });
  return tCommon("rateLimit.minutes", { minutes: Math.ceil(seconds / 60) });
}

/**
 * The localized wait sentence when `err` is a 429, else null — for catch
 * blocks: `setError(rateLimitErrorMessage(err, tCommon) ?? t("saveFailed"))`.
 */
export function rateLimitErrorMessage(err: unknown, tCommon: CommonTranslator): string | null {
  return isRateLimitError(err) ? rateLimitMessage(tCommon, retryAfterOf(err)) : null;
}
