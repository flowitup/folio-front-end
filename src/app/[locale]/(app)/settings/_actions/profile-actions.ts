"use server";

/**
 * Profile self-service server action — PATCH /auth/me.
 *
 * Email is intentionally NOT editable here: only the backend
 * (administrator-driven) path can change it, so this action only ever sends
 * `display_name` / `phone`. Auth follows the same session-cookie → Bearer
 * pattern as the other settings actions (sessionAuthHeader); no manual CSRF
 * header is needed since server actions are already same-origin protected.
 */

import { env } from "@/lib/config/env";
import { sessionAuthHeader } from "@/lib/api/auth-header";
import type { User } from "@/lib/auth/types";
import { normalizeFrenchPhone } from "@/lib/auth/phone-number";

export interface UpdateProfilePayload {
  display_name?: string | null;
  phone?: string | null;
}

export type UpdateProfileResult =
  | { success: true; user: User }
  | { success: false; error: "invalid_phone" | "phone_taken" | "unknown" };

export async function updateProfileAction(
  payload: UpdateProfilePayload
): Promise<UpdateProfileResult> {
  const authHeaders = await sessionAuthHeader();
  // No cookie at all — treat the same as any other backend rejection rather
  // than throwing, so the caller can show a toast instead of crashing.
  if (!authHeaders.Authorization) {
    return { success: false, error: "unknown" };
  }

  let response: Response;
  try {
    response = await fetch(`${env.apiBaseUrl}/auth/me`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch {
    return { success: false, error: "unknown" };
  }

  if (response.status === 400) {
    return { success: false, error: "invalid_phone" };
  }
  if (response.status === 409) {
    return { success: false, error: "phone_taken" };
  }
  if (!response.ok) {
    return { success: false, error: "unknown" };
  }

  const user = (await response.json()) as User;
  return { success: true, user };
}

// ---------------------------------------------------------------------------
// Verified phone-number change — the phone is the sign-in identity, so a new
// number is only saved once the code texted to it comes back.
//   POST /auth/me/phone/request-code {phone}        → 202 {expires_in}
//   POST /auth/me/phone/confirm      {phone, code}  → 200 User
// ---------------------------------------------------------------------------

export type RequestPhoneChangeError =
  | "invalid_phone"
  | "same_phone"
  | "phone_taken"
  | "throttled"
  | "sms_failed"
  | "unknown";

export type RequestPhoneChangeResult =
  | { success: true; expiresIn: number }
  | { success: false; error: RequestPhoneChangeError };

export type ConfirmPhoneChangeError =
  | "invalid_code"
  | "invalid_phone"
  | "phone_taken"
  | "throttled"
  | "unknown";

export type ConfirmPhoneChangeResult =
  | { success: true; user: User }
  | { success: false; error: ConfirmPhoneChangeError };

async function postPhoneChange(path: string, body: object): Promise<Response | null> {
  const authHeaders = await sessionAuthHeader();
  if (!authHeaders.Authorization) return null;
  try {
    return await fetch(`${env.apiBaseUrl}/auth/me/phone/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    return null;
  }
}

/** Text a code to the NEW number (French numbers only, like sign-in). */
export async function requestPhoneChangeCodeAction(
  phone: string
): Promise<RequestPhoneChangeResult> {
  const frenchPhone = normalizeFrenchPhone(typeof phone === "string" ? phone : "");
  if (!frenchPhone) return { success: false, error: "invalid_phone" };

  const response = await postPhoneChange("request-code", { phone: frenchPhone });
  if (!response) return { success: false, error: "unknown" };
  if (response.status === 202) {
    const data: { expires_in: number } = await response.json();
    return { success: true, expiresIn: data.expires_in };
  }
  if (response.status === 400) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    return { success: false, error: data?.error === "PhoneUnchanged" ? "same_phone" : "invalid_phone" };
  }
  if (response.status === 409) return { success: false, error: "phone_taken" };
  if (response.status === 429) return { success: false, error: "throttled" };
  if (response.status === 503) return { success: false, error: "sms_failed" };
  return { success: false, error: "unknown" };
}

/** Swap the sign-in number once the code texted to it checks out. */
export async function confirmPhoneChangeAction(
  phone: string,
  code: string
): Promise<ConfirmPhoneChangeResult> {
  const frenchPhone = normalizeFrenchPhone(typeof phone === "string" ? phone : "");
  if (!frenchPhone) return { success: false, error: "invalid_phone" };
  const trimmedCode = typeof code === "string" ? code.trim() : "";
  if (!/^\d{6}$/.test(trimmedCode)) return { success: false, error: "invalid_code" };

  const response = await postPhoneChange("confirm", { phone: frenchPhone, code: trimmedCode });
  if (!response) return { success: false, error: "unknown" };
  if (response.ok) return { success: true, user: (await response.json()) as User };
  if (response.status === 400) {
    // A wrong or expired code is a 400 `InvalidCode` (the caller is signed in, so not a 401).
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    return { success: false, error: data?.error === "InvalidCode" ? "invalid_code" : "invalid_phone" };
  }
  if (response.status === 409) return { success: false, error: "phone_taken" };
  if (response.status === 429) return { success: false, error: "throttled" };
  return { success: false, error: "unknown" };
}
