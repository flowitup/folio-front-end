/**
 * Helpers that keep a long chiffrage readable: a search and status filter,
 * and sub-groups taken from a "[Group]" tag at the start of an article note
 * (e.g. "[Câbles & gaines] Réf. LM 70808794 …").
 */

import type { ChiffrageArticle, ChiffragePhase, ChiffragePoste } from "@/lib/api/chiffrage";

export type ListStatus = "all" | "toBuy" | "bought" | "unpriced";

export interface ListFilter {
  query: string;
  status: ListStatus;
  /**
   * Show only the n-th stage (0-based) of every poste, or every stage when
   * null. Stages are per poste, so "GĐ2" is each poste's second stage.
   */
  stage?: number | null;
}

export const NO_FILTER: ListFilter = { query: "", status: "all", stage: null };

/** Each stage id mapped to its rank inside its own poste. */
export type PhaseRanks = ReadonlyMap<string, number>;

const NO_RANKS: PhaseRanks = new Map();

export function phaseRanks(postes: ChiffragePoste[]): PhaseRanks {
  const ranks = new Map<string, number>();
  for (const p of postes) (p.phases ?? []).forEach((ph, i) => ranks.set(ph.id, i));
  return ranks;
}

/**
 * The stage filter's choices: one per rank up to the longest list of stages,
 * each with the names the postes give that stage (for a tooltip).
 */
export function stageChoices(postes: ChiffragePoste[]): string[][] {
  const out: string[][] = [];
  for (const p of postes) {
    (p.phases ?? []).forEach((ph, i) => {
      out[i] ??= [];
      if (!out[i].includes(ph.name)) out[i].push(ph.name);
    });
  }
  return out;
}

export interface PhaseBucket {
  /** null: the items not assigned to one of the poste's stages. */
  phase: ChiffragePhase | null;
  /** Rank of the stage inside the poste; null for the unassigned bucket. */
  rank: number | null;
  articles: ChiffrageArticle[];
}

/**
 * A poste's articles split by stage, in the poste's stage order, empty stages
 * included, then the unassigned ones (only if there are any). A poste without
 * stages gives one unassigned bucket holding everything. Matches the order of
 * the backend's phase_subtotals.
 */
export function byPhase(poste: ChiffragePoste): PhaseBucket[] {
  const phases = poste.phases ?? [];
  const known = new Set(phases.map((p) => p.id));
  const buckets: PhaseBucket[] = phases.map((phase, rank) => ({
    phase,
    rank,
    articles: poste.articles.filter((a) => a.phase_id === phase.id),
  }));
  const rest = poste.articles.filter((a) => !a.phase_id || !known.has(a.phase_id));
  if (phases.length === 0 || rest.length > 0) buckets.push({ phase: null, rank: null, articles: rest });
  return buckets;
}

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
  return filter.status !== "all" || filter.query.trim() !== "" || (filter.stage ?? null) !== null;
}

export function matchesFilter(
  a: ChiffrageArticle,
  filter: ListFilter,
  ranks: PhaseRanks = NO_RANKS,
): boolean {
  const stage = filter.stage ?? null;
  if (stage !== null && (!a.phase_id || ranks.get(a.phase_id) !== stage)) return false;
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
