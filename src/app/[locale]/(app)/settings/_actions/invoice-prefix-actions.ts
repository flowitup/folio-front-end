"use server";

import { env } from "@/lib/config/env";
import { sessionAuthHeader } from "@/lib/api/auth-header";
import { getSession } from "@/lib/auth/session";

const PREFIX_RE = /^[A-Z0-9]{1,8}$/;

export type UpdatePrefixResult =
  | { ok: true }
  | { ok: false; error: "validation" | "forbidden" | "not_found" | "unauthorized" | "unknown" };

export async function updateInvoicePrefix(
  projectId: string,
  rawPrefix: string,
): Promise<UpdatePrefixResult> {
  const session = await getSession();
  if (!session?.accessToken) {
    return { ok: false, error: "unauthorized" };
  }

  const cleaned = rawPrefix.trim().toUpperCase();

  if (cleaned !== "" && !PREFIX_RE.test(cleaned)) {
    return { ok: false, error: "validation" };
  }

  const authHeaders = await sessionAuthHeader();
  const response = await fetch(`${env.apiBaseUrl}/projects/${projectId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify({ invoice_prefix: cleaned === "" ? null : cleaned }),
  });

  if (response.ok) return { ok: true };
  if (response.status === 400) return { ok: false, error: "validation" };
  if (response.status === 403) return { ok: false, error: "forbidden" };
  if (response.status === 404) return { ok: false, error: "not_found" };
  return { ok: false, error: "unknown" };
}
