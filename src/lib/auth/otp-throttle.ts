/**
 * Reading a 429 on an SMS-code request (sign-in, invitation, phone change).
 *
 * The backend refuses a code for two reasons: the short gap between two codes
 * ("wait a minute") and the hourly cap per number (`error: "OtpHourlyLimit"`),
 * which can last close to an hour. Showing "wait a minute" for the cap sends the
 * user back every minute for nothing, so the cap gets its own message with the
 * wait from the Retry-After header.
 */

export const OTP_HOURLY_LIMIT_ERROR = "OtpHourlyLimit";

/** Whole minutes (rounded up) to wait when `errorCode` is the hourly cap, else null. */
export function hourlyLimitMinutes(errorCode: unknown, retryAfter: string | null | undefined): number | null {
  if (errorCode !== OTP_HOURLY_LIMIT_ERROR) return null;
  const seconds = Number(retryAfter);
  // The backend always sends Retry-After with the cap; without it, the cap lasts at most an hour.
  if (!retryAfter || !Number.isFinite(seconds) || seconds <= 0) return 60;
  return Math.ceil(seconds / 60);
}

/** Minutes of the hourly cap for a 429 `response`, or null for the short resend gap. */
export async function hourlyLimitMinutesOf(response: Response): Promise<number | null> {
  const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
  return hourlyLimitMinutes(body?.error, response.headers.get("Retry-After"));
}

/** Per-network cap on sign-in codes (many workers on one site Wi-Fi). */
export const NETWORK_THROTTLED_ERROR = "NetworkThrottled";
/** The platform-wide SMS budget is spent: nothing to do with this number. */
export const SMS_SERVICE_BUSY_ERROR = "SmsServiceBusy";

export type CodeLimit =
  | { kind: "number"; minutes: number }
  | { kind: "network"; minutes: number }
  | { kind: "service"; minutes: number }
  | { kind: "gap" };

function minutesOf(retryAfter: string | null): number {
  const seconds = Number(retryAfter);
  if (!retryAfter || !Number.isFinite(seconds) || seconds <= 0) return 1;
  return Math.max(1, Math.ceil(seconds / 60));
}

/**
 * Why a 429 on a sign-in code request or check was refused: the number's
 * hourly cap, the network's cap, the SMS service's budget, or the short gap
 * between two codes. Each gets its own message, so a worker on a busy site
 * Wi-Fi is no longer told a code was just sent to them.
 */
export async function codeLimitOf(response: Response): Promise<CodeLimit> {
  const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
  const retryAfter = response.headers.get("Retry-After");
  const hourly = hourlyLimitMinutes(body?.error, retryAfter);
  if (hourly !== null) return { kind: "number", minutes: hourly };
  if (body?.error === NETWORK_THROTTLED_ERROR) return { kind: "network", minutes: minutesOf(retryAfter) };
  if (body?.error === SMS_SERVICE_BUSY_ERROR) return { kind: "service", minutes: minutesOf(retryAfter) };
  return { kind: "gap" };
}
