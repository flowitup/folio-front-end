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
