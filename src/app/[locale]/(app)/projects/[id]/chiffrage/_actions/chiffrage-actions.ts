"use server";

/**
 * Chiffrage server actions.
 *
 * Thin wrappers around the server-only API module, callable from client
 * components. Each returns { ok: true, data } | { ok: false, error } so the UI
 * can revert an optimistic update instead of throwing.
 */

import { revalidatePath } from "next/cache";

import {
  createArticle,
  createPoste,
  createQuote,
  createStore,
  createUnit,
  deleteArticle,
  deletePoste,
  deleteArticleImage,
  deleteQuote,
  deleteStore,
  deleteUnit,
  getChiffrage,
  listUnits,
  reorderArticle,
  reorderPoste,
  selectQuote,
  setArticleImageFromUrl,
  uploadArticleImage,
  updateArticle,
  updatePoste,
  updateQuote,
  updateStore,
  type ArticlePayload,
  type ChiffrageArticle,
  type ChiffragePoste,
  type ChiffrageQuote,
  type ChiffrageStore,
  type ChiffrageTree,
  type ChiffrageUnit,
  type PostePayload,
  type QuotePayload,
  type ReorderPayload,
  type StorePayload,
} from "@/lib/api/chiffrage";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Map a thrown API error to a short, user-facing message.
 *
 * The backend's `message` is the useful part (unknown unit, duplicate symbol,
 * cross-project 404); the generic HTTP wrapper text is not.
 */
function classifyBackendError(err: unknown): string {
  const e = err as { status?: number; body?: { message?: string } | null; message?: string };
  if (e?.body?.message) return e.body.message;
  if (e?.status === 403) return "You do not have permission to modify this chiffrage.";
  if (e?.status === 404) return "This item no longer exists.";
  if (e?.status === 409) return "That unit already exists.";
  return e?.message ?? "Unknown error";
}

function revalidate(projectId: string): void {
  revalidatePath(`/projects/${projectId}/chiffrage`);
}

async function run<T>(projectId: string, fn: () => Promise<T>, mutating = true): Promise<Result<T>> {
  try {
    const data = await fn();
    if (mutating) revalidate(projectId);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: classifyBackendError(err) };
  }
}

// --- reads -----------------------------------------------------------------

export async function getChiffrageAction(projectId: string): Promise<Result<ChiffrageTree>> {
  return run(projectId, () => getChiffrage(projectId), false);
}

export async function listUnitsAction(projectId: string): Promise<Result<ChiffrageUnit[]>> {
  return run(projectId, () => listUnits(projectId), false);
}

// --- units -----------------------------------------------------------------

export async function createUnitAction(projectId: string, symbol: string): Promise<Result<ChiffrageUnit>> {
  return run(projectId, () => createUnit(projectId, symbol));
}

export async function deleteUnitAction(projectId: string, unitId: string): Promise<Result<void>> {
  return run(projectId, () => deleteUnit(projectId, unitId));
}

// --- postes ----------------------------------------------------------------

export async function createPosteAction(projectId: string, payload: PostePayload): Promise<Result<ChiffragePoste>> {
  return run(projectId, () => createPoste(projectId, payload));
}

export async function updatePosteAction(
  projectId: string,
  posteId: string,
  payload: PostePayload
): Promise<Result<ChiffragePoste>> {
  return run(projectId, () => updatePoste(projectId, posteId, payload));
}

export async function deletePosteAction(projectId: string, posteId: string): Promise<Result<void>> {
  return run(projectId, () => deletePoste(projectId, posteId));
}

export async function reorderPosteAction(
  projectId: string,
  posteId: string,
  payload: ReorderPayload
): Promise<Result<ChiffragePoste>> {
  return run(projectId, () => reorderPoste(projectId, posteId, payload));
}

// --- article image ---------------------------------------------------------

export async function uploadArticleImageAction(
  projectId: string,
  articleId: string,
  formData: FormData
): Promise<Result<void>> {
  const file = formData.get("image");
  if (!(file instanceof File)) return { ok: false, error: "invalid" };
  return run(projectId, () => uploadArticleImage(projectId, articleId, file));
}

export async function setArticleImageFromUrlAction(
  projectId: string,
  articleId: string,
  url: string
): Promise<Result<void>> {
  return run(projectId, () => setArticleImageFromUrl(projectId, articleId, url));
}

export async function deleteArticleImageAction(
  projectId: string,
  articleId: string
): Promise<Result<void>> {
  return run(projectId, () => deleteArticleImage(projectId, articleId));
}

// --- stores ----------------------------------------------------------------

export async function createStoreAction(
  projectId: string,
  posteId: string,
  payload: StorePayload
): Promise<Result<ChiffrageStore>> {
  return run(projectId, () => createStore(projectId, posteId, payload));
}

export async function updateStoreAction(
  projectId: string,
  storeId: string,
  payload: StorePayload
): Promise<Result<ChiffrageStore>> {
  return run(projectId, () => updateStore(projectId, storeId, payload));
}

export async function deleteStoreAction(projectId: string, storeId: string): Promise<Result<void>> {
  return run(projectId, () => deleteStore(projectId, storeId));
}

// --- articles --------------------------------------------------------------

export async function createArticleAction(
  projectId: string,
  posteId: string,
  payload: ArticlePayload
): Promise<Result<ChiffrageArticle>> {
  return run(projectId, () => createArticle(projectId, posteId, payload));
}

export async function updateArticleAction(
  projectId: string,
  articleId: string,
  payload: ArticlePayload
): Promise<Result<ChiffrageArticle>> {
  return run(projectId, () => updateArticle(projectId, articleId, payload));
}

export async function deleteArticleAction(projectId: string, articleId: string): Promise<Result<void>> {
  return run(projectId, () => deleteArticle(projectId, articleId));
}

export async function reorderArticleAction(
  projectId: string,
  articleId: string,
  payload: ReorderPayload
): Promise<Result<ChiffrageArticle>> {
  return run(projectId, () => reorderArticle(projectId, articleId, payload));
}

// --- quotes ----------------------------------------------------------------

export async function createQuoteAction(
  projectId: string,
  articleId: string,
  payload: QuotePayload
): Promise<Result<ChiffrageQuote>> {
  return run(projectId, () => createQuote(projectId, articleId, payload));
}

export async function updateQuoteAction(
  projectId: string,
  quoteId: string,
  payload: QuotePayload
): Promise<Result<ChiffrageQuote>> {
  return run(projectId, () => updateQuote(projectId, quoteId, payload));
}

export async function deleteQuoteAction(projectId: string, quoteId: string): Promise<Result<void>> {
  return run(projectId, () => deleteQuote(projectId, quoteId));
}

export async function selectQuoteAction(projectId: string, quoteId: string): Promise<Result<ChiffrageQuote>> {
  return run(projectId, () => selectQuote(projectId, quoteId));
}
