/**
 * Retry a request that the API rejected with HTTP 429.
 *
 * Import endpoints are rate limited per user over a fixed one-minute window
 * (billing documents: 30/min, library purchases: 10/min) and answer without a
 * Retry-After header, so a long import pauses and tries again rather than
 * failing every remaining row. Pauses are short enough for the caller to show
 * a countdown, and aborting the signal ends a pause at once.
 */

export const RATE_LIMIT_PAUSE_SECONDS = 20;
/** Four pauses cover more than one full window. */
export const RATE_LIMIT_MAX_RETRIES = 4;

export interface RateLimitRetryOptions {
  /** Called with the pause length in seconds before each wait. */
  onPause?: (seconds: number) => void;
  /** Called when a pause is over, just before the request is sent again. */
  onResume?: () => void;
  /** Aborting ends the current pause and gives up with the last result. */
  signal?: AbortSignal;
  /** Injected for tests. */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  pauseSeconds?: number;
  maxRetries?: number;
}

/** Resolves after `ms`, or as soon as `signal` is aborted. Never rejects. */
export function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const done = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal?.addEventListener("abort", done, { once: true });
  });
}

export async function callWithRateLimitRetry<T>(
  call: () => Promise<T>,
  isRateLimited: (result: T) => boolean,
  options: RateLimitRetryOptions = {}
): Promise<T> {
  const {
    onPause,
    onResume,
    signal,
    sleep = abortableSleep,
    pauseSeconds = RATE_LIMIT_PAUSE_SECONDS,
    maxRetries = RATE_LIMIT_MAX_RETRIES,
  } = options;

  let result = await call();
  for (let attempt = 0; attempt < maxRetries && isRateLimited(result); attempt++) {
    if (signal?.aborted) return result;
    onPause?.(pauseSeconds);
    await sleep(pauseSeconds * 1000, signal);
    if (signal?.aborted) return result;
    onResume?.();
    result = await call();
  }
  return result;
}
