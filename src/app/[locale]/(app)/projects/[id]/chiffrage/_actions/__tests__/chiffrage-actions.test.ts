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
};
vi.mock("@/lib/api/chiffrage", () => api);

const {
  createPosteAction,
  createArticleAction,
  createUnitAction,
  reorderArticleAction,
  selectQuoteAction,
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

  it("surfaces the backend's own message so the user can act on it", async () => {
    api.createArticle.mockRejectedValue(
      Object.assign(new Error("Failed to create article (HTTP 400)"), {
        status: 400,
        body: { message: "Unknown unit 'parsec' for this project." },
      })
    );

    const res = await createArticleAction(PROJECT, "poste-1", { name: "Bad", unit: "parsec" });
    expect(res).toEqual({ ok: false, error: "Unknown unit 'parsec' for this project." });
  });

  it("explains a name clash rather than echoing a status code", async () => {
    api.createUnit.mockRejectedValue(Object.assign(new Error("boom"), { status: 409, body: null }));
    const res = await createUnitAction(PROJECT, "u");
    // 409 covers units, rooms and shops, so the fallback names none of them.
    expect(res).toEqual({ ok: false, error: "That name is already taken." });
  });

  it("explains a permission failure in the user's terms", async () => {
    api.selectQuote.mockRejectedValue(Object.assign(new Error("boom"), { status: 403, body: null }));
    const res = await selectQuoteAction(PROJECT, "q1");
    expect(res).toEqual({ ok: false, error: "You do not have permission to modify this chiffrage." });
  });

  it("reports a vanished item instead of failing silently", async () => {
    api.reorderArticle.mockRejectedValue(Object.assign(new Error("boom"), { status: 404, body: null }));
    const res = await reorderArticleAction(PROJECT, "a1", { before_id: "a2", after_id: null });
    expect(res).toEqual({ ok: false, error: "This item no longer exists." });
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
