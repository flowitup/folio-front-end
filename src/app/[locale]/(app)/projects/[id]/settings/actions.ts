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

export type UpdateBankCreditResult =
  | { ok: true }
  | { ok: false; error: "validation" | "forbidden" | "not_found" | "unauthorized" | "unknown" };

/**
 * Persist the project's bank credit (crédit immobilier) and its funding
 * source. Both fields are sent on every save so clearing one is explicit —
 * the API distinguishes "omitted" (no-op) from "null" (clear the value).
 */
export async function updateBankCredit(
  projectId: string,
  rawBudget: string,
  rawSource: string,
): Promise<UpdateBankCreditResult> {
  const session = await getSession();
  if (!session?.accessToken) {
    return { ok: false, error: "unauthorized" };
  }

  const trimmedBudget = rawBudget.trim();
  let budget: number | null = null;
  if (trimmedBudget !== "") {
    const parsed = Number(trimmedBudget.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed < 0) {
      return { ok: false, error: "validation" };
    }
    budget = parsed;
  }

  const trimmedSource = rawSource.trim();

  const authHeaders = await sessionAuthHeader();
  const response = await fetch(`${env.apiBaseUrl}/projects/${projectId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify({
      budget,
      budget_source: trimmedSource === "" ? null : trimmedSource,
    }),
  });

  if (response.ok) return { ok: true };
  if (response.status === 400) return { ok: false, error: "validation" };
  if (response.status === 403) return { ok: false, error: "forbidden" };
  if (response.status === 404) return { ok: false, error: "not_found" };
  return { ok: false, error: "unknown" };
}
