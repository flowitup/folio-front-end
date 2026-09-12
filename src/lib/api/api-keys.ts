/**
 * API keys API wrappers — server-only.
 * Personal automation tokens scoped to the current user (Settings → API Keys).
 * Uses sessionAuthHeader (next/headers) — must NOT be imported by client components.
 * Client components must go through api-keys-actions.ts server actions.
 *
 * Endpoints:
 *   GET    /api-keys
 *   POST   /api-keys
 *   DELETE /api-keys/<id>
 *
 * The plaintext `token` is returned only from create — it can never be
 * retrieved again, so ApiKey (the list/row shape) deliberately omits it.
 */

import "server-only";

import { env } from "@/lib/config/env";
import { sessionAuthHeader } from "@/lib/api/auth-header";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ApiKey = {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
};

/** Returned only from create — the plaintext token can never be retrieved again. */
export type CreatedApiKey = ApiKey & { token: string };

// Raw snake_case shape from the BE
interface ApiKeyRaw {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
}

interface CreatedApiKeyRaw extends ApiKeyRaw {
  token: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function buildHttpError(
  response: Response,
  prefix: string
): Promise<Error & { status: number; body: { error?: string; message?: string } | null }> {
  let body: { error?: string; message?: string } | null = null;
  try {
    body = (await response.json()) as { error?: string; message?: string };
  } catch {
    // Non-JSON body — leave null.
  }
  const err = new Error(`${prefix} (HTTP ${response.status})`) as Error & {
    status: number;
    body: { error?: string; message?: string } | null;
  };
  err.status = response.status;
  err.body = body;
  return err;
}

function mapApiKey(raw: ApiKeyRaw): ApiKey {
  return {
    id: raw.id,
    name: raw.name,
    prefix: raw.prefix,
    createdAt: raw.created_at,
    lastUsedAt: raw.last_used_at ?? null,
  };
}

// ---------------------------------------------------------------------------
// API wrappers
// ---------------------------------------------------------------------------

/**
 * List the current user's API keys (masked — no secrets in this response).
 * GET /api-keys
 */
export async function listApiKeys(): Promise<ApiKey[]> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(`${env.apiBaseUrl}/api-keys`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        ...authHeaders,
      },
      cache: "no-store",
    });
  } catch (err) {
    throw new Error(`Network error listing API keys: ${String(err)}`);
  }
  if (!response.ok) {
    throw await buildHttpError(response, "Failed to list API keys");
  }
  const data = (await response.json()) as { api_keys: ApiKeyRaw[] };
  return data.api_keys.map(mapApiKey);
}

/**
 * Create a new API key for the current user.
 * The response's `token` is the plaintext secret — the only time it is ever
 * returned; the backend stores only a hash of it from this point on.
 * POST /api-keys
 */
export async function createApiKey(name: string): Promise<CreatedApiKey> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(`${env.apiBaseUrl}/api-keys`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        ...authHeaders,
      },
      body: JSON.stringify({ name }),
      cache: "no-store",
    });
  } catch (err) {
    throw new Error(`Network error creating API key: ${String(err)}`);
  }
  if (!response.ok) {
    throw await buildHttpError(response, "Failed to create API key");
  }
  const raw = (await response.json()) as CreatedApiKeyRaw;
  return { ...mapApiKey(raw), token: raw.token };
}

/**
 * Revoke (delete) an API key. Returns 204 No Content on success.
 * DELETE /api-keys/<id>
 */
export async function deleteApiKey(id: string): Promise<void> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(`${env.apiBaseUrl}/api-keys/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        ...authHeaders,
      },
      cache: "no-store",
    });
  } catch (err) {
    throw new Error(`Network error deleting API key: ${String(err)}`);
  }
  if (!response.ok) {
    throw await buildHttpError(response, "Failed to delete API key");
  }
}
