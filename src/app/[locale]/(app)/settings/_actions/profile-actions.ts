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
