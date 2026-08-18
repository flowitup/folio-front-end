/**
 * Chiffrage API wrappers — server-only.
 *
 * Per-project material provisioning: postes -> articles -> supplier quotes.
 * Uses sessionAuthHeader (next/headers) — must NOT be imported by client
 * components; those go through the server actions in the chiffrage route.
 *
 * Money arrives from the API already quantized to cents. Totals are computed
 * backend-side and must be rendered as given: recomputing them here would let
 * the displayed subtotal drift from the grand total.
 */

import "server-only";

import { env } from "@/lib/config/env";
import { sessionAuthHeader } from "@/lib/api/auth-header";

// ---------------------------------------------------------------------------
// Types — mirror the BE dataclass DTOs
// ---------------------------------------------------------------------------

/** How an article's effective price was resolved. */
export type EffectiveSource = "selected" | "cheapest" | "none";

export interface ChiffrageQuote {
  id: string;
  article_id: string;
  supplier_id: string | null;
  supplier_name: string | null;
  library_product_id: string | null;
  unit_price_ht: number;
  tva_rate: number;
  unit_price_ttc: number;
  product_url: string | null;
  note: string | null;
  is_selected: boolean;
}

export interface ChiffrageArticle {
  id: string;
  poste_id: string;
  name: string;
  quantity: number;
  unit: string | null;
  note: string | null;
  position: number;
  quotes: ChiffrageQuote[];
  effective_quote_id: string | null;
  effective_source: EffectiveSource;
  total_ht: number;
  total_ttc: number;
}

export interface ChiffragePoste {
  id: string;
  project_id: string;
  name: string;
  note: string | null;
  position: number;
  articles: ChiffrageArticle[];
  subtotal_ht: number;
  subtotal_ttc: number;
}

export interface ChiffrageTree {
  project_id: string;
  postes: ChiffragePoste[];
  total_ht: number;
  total_ttc: number;
  unpriced_article_count: number;
}

/** A selectable unit. Presets carry no id — they are a backend constant. */
export interface ChiffrageUnit {
  id: string | null;
  symbol: string;
  is_preset: boolean;
}

export interface PostePayload {
  name?: string;
  note?: string | null;
}

export interface ArticlePayload {
  name?: string;
  quantity?: number | string;
  unit?: string | null;
  note?: string | null;
}

export interface QuotePayload {
  unit_price_ht?: number | string;
  tva_rate?: number | string;
  supplier_id?: string | null;
  supplier_name?: string | null;
  library_product_id?: string | null;
  product_url?: string | null;
  note?: string | null;
}

export interface ReorderPayload {
  before_id?: string | null;
  after_id?: string | null;
}

// ---------------------------------------------------------------------------
// Internal error helper — mirrors notes.ts / bibliotheque.ts shape
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

async function request<T>(
  path: string,
  init: { method: string; body?: unknown },
  failure: string
): Promise<T> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(`${env.apiBaseUrl}${path}`, {
      method: init.method,
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
    });
  } catch (err) {
    throw new Error(`Network error: ${failure.toLowerCase()}: ${String(err)}`);
  }
  if (!response.ok) throw await buildHttpError(response, failure);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

const base = (projectId: string) => `/projects/${projectId}/chiffrage`;

// ---------------------------------------------------------------------------
// Tree + units
// ---------------------------------------------------------------------------

export async function getChiffrage(projectId: string): Promise<ChiffrageTree> {
  return request<ChiffrageTree>(base(projectId), { method: "GET" }, "Failed to load chiffrage");
}

export async function listUnits(projectId: string): Promise<ChiffrageUnit[]> {
  return request<ChiffrageUnit[]>(`${base(projectId)}/units`, { method: "GET" }, "Failed to list units");
}

export async function createUnit(projectId: string, symbol: string): Promise<ChiffrageUnit> {
  return request<ChiffrageUnit>(`${base(projectId)}/units`, { method: "POST", body: { symbol } }, "Failed to add unit");
}

