/**
 * chiffrage-actions.test.ts
 *
 * Actions return a result rather than throwing so the page can revert an
 * optimistic reorder. What matters is that the backend's own message survives
 * — "Unknown unit 'parsec'" is actionable, "Failed to create article (HTTP
 * 400)" is not.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next-intl/server", async () => {
  const fr = (await import("@/messages/fr.json")).default as unknown as Record<string, unknown>;
  return {
    getTranslations: async (ns: string) => (key: string) =>
      [...ns.split("."), key].reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], fr),
  };
});

const api = {
  getChiffrage: vi.fn(),
  listUnits: vi.fn(),
  createUnit: vi.fn(),
  deleteUnit: vi.fn(),
  createPoste: vi.fn(),
  updatePoste: vi.fn(),
  deletePoste: vi.fn(),
  reorderPoste: vi.fn(),
  createArticle: vi.fn(),
  updateArticle: vi.fn(),
  deleteArticle: vi.fn(),
  reorderArticle: vi.fn(),
  createQuote: vi.fn(),
  updateQuote: vi.fn(),
  deleteQuote: vi.fn(),
  selectQuote: vi.fn(),
  reorderRoom: vi.fn(),
  updateStore: vi.fn(),
  deleteStore: vi.fn(),
};
vi.mock("@/lib/api/chiffrage", () => api);

const {
  createPosteAction,
  createArticleAction,
  createUnitAction,
  reorderArticleAction,
  reorderRoomAction,
  selectQuoteAction,
  updateStoreAction,
  deleteStoreAction,
} = await import("../chiffrage-actions");

const PROJECT = "proj-1";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("chiffrage actions", () => {
  it("returns the created entity on success", async () => {
    api.createPoste.mockResolvedValue({ id: "p1", name: "Lumière" });
    const res = await createPosteAction(PROJECT, { name: "Lumière" });

    expect(res).toEqual({ ok: true, data: { id: "p1", name: "Lumière" } });
    expect(api.createPoste).toHaveBeenCalledWith(PROJECT, { name: "Lumière" });
  });

  it("answers in the user's language, never with the backend's English text", async () => {
    api.createArticle.mockRejectedValue(
      Object.assign(new Error("Failed to create article (HTTP 400)"), {
        status: 400,
        body: { error: "InvalidInput", message: "Unknown unit 'parsec' for this project." },
      })
    );

    const res = await createArticleAction(PROJECT, "poste-1", { name: "Bad", unit: "parsec" });
    expect(res).toEqual({
      ok: false,
      error: "Certaines valeurs ne sont pas valides. Vérifiez les champs et réessayez.",
    });
  });

  it("names the link as the problem when an image URL is refused", async () => {
    api.createArticle.mockRejectedValue(
      Object.assign(new Error("boom"), {
        status: 400,
        body: { error: "InvalidInput", message: "Host not allowed: example.com." },
      })
    );
    const res = await createArticleAction(PROJECT, "poste-1", { name: "Spot" });
    expect(res).toMatchObject({ ok: false, error: expect.stringContaining("lien https") });
  });

  it("explains a name clash rather than echoing a status code", async () => {
    api.createUnit.mockRejectedValue(Object.assign(new Error("boom"), { status: 409, body: null }));
    const res = await createUnitAction(PROJECT, "u");
    // 409 covers units, rooms and shops, so the fallback names none of them.
    expect(res).toEqual({ ok: false, error: "Ce nom est déjà utilisé." });
  });

  it("explains a permission failure in the user's terms", async () => {
    api.selectQuote.mockRejectedValue(Object.assign(new Error("boom"), { status: 403, body: null }));
    const res = await selectQuoteAction(PROJECT, "q1");
    expect(res).toEqual({ ok: false, error: "Vous n'avez pas l'autorisation de modifier ce chiffrage." });
  });

  it("reports a vanished item instead of failing silently", async () => {
    api.reorderArticle.mockRejectedValue(Object.assign(new Error("boom"), { status: 404, body: null }));
    const res = await reorderArticleAction(PROJECT, "a1", { before_id: "a2", after_id: null });
    expect(res).toEqual({ ok: false, error: "Cet élément n'existe plus." });
  });

  it("forwards the drop neighbours untouched", async () => {
    api.reorderArticle.mockResolvedValue({ id: "a1", position: 1500 });
    await reorderArticleAction(PROJECT, "a1", { before_id: "a2", after_id: "a3" });

    expect(api.reorderArticle).toHaveBeenCalledWith(PROJECT, "a1", {
      before_id: "a2",
      after_id: "a3",
    });
  });

  it("never throws, so an optimistic reorder can always revert", async () => {
    api.reorderArticle.mockRejectedValue(new Error("network down"));
    await expect(reorderArticleAction(PROJECT, "a1", {})).resolves.toMatchObject({ ok: false });
  });
});

describe("room and shop actions", () => {
  it("forwards a room's new neighbours to the reorder endpoint", async () => {
    api.reorderRoom.mockResolvedValue({ id: "r2", name: "Cuisine", position: 500 });
    const res = await reorderRoomAction(PROJECT, "r2", { before_id: null, after_id: "r1" });

    expect(api.reorderRoom).toHaveBeenCalledWith(PROJECT, "r2", { before_id: null, after_id: "r1" });
    expect(res).toEqual({ ok: true, data: { id: "r2", name: "Cuisine", position: 500 } });
  });

  it("never throws on a failed room move, so the page can put the order back", async () => {
    api.reorderRoom.mockRejectedValue(Object.assign(new Error("boom"), { status: 404, body: null }));
    const res = await reorderRoomAction(PROJECT, "r2", { before_id: "r1", after_id: null });
    expect(res).toEqual({ ok: false, error: "Cet élément n'existe plus." });
  });

  it("sends a shop's cleared address as null so the backend clears it", async () => {
    api.updateStore.mockResolvedValue({ id: "s1" });
    await updateStoreAction(PROJECT, "s1", { name: "Point P", address: null, website_url: null });
    expect(api.updateStore).toHaveBeenCalledWith(PROJECT, "s1", {
      name: "Point P",
      address: null,
      website_url: null,
    });
  });

  it("surfaces the backend's reason when a shop cannot be deleted", async () => {
    api.deleteStore.mockRejectedValue(
      Object.assign(new Error("Failed to delete store (HTTP 403)"), {
        status: 403,
        body: null,
      })
    );
    const res = await deleteStoreAction(PROJECT, "s1");
    expect(res).toEqual({ ok: false, error: "Vous n'avez pas l'autorisation de modifier ce chiffrage." });
  });
});
