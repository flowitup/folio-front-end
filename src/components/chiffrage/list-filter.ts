/**
 * Helpers that keep a long chiffrage readable: a search and status filter,
 * and sub-groups taken from a "[Group]" tag at the start of an article note
 * (e.g. "[Câbles & gaines] Réf. LM 70808794 …").
 */

import type { ChiffrageArticle } from "@/lib/api/chiffrage";

export type ListStatus = "all" | "toBuy" | "bought" | "unpriced";

export interface ListFilter {
  query: string;
  status: ListStatus;
}

export const NO_FILTER: ListFilter = { query: "", status: "all" };

const TAG = /^\s*\[([^\]\n]{1,60})\]\s*/;

/** The "[Group]" a note starts with, and the note without it. */
export function noteGroup(note: string | null | undefined): { group: string | null; rest: string } {
  if (!note) return { group: null, rest: "" };
  const m = TAG.exec(note);
  if (!m) return { group: null, rest: note };
  return { group: m[1].trim() || null, rest: note.slice(m[0].length) };
}

/** Lower-case, accent-free text, so "cable" finds "Câble". */
export function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
}

export function isFiltering(filter: ListFilter): boolean {
  return filter.status !== "all" || filter.query.trim() !== "";
}

export function matchesFilter(a: ChiffrageArticle, filter: ListFilter): boolean {
  if (filter.status === "toBuy" && a.purchased) return false;
  if (filter.status === "bought" && !a.purchased) return false;
  if (filter.status === "unpriced" && a.effective_source !== "none") return false;
  const q = fold(filter.query.trim());
  if (!q) return true;
  const hay = fold(`${a.name} ${a.note ?? ""}`);
  // Every word must appear, in any order: "gaine 20" finds "Gaine préfilée Ø20".
  return q.split(/\s+/).every((w) => hay.includes(w));
}

/**
 * Order articles so each "[Group]" is contiguous: groups keep the order of
 * their first article, untagged articles come first, and positions are kept
 * inside a group. Stable for lists without tags.
 */
export function orderByGroup(articles: ChiffrageArticle[]): ChiffrageArticle[] {
  const rank = new Map<string, number>();
  for (const a of articles) {
    const g = noteGroup(a.note).group;
    if (g !== null && !rank.has(g)) rank.set(g, rank.size);
  }
  if (rank.size === 0) return articles;
  const r = (a: ChiffrageArticle) => {
    const g = noteGroup(a.note).group;
    return g === null ? -1 : (rank.get(g) as number);
  };
  return articles
    .map((a, i) => ({ a, i }))
    .sort((x, y) => r(x.a) - r(y.a) || x.i - y.i)
    .map((x) => x.a);
}

/** Bought count and TTC/HT sums of a set of articles, for a group heading. */
export function groupStats(articles: ChiffrageArticle[]) {
  return {
    count: articles.length,
    bought: articles.filter((a) => a.purchased).length,
    ht: articles.reduce((s, a) => s + a.total_ht, 0),
    ttc: articles.reduce((s, a) => s + a.total_ttc, 0),
  };
}