export async function deleteUnit(projectId: string, unitId: string): Promise<void> {
  return request<void>(`${base(projectId)}/units/${unitId}`, { method: "DELETE" }, "Failed to delete unit");
}

// ---------------------------------------------------------------------------
// Postes
// ---------------------------------------------------------------------------

export async function createPoste(projectId: string, payload: PostePayload): Promise<ChiffragePoste> {
  return request<ChiffragePoste>(`${base(projectId)}/postes`, { method: "POST", body: payload }, "Failed to create poste");
}

export async function updatePoste(
  projectId: string,
  posteId: string,
  payload: PostePayload
): Promise<ChiffragePoste> {
  return request<ChiffragePoste>(
    `${base(projectId)}/postes/${posteId}`,
    { method: "PATCH", body: payload },
    "Failed to update poste"
  );
}

export async function deletePoste(projectId: string, posteId: string): Promise<void> {
  return request<void>(`${base(projectId)}/postes/${posteId}`, { method: "DELETE" }, "Failed to delete poste");
}

export async function reorderPoste(
  projectId: string,
  posteId: string,
  payload: ReorderPayload
): Promise<ChiffragePoste> {
  return request<ChiffragePoste>(
    `${base(projectId)}/postes/${posteId}/reorder`,
    { method: "POST", body: payload },
    "Failed to reorder poste"
  );
}

// ---------------------------------------------------------------------------
// Articles
// ---------------------------------------------------------------------------

export async function createArticle(
  projectId: string,
  posteId: string,
  payload: ArticlePayload
): Promise<ChiffrageArticle> {
  return request<ChiffrageArticle>(
    `${base(projectId)}/postes/${posteId}/articles`,
    { method: "POST", body: payload },
    "Failed to create article"
  );
}

export async function updateArticle(
  projectId: string,
  articleId: string,
  payload: ArticlePayload
): Promise<ChiffrageArticle> {
  return request<ChiffrageArticle>(
    `${base(projectId)}/articles/${articleId}`,
    { method: "PATCH", body: payload },
    "Failed to update article"
  );
}

export async function deleteArticle(projectId: string, articleId: string): Promise<void> {
  return request<void>(`${base(projectId)}/articles/${articleId}`, { method: "DELETE" }, "Failed to delete article");
}

export async function reorderArticle(
  projectId: string,
  articleId: string,
  payload: ReorderPayload
): Promise<ChiffrageArticle> {
  return request<ChiffrageArticle>(
    `${base(projectId)}/articles/${articleId}/reorder`,
    { method: "POST", body: payload },
    "Failed to reorder article"
  );
}

// ---------------------------------------------------------------------------
// Quotes
// ---------------------------------------------------------------------------

export async function createQuote(
  projectId: string,
  articleId: string,
  payload: QuotePayload
): Promise<ChiffrageQuote> {
  return request<ChiffrageQuote>(
    `${base(projectId)}/articles/${articleId}/quotes`,
    { method: "POST", body: payload },
    "Failed to create quote"
  );
}

export async function updateQuote(
  projectId: string,
  quoteId: string,
  payload: QuotePayload
): Promise<ChiffrageQuote> {
  return request<ChiffrageQuote>(
    `${base(projectId)}/quotes/${quoteId}`,
    { method: "PATCH", body: payload },
    "Failed to update quote"
  );
}

export async function deleteQuote(projectId: string, quoteId: string): Promise<void> {
  return request<void>(`${base(projectId)}/quotes/${quoteId}`, { method: "DELETE" }, "Failed to delete quote");
}

export async function selectQuote(projectId: string, quoteId: string): Promise<ChiffrageQuote> {
  return request<ChiffrageQuote>(
    `${base(projectId)}/quotes/${quoteId}/select`,
    { method: "POST", body: {} },
    "Failed to select quote"
  );
}
