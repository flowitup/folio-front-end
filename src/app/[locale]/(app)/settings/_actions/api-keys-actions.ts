"use server";

/**
 * Settings → API Keys server actions.
 *
 * Thin wrappers over the server-only API client: the client component cannot
 * import `@/lib/api/api-keys` (it reads next/headers), so it goes through here.
 */

import { listApiKeys, createApiKey, deleteApiKey } from "@/lib/api/api-keys";
import type { ApiKey, CreatedApiKey } from "@/lib/api/api-keys";

export type ApiKeyError =
  | "unauthorized"
  | "invalid_name"
  | "limit_reached"
  | "not_found"
  | "rate_limited"
  | "unknown";

export type ListApiKeysResult =
  | { ok: true; data: ApiKey[] }
  | { ok: false; error: ApiKeyError };

export type CreateApiKeyResult =
  | { ok: true; data: CreatedApiKey }
  | { ok: false; error: ApiKeyError };

export type DeleteApiKeyResult =
  | { ok: true }
  | { ok: false; error: ApiKeyError };

function classify(err: unknown): ApiKeyError {
  const status = (err as { status?: number } | null)?.status;
  switch (status) {
    case 401:
      return "unauthorized";
    case 400:
    case 422:
      return "invalid_name";
    case 409:
      return "limit_reached";
    case 404:
      return "not_found";
    case 429:
      // Creating keys is rate-limited server-side; without this the user is
      // told "something went wrong" for a condition that simply needs a wait.
      return "rate_limited";
    default:
      return "unknown";
  }
}

export async function fetchApiKeysAction(): Promise<ListApiKeysResult> {
  try {
    return { ok: true, data: await listApiKeys() };
  } catch (err) {
    return { ok: false, error: classify(err) };
  }
}

/**
 * Validates and trims the name locally so a blank/whitespace-only submission
 * never makes a network round-trip to learn what the client already knows.
 */
export async function createApiKeyAction(name: string): Promise<CreateApiKeyResult> {
  const trimmed = name.trim();
  if (!trimmed) {
    return { ok: false, error: "invalid_name" };
  }
  try {
    return { ok: true, data: await createApiKey(trimmed) };
  } catch (err) {
    return { ok: false, error: classify(err) };
  }
}

export async function deleteApiKeyAction(id: string): Promise<DeleteApiKeyResult> {
  try {
    await deleteApiKey(id);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: classify(err) };
  }
}
