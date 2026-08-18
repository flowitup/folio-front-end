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

/** Which endpoint serves an article's thumbnail. */
export interface ChiffrageImageRef {
  kind: "article" | "library";
  id: string;
}

/** A room of the chantier, declared once and reused by every poste. */
export interface ChiffrageRoom {
  id: string;
  name: string;
  position: number;
}

/** What one room costs inside one poste. room_id null = unassigned. */
export interface ChiffrageRoomSubtotal {
  room_id: string | null;
  subtotal_ht: number;
  subtotal_ttc: number;
  article_count: number;
}

export interface ChiffrageArticle {
  id: string;
  poste_id: string;
  name: string;
  quantity: number;
  unit: string | null;
  note: string | null;
  room_id: string | null;
  position: number;
  quotes: ChiffrageQuote[];
  image_ref: ChiffrageImageRef | null;
  effective_quote_id: string | null;
  effective_source: EffectiveSource;
  total_ht: number;
  total_ttc: number;
}

/** A shop to visit for a poste's purchases. */
export interface ChiffrageStore {
  id: string;
  poste_id: string;
  name: string;
  address: string | null;
  website_url: string | null;
  position: number;
}

export interface ChiffragePoste {
  id: string;
  project_id: string;
  name: string;
  note: string | null;
  position: number;
  articles: ChiffrageArticle[];
  stores: ChiffrageStore[];
  room_subtotals: ChiffrageRoomSubtotal[];
  subtotal_ht: number;
  subtotal_ttc: number;
}

export interface ChiffrageTree {
  project_id: string;
  postes: ChiffragePoste[];
  rooms: ChiffrageRoom[];
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

export interface StorePayload {
  name?: string;
  address?: string | null;
  website_url?: string | null;
}

export interface ArticlePayload {
  name?: string;
  quantity?: number | string;
  unit?: string | null;
  note?: string | null;
  room_id?: string | null;
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

export async function uploadArticleImage(projectId: string, articleId: string, file: File): Promise<void> {
  // Server-side with a Bearer header: Flask-JWT-Extended skips the cookie-CSRF
  // check when Authorization is present, which a browser-side multipart POST
  // cannot satisfy (it needs X-CSRF-TOKEN and 401s without it).
  const authHeaders = await sessionAuthHeader();
  const form = new FormData();
  form.append("image", file);

  const response = await fetch(
    `${env.apiBaseUrl}/projects/${projectId}/chiffrage/articles/${articleId}/image`,
    {
      // No Content-Type — fetch sets the multipart boundary itself.
      method: "POST",
      headers: { ...authHeaders },
      body: form,
      cache: "no-store",
    }
  );
  if (!response.ok) throw await buildHttpError(response, "Failed to upload the image");
}

export async function setArticleImageFromUrl(
  projectId: string,
  articleId: string,
  url: string
): Promise<void> {
  return request<void>(
    `${base(projectId)}/articles/${articleId}/image-from-url`,
    { method: "POST", body: { url } },
    "Failed to fetch the image"
  );
}

export async function deleteArticleImage(projectId: string, articleId: string): Promise<void> {
  return request<void>(
    `${base(projectId)}/articles/${articleId}/image`,
    { method: "DELETE" },
    "Failed to remove the image"
  );
}

// ---------------------------------------------------------------------------
// Rooms — the chantier's pièces
// ---------------------------------------------------------------------------

export async function listRooms(projectId: string): Promise<ChiffrageRoom[]> {
  return request<ChiffrageRoom[]>(`${base(projectId)}/rooms`, { method: "GET" }, "Failed to load rooms");
}

export async function createRoom(projectId: string, name: string): Promise<ChiffrageRoom> {
  return request<ChiffrageRoom>(
    `${base(projectId)}/rooms`,
    { method: "POST", body: { name } },
    "Failed to create the room"
  );
}

export async function updateRoom(
  projectId: string,
  roomId: string,
  name: string
): Promise<ChiffrageRoom> {
  return request<ChiffrageRoom>(
    `${base(projectId)}/rooms/${roomId}`,
    { method: "PATCH", body: { name } },
    "Failed to rename the room"
  );
}

export async function deleteRoom(projectId: string, roomId: string): Promise<void> {
  return request<void>(
    `${base(projectId)}/rooms/${roomId}`,
    { method: "DELETE" },
    "Failed to delete the room"
  );
}

// ---------------------------------------------------------------------------
// Stores — where to go and buy
// ---------------------------------------------------------------------------

export async function createStore(
  projectId: string,
  posteId: string,
  payload: StorePayload
): Promise<ChiffrageStore> {
  return request<ChiffrageStore>(
    `${base(projectId)}/postes/${posteId}/stores`,
    { method: "POST", body: payload },
    "Failed to add store"
  );
}

export async function updateStore(
  projectId: string,
  storeId: string,
  payload: StorePayload
): Promise<ChiffrageStore> {
  return request<ChiffrageStore>(
    `${base(projectId)}/stores/${storeId}`,
    { method: "PATCH", body: payload },
    "Failed to update store"
  );
}

export async function deleteStore(projectId: string, storeId: string): Promise<void> {
  return request<void>(`${base(projectId)}/stores/${storeId}`, { method: "DELETE" }, "Failed to delete store");
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
