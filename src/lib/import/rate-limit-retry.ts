/**
 * Retry a request that the API rejected with HTTP 429.
 *
 * Import endpoints are rate limited per user over a fixed one-minute window
 * (billing documents: 30/min, library purchases: 10/min) and answer without a
 * Retry-After header, so a long import pauses and tries again rather than
 * failing every remaining row. Pauses are short enough for the caller to show
 * a countdown and to stop between them.
 */

export const RATE_LIMIT_PAUSE_SECONDS = 20;
/** Four pauses cover more than one full window. */
export const RATE_LIMIT_MAX_RETRIES = 4;

export interface RateLimitRetryOptions {
  /** Called with the pause length in seconds before each wait. */
  onPause?: (seconds: number) => void;
  /** Checked after each pause; returning true gives up with the last result. */
  isStopped?: () => boolean;
  /** Injected for tests. */
  sleep?: (ms: number) => Promise<void>;
  pauseSeconds?: number;
  maxRetries?: number;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function callWithRateLimitRetry<T>(
  call: () => Promise<T>,
  isRateLimited: (result: T) => boolean,
  options: RateLimitRetryOptions = {}
): Promise<T> {
  const {
    onPause,
    isStopped,
    sleep = defaultSleep,
    pauseSeconds = RATE_LIMIT_PAUSE_SECONDS,
    maxRetries = RATE_LIMIT_MAX_RETRIES,
  } = options;

  let result = await call();
  for (let attempt = 0; attempt < maxRetries && isRateLimited(result); attempt++) {
    onPause?.(pauseSeconds);
    await sleep(pauseSeconds * 1000);
    if (isStopped?.()) return result;
    result = await call();
  }
  return result;
}
