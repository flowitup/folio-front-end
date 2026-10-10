"use server";

/**
 * Chiffrage server actions.
 *
 * Thin wrappers around the server-only API module, callable from client
 * components. Each returns { ok: true, data } | { ok: false, error } so the UI
 * can revert an optimistic update instead of throwing.
 */

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import {
  createArticle,
  createPoste,
  createQuote,
  createStore,
  createUnit,
  deleteArticle,
  deletePoste,
  createRoom,
  deleteArticleImage,
  deleteQuote,
  deleteRoom,
  deleteStore,
  deleteUnit,
  getChiffrage,
  listUnits,
  reorderArticle,
  reorderPoste,
  reorderRoom,
  selectQuote,
  setArticleImageFromUrl,
  unselectQuote,
  uploadArticleImage,
  updateArticle,
  updatePoste,
  updateQuote,
  updateRoom,
  updateStore,
  type ArticlePayload,
  type ChiffrageArticle,
  type ChiffragePoste,
  type ChiffrageQuote,
  type ChiffrageRoom,
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
 * Map a thrown API error to a short message in the user's language.
 *
 * Never the backend's own `message`: it is English (and sometimes technical,
 * like "Missing permission: project:manage_invoices" or "Host not allowed"),
 * so it is mapped from the status and error code instead.
 */
async function classifyBackendError(err: unknown): Promise<string> {
  const e = err as { status?: number; body?: { error?: string; message?: string } | null };
  const t = await getTranslations("chiffrage");
  const message = e?.body?.message ?? "";
  switch (e?.status) {
    case 403:
      return t("errorForbidden");
    case 404:
      return t("errorNotFound");
    case 409:
      return t("errorNameTaken");
    case 413:
      return t("errorImageTooLarge");
    case 415:
      return t("errorImageUnsupported");
    case 429:
      return t("errorRateLimited");
    case 400:
    case 422:
      // The image-from-link fetch is refused as InvalidInput (blocked host,
      // or the site answered with an error).
      return /host not allowed|upstream|could not fetch|https image/i.test(message)
        ? t("errorImageLink")
        : t("errorInvalidInput");
    default:
      return t("errorGeneric");
  }
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
    return { ok: false, error: await classifyBackendError(err) };
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

// --- rooms -----------------------------------------------------------------

export async function createRoomAction(
  projectId: string,
  name: string
): Promise<Result<ChiffrageRoom>> {
  return run(projectId, () => createRoom(projectId, name));
}

export async function updateRoomAction(
  projectId: string,
  roomId: string,
  name: string
): Promise<Result<ChiffrageRoom>> {
  return run(projectId, () => updateRoom(projectId, roomId, name));
}

export async function deleteRoomAction(projectId: string, roomId: string): Promise<Result<void>> {
  return run(projectId, () => deleteRoom(projectId, roomId));
}

export async function reorderRoomAction(
  projectId: string,
  roomId: string,
  payload: ReorderPayload
): Promise<Result<ChiffrageRoom>> {
  return run(projectId, () => reorderRoom(projectId, roomId, payload));
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
  payload: StorePayload
): Promise<Result<ChiffrageStore>> {
  return run(projectId, () => createStore(projectId, payload));
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

export async function unselectQuoteAction(projectId: string, quoteId: string): Promise<Result<ChiffrageQuote>> {
  return run(projectId, () => unselectQuote(projectId, quoteId));
}
