"use server";

import { env } from "@/lib/config/env";
import { clientIpHeader } from "@/lib/api/client-ip";
import type { AuthTokenResponse, User } from "./types";
import { setForwardedCookies } from "./forward-cookies";
import { normalizeFrenchPhone } from "./phone-number";

export type RequestOtpError = "invalid_phone" | "throttled" | "sms_failed" | "unavailable" | "unknown";
export type VerifyOtpError = "invalid_code" | "throttled" | "unavailable" | "unknown";

type RequestOtpResult =
  | { success: true; expiresIn: number }
  | { success: false; error: RequestOtpError };

type VerifyOtpResult = {
  success: boolean;
  error?: VerifyOtpError;
  user?: User;
  accessToken?: string;
};

/**
 * Ask the backend to text a 6-digit sign-in code to `phone`.
 * `POST /auth/otp/request` always answers 202 for a well-formed number
 * (whether or not an account has it), so a 400 here means the number itself
 * is malformed, not "unknown account".
 */
export async function requestOtpAction(phone: string): Promise<RequestOtpResult> {
  // Server-side input validation (don't trust client): reject before ever
  // hitting the network so an empty/whitespace phone never reaches the BE.
  const trimmedPhone = typeof phone === "string" ? phone.trim() : "";
  if (!trimmedPhone) {
    return { success: false, error: "invalid_phone" };
  }
  // Sign-in codes leave through a French SMS gateway. The backend enforces the
  // same rule, but stopping here means a foreign number never leaves the server.
  const frenchPhone = normalizeFrenchPhone(trimmedPhone);
  if (!frenchPhone) {
    return { success: false, error: "invalid_phone" };
  }

  try {
    const response = await fetch(`${env.apiBaseUrl}/auth/otp/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await clientIpHeader()) },
      body: JSON.stringify({ phone: frenchPhone }),
    });

    if (response.status === 202) {
      const data: { expires_in: number } = await response.json();
      return { success: true, expiresIn: data.expires_in };
    }

    if (response.status === 400) return { success: false, error: "invalid_phone" };
    if (response.status === 429) return { success: false, error: "throttled" };
    if (response.status === 503) return { success: false, error: "sms_failed" };
    if (response.status === 404) return { success: false, error: "unavailable" };

    return { success: false, error: "unknown" };
  } catch (error) {
    // Log only the message; the body/stack can carry request details we'd
    // rather not stream into container logs.
    console.error("requestOtpAction error:", error instanceof Error ? error.message : "unknown");
    return { success: false, error: "unknown" };
  }
}

/**
 * Exchange a phone number + SMS code for tokens (`POST /auth/otp/verify`).
 * Mirrors `login()` in actions.ts: same success shape, and it MUST forward
 * the backend's Set-Cookie headers via `setForwardedCookies` so the browser
 * ends up with the same access/refresh/csrf cookies password login sets.
 */
export async function verifyOtpAction(phone: string, code: string): Promise<VerifyOtpResult> {
  // Server-side input validation (don't trust client).
  const trimmedPhone = typeof phone === "string" ? phone.trim() : "";
  const trimmedCode = typeof code === "string" ? code.trim() : "";
  if (!trimmedPhone) {
    return { success: false, error: "invalid_code" };
  }
  // Same French-only rule as the request step: a code can only exist for a French number.
  const frenchPhone = normalizeFrenchPhone(trimmedPhone);
  if (!frenchPhone) {
    return { success: false, error: "invalid_code" };
  }
  if (!/^\d{6}$/.test(trimmedCode)) {
    return { success: false, error: "invalid_code" };
  }

  try {
    const response = await fetch(`${env.apiBaseUrl}/auth/otp/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await clientIpHeader()) },
      body: JSON.stringify({ phone: frenchPhone, code: trimmedCode }),
    });

    if (!response.ok) {
      if (response.status === 429) return { success: false, error: "throttled" };
      if (response.status === 404) return { success: false, error: "unavailable" };
      if (response.status === 401 || response.status === 400) {
        return { success: false, error: "invalid_code" };
      }
      return { success: false, error: "unknown" };
    }

    const data: AuthTokenResponse = await response.json();

    // Forward cookies from backend response — same access/refresh/csrf
    // cookie set as password login, since the client's post-login flow
    // (AuthContext) relies on them being present regardless of which
    // sign-in path was used.
    await setForwardedCookies(response.headers.getSetCookie());

    return {
      success: true,
      user: data.user,
      accessToken: data.access_token,
    };
  } catch (error) {
    console.error("verifyOtpAction error:", error instanceof Error ? error.message : "unknown");
    return { success: false, error: "unknown" };
  }
}
