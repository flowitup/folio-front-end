"use client";

/**
 * Chiffrage page shell: postes -> articles -> quotes, totals, and the
 * provisioning table.
 *
 * Server truth is authoritative for every total. Reordering applies an
 * optimistic local swap for responsiveness, then re-fetches; on failure the
 * previous order is restored rather than left silently diverged from the DB.
 *
 * Rooms and shops are project-level lists managed from their own dialogs:
 * every poste groups its items by the room order, and every price points at
 * one of the shops.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useConfirmDialog } from "@/components/chiffrage/use-confirm-dialog";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { DoorOpen, LayoutTemplate, Plus, Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ArticleRow } from "@/components/chiffrage/article-row";
import { ArticleFormDialog } from "@/components/chiffrage/article-form-dialog";
import { ChiffrageTotals } from "@/components/chiffrage/chiffrage-totals";
import { PosteCard } from "@/components/chiffrage/poste-card";
import { RoomHeading } from "@/components/chiffrage/room-heading";
import { GroupHeading } from "@/components/chiffrage/group-heading";
import { PhaseHeading } from "@/components/chiffrage/phase-heading";
import { ListToolbar } from "@/components/chiffrage/list-toolbar";
import {
  NO_FILTER,
  byPhase,
  groupStats,
  isFiltering,
  matchesFilter,
  noteGroup,
  orderByGroup,
  phaseRanks,
  stageChoices,
  type ListFilter,
} from "@/components/chiffrage/list-filter";
import { ArticleImageDialog } from "@/components/chiffrage/article-image-dialog";
import { SectionCompareDialog } from "@/components/chiffrage/section-compare-dialog";
import { PosteFormDialog } from "@/components/chiffrage/poste-form-dialog";
import { PosteTemplatesDialog } from "@/components/chiffrage/poste-templates-dialog";
import { ShoppingList } from "@/components/chiffrage/shopping-list";
import { RoomsDialog, type NamedListLabels } from "@/components/chiffrage/rooms-dialog";
import { SortableItem } from "@/components/chiffrage/sortable-item";
import { StoreFormDialog } from "@/components/chiffrage/store-form-dialog";
import { StoresDialog } from "@/components/chiffrage/stores-dialog";
import { neighboursAfterMove, planArticleDrop, planMove } from "@/components/chiffrage/reorder";
import { hasComparablePrices } from "@/components/chiffrage/compare-lines";
import {
  QuoteFormDialog,
  type QuoteFormValues,
} from "@/components/chiffrage/quote-form-dialog";
import {
  createArticleAction,
  createPhaseAction,
  createPosteAction,
  createRoomAction,
  createStoreAction,
  deleteArticleImageAction,
  createQuoteAction,
  createUnitAction,
  deleteUnitAction,
  deleteArticleAction,
  deletePhaseAction,
  deletePosteAction,
  deleteRoomAction,
  deleteStoreAction,
  deleteQuoteAction,
  getChiffrageAction,
  reorderArticleAction,
  reorderPhaseAction,
  reorderPosteAction,
  reorderRoomAction,
  selectQuoteAction,
  unselectQuoteAction,
  updateArticleAction,
  updatePhaseAction,
  updatePosteAction,
  updateRoomAction,
  updateStoreAction,
  setArticleImageFromUrlAction,
  uploadArticleImageAction,
  updateQuoteAction,
} from "./_actions/chiffrage-actions";
import type {
  ArticlePayload,
  ChiffrageArticle,
  ChiffragePhase,
  ChiffragePoste,
  ChiffrageQuote,
  ChiffrageRoom,
  ChiffrageStore,
  ChiffrageTree,
  ChiffrageUnit,
} from "@/lib/api/chiffrage";

interface Props {
  projectId: string;
  canManage: boolean;
  /** Company owning the project, or null — gates the bibliothèque picker. */
  companyId: string | null;
  initialTree: ChiffrageTree;
  initialUnits: ChiffrageUnit[];
  /** The tree could not be loaded: show an error with a retry, not an empty budget. */
  loadFailed?: boolean;
}

export function ChiffragePageClient({
  projectId,
  canManage,
  companyId,
  initialTree,
  initialUnits,
  loadFailed = false,
}: Props) {
  const t = useTranslations("chiffrage");
  const { ask, dialog: confirmDialog } = useConfirmDialog();
  const router = useRouter();
  const [tree, setTree] = useState(initialTree);
  const [units, setUnits] = useState(initialUnits);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Postes and "[Group]" sub-groups folded by the reader, remembered per
  // project in this browser so a long chiffrage reopens the way it was left.
  const [collapsedPostes, setCollapsedPostes] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<ListFilter>(NO_FILTER);
  const foldKey = `folio.chiffrage.fold.${projectId}`;
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(foldKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as { postes?: string[]; groups?: string[] };
      setCollapsedPostes(new Set(saved.postes ?? []));
      setCollapsedGroups(new Set(saved.groups ?? []));
    } catch {
      // storage blocked or corrupt: start unfolded
    }
  }, [foldKey]);
  const saveFold = (postes: Set<string>, groups: Set<string>) => {
    try {
      window.localStorage.setItem(foldKey, JSON.stringify({ postes: [...postes], groups: [...groups] }));
    } catch {
      // storage blocked: the folding lasts for this visit only
    }
  };
  // The section whose head-to-head shop comparison modal is open, if any.
  const [compareDialog, setCompareDialog] = useState<{
    open: boolean;
    poste: ChiffragePoste | null;
  }>({ open: false, poste: null });
  const [submitting, setSubmitting] = useState(false);
  const [busyQuoteId, setBusyQuoteId] = useState<string | null>(null);

  const [posteDialog, setPosteDialog] = useState<{
    open: boolean;
    poste: ChiffragePoste | null;
  }>({
    open: false,
    poste: null,
  });
  const [articleDialog, setArticleDialog] = useState<{
    open: boolean;
    posteId: string | null;
    article: ChiffrageArticle | null;
  }>({ open: false, posteId: null, article: null });
  const [imageDialog, setImageDialog] = useState<{
    open: boolean;
    article: ChiffrageArticle | null;
  }>({ open: false, article: null });
  // Blob URLs are cached per image_ref; bumping this forces a refetch after a
  // change, since the ref itself may be unchanged (same article id).
  const [imageVersion, setImageVersion] = useState(0);
  const [quoteDialog, setQuoteDialog] = useState<{
    open: boolean;
    articleId: string | null;
    quote: ChiffrageQuote | null;
  }>({ open: false, articleId: null, quote: null });
  const [view, setView] = useState<"budget" | "shopping">("budget");
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [busyArticleIds, setBusyArticleIds] = useState<Set<string>>(new Set());
  const [roomsOpen, setRoomsOpen] = useState(false);
  // The poste whose stages (giai đoạn) dialog is open, if any.
  const [phasesFor, setPhasesFor] = useState<string | null>(null);
  const [storesOpen, setStoresOpen] = useState(false);
  const [storeForm, setStoreForm] = useState<{
    open: boolean;
    store: ChiffrageStore | null;
  }>({ open: false, store: null });

  // dnd-kit's distance constraint is what keeps a click on a row button from
  // being swallowed as the start of a drag.
  const sensors = useSensors(
    // Mouse and touch separately (as on the planning board): PointerSensor
    // never started on a phone, the browser took the gesture for scrolling.
    // A short press picks a row up on touch, so a plain swipe still scrolls.
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const refresh = useCallback(async () => {
    const res = await getChiffrageAction(projectId);
    if (res.ok) setTree(res.data);
    return res.ok;
  }, [projectId]);

  const toggle = (articleId: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(articleId)) next.delete(articleId);
      else next.add(articleId);
      return next;
    });

  const toggleCollapse = (posteId: string) => {
    const next = new Set(collapsedPostes);
    if (next.has(posteId)) next.delete(posteId);
    else next.add(posteId);
    setCollapsedPostes(next);
    saveFold(next, collapsedGroups);
  };

  const toggleGroup = (key: string) => {
    const next = new Set(collapsedGroups);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setCollapsedGroups(next);
    saveFold(collapsedPostes, next);
  };

  const filtering = isFiltering(filter);
  const ranks = useMemo(() => phaseRanks(tree.postes), [tree.postes]);
  const stages = useMemo(() => stageChoices(tree.postes), [tree.postes]);
  const matches = (a: ChiffrageArticle) => matchesFilter(a, filter, ranks);
  const allArticles = tree.postes.flatMap((p) => p.articles);
  const shownCount = filtering ? allArticles.filter(matches).length : allArticles.length;
  // A stage filter left over from stages that were since deleted would hide everything.
  useEffect(() => {
    if (filter.stage != null && filter.stage >= stages.length) setFilter((f) => ({ ...f, stage: null }));
  }, [filter.stage, stages.length]);

  /** Fold every section (or open them all, with their sub-groups). */
  const foldAll = (fold: boolean) => {
    const postes = fold ? new Set(tree.postes.map((p) => p.id)) : new Set<string>();
    const groups = new Set<string>();
    setCollapsedPostes(postes);
    setCollapsedGroups(groups);
    saveFold(postes, groups);
  };

  /** Run a mutation, surface its error, and re-sync from server truth. */
  const mutate = useCallback(
    async (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
      setSubmitting(true);
      try {
        const res = await fn();
        if (!res.ok) toast.error(res.error);
        else await refresh();
        return res.ok;
      } catch {
        // A rejected server action (e.g. a request the server refused before
        // the action ran) must still surface and release the form.
        toast.error(t("actionFailed"));
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [refresh, t],
  );

  /**
   * Lay a poste's articles out stage by stage (giai đoạn), then room by room.
   * Stages follow the poste's own order and the unassigned lines come last;
   * rooms follow the project's declared order and unassigned items come last.
   * Both match how the backend orders phase_subtotals and room_subtotals — the
   * two must agree or a heading would show one bucket's figure above another
   * bucket's items.
   *
   * Inside a room, articles whose note starts with "[Group]" are gathered
   * under a foldable group heading. Stage headings only show when the poste
   * has stages, and room headings only when some article of the section has a
   * room ("Unassigned" over everything says nothing). While a search, status
   * or stage filter is on, only matching lines show and every fold is opened.
   */
  const byRoom = (poste: ChiffragePoste) => {
    const rank = new Map(tree.rooms.map((r, i) => [r.id, i]));
    const showPhases = (poste.phases ?? []).length > 0;
    const showRooms = poste.articles.some((a) => a.room_id !== null);
    type Row =
      | {
          kind: "phase";
          key: string;
          phase: ChiffragePhase | null;
          rank: number | null;
          collapsed: boolean;
        }
      | { kind: "heading"; key: string; roomId: string | null }
      | {
          kind: "group";
          key: string;
          name: string;
          collapsed: boolean;
          stats: ReturnType<typeof groupStats>;
        }
      | { kind: "article"; article: ChiffrageArticle };
    const rows: Row[] = [];
    const sorted: ChiffrageArticle[] = [];
    for (const bucket of byPhase(poste)) {
      if (filtering && !bucket.articles.some(matches)) continue;
      const phaseKey = `${poste.id}|phase|${bucket.phase?.id ?? "none"}`;
      if (showPhases) {
        const folded = !filtering && collapsedGroups.has(phaseKey);
        rows.push({ kind: "phase", key: phaseKey, phase: bucket.phase, rank: bucket.rank, collapsed: folded });
        if (folded) continue;
      }
      const byPosition = [...bucket.articles].sort((a, b) => {
        const ra = a.room_id === null ? Number.MAX_SAFE_INTEGER : (rank.get(a.room_id) ?? rank.size);
        const rb = b.room_id === null ? Number.MAX_SAFE_INTEGER : (rank.get(b.room_id) ?? rank.size);
        return ra === rb ? a.position - b.position : ra - rb;
      });
      const runs: { roomId: string | null; articles: ChiffrageArticle[] }[] = [];
      for (const a of byPosition) {
        const last = runs[runs.length - 1];
        if (last && last.roomId === a.room_id) last.articles.push(a);
        else runs.push({ roomId: a.room_id, articles: [a] });
      }
      const phasePart = showPhases ? `${bucket.phase?.id ?? "none"}|` : "";
      for (const run of runs) {
        const ordered = orderByGroup(run.articles);
        const visible = filtering ? ordered.filter(matches) : ordered;
        if (visible.length === 0) continue;
        if (showRooms)
          rows.push({ kind: "heading", key: `h-${phasePart}${run.roomId ?? "none"}`, roomId: run.roomId });
        let current: string | null = null;
        let collapsed = false;
        for (const article of ordered) {
          const group = noteGroup(article.note).group;
          if (group !== current) {
            current = group;
            collapsed = false;
            if (group !== null) {
              // Without stages the key keeps its old shape, so folds saved before stages existed still apply.
              const key = `${poste.id}|${phasePart}${run.roomId ?? ""}|${group}`;
              const members = ordered.filter((a) => noteGroup(a.note).group === group);
              if (!filtering || members.some(matches)) {
                collapsed = !filtering && collapsedGroups.has(key);
                rows.push({ kind: "group", key, name: group, collapsed, stats: groupStats(members) });
              }
            }
          }
          if (collapsed) continue;
          if (filtering && !matches(article)) continue;
          rows.push({ kind: "article", article });
          sorted.push(article);
        }
      }
    }
    return { sorted, rows, shown: filtering ? poste.articles.filter(matches).length : poste.articles.length };
  };

  /** Tick or untick an article as bought; a new tick starts at the planned quantity. */
  const savePurchase = async (article: ChiffrageArticle, payload: ArticlePayload) => {
    setBusyArticleIds((prev) => new Set(prev).add(article.id));
    try {
      const res = await updateArticleAction(projectId, article.id, payload);
      if (!res.ok) toast.error(res.error);
      else await refresh();
    } catch {
      toast.error(t("actionFailed"));
    } finally {
      setBusyArticleIds((prev) => {
        const next = new Set(prev);
        next.delete(article.id);
        return next;
      });
    }
  };

  const togglePurchased = (article: ChiffrageArticle, purchased: boolean) =>
    savePurchase(article, { purchased });

  const createFromTemplates = async (names: string[]) => {
    setSubmitting(true);
    try {
      let failed = false;
      // One at a time so the sections keep the order they were ticked in.
      for (const name of names) {
        const res = await createPosteAction(projectId, { name });
        if (!res.ok) {
          toast.error(res.error);
          failed = true;
          break;
        }
      }
      await refresh();
      if (!failed) setTemplatesOpen(false);
    } catch {
      toast.error(t("actionFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const addStore = async (name: string): Promise<ChiffrageStore | null> => {
    const res = await createStoreAction(projectId, { name });
    if (!res.ok) {
      toast.error(res.error);
      return null;
    }
    // Shops live on the tree, so extend it rather than keeping a second copy.
    setTree((prev) => ({ ...prev, stores: [...prev.stores, res.data] }));
    return res.data;
  };

  const addRoom = async (name: string): Promise<ChiffrageRoom | null> => {
    const res = await createRoomAction(projectId, name);
    if (!res.ok) {
      toast.error(res.error);
      return null;
    }
    // Rooms live on the tree, so extend it rather than keeping a second copy.
    setTree((prev) => ({ ...prev, rooms: [...prev.rooms, res.data] }));
    return res.data;
  };

  /** Add a stage to a poste; stages live on the tree, so it is re-read. */
  const addPhase = async (posteId: string, name: string): Promise<ChiffragePhase | null> => {
    const res = await createPhaseAction(projectId, posteId, name);
    if (!res.ok) {
      toast.error(res.error);
      return null;
    }
    await refresh();
    return res.data;
  };

  /** Move a stage of one poste into the slot another holds; optimistic like the rooms. */
  const reorderPhase = async (posteId: string, phaseId: string, overId: string) => {
    const poste = tree.postes.find((p) => p.id === posteId);
    const plan = poste ? planMove(poste.phases ?? [], phaseId, overId) : null;
    if (!poste || !plan) return true;
    const setPhases = (phases: ChiffragePhase[]) =>
      setTree((prev) => ({
        ...prev,
        postes: prev.postes.map((p) => (p.id === posteId ? { ...p, phases } : p)),
      }));
    const previous = poste.phases ?? [];
    setPhases(plan.items);
    const res = await reorderPhaseAction(projectId, phaseId, plan.move);
    if (!res.ok) {
      setPhases(previous);
      toast.error(res.error);
      return false;
    }
    await refresh();
    return true;
  };

  const phaseLabels: NamedListLabels = {
    title: t("phases"),
    hint: t("phasesDialogHint"),
    empty: t("noPhasesYet"),
    name: t("phaseName"),
    rename: t("renamePhase"),
    remove: t("deletePhase"),
    confirmRemove: (name) => t("confirmDeletePhase", { name }),
    addPlaceholder: t("addPhasePlaceholder"),
    add: t("addPhase"),
  };

  const addUnit = async (symbol: string): Promise<ChiffrageUnit | null> => {
    const res = await createUnitAction(projectId, symbol);
    if (!res.ok) {
      toast.error(res.error);
      return null;
    }
    setUnits((prev) => [...prev, res.data]);
    return res.data;
  };

  const removeUnit = async (unit: ChiffrageUnit): Promise<boolean> => {
    if (!unit.id) return false;
    const res = await deleteUnitAction(projectId, unit.id);
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    setUnits((prev) => prev.filter((u) => u.id !== unit.id));
    return true;
  };

  /**
   * Move a room into the slot another one holds. Optimistic, so the room
   * headings of every poste follow at once; on failure only the room order is
   * put back, leaving anything else that changed meanwhile alone.
   */
  const reorderRoom = async (roomId: string, overId: string) => {
    const plan = planMove(tree.rooms, roomId, overId);
    if (!plan) return true;
    const previous = tree.rooms;
    setTree((prev) => ({ ...prev, rooms: plan.items }));
    const res = await reorderRoomAction(projectId, roomId, plan.move);
    if (!res.ok) {
      setTree((prev) => ({ ...prev, rooms: previous }));
      toast.error(res.error);
      return false;
    }
    await refresh();
    return true;
  };

  const onDragEndPostes = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const move = neighboursAfterMove(
      tree.postes,
      String(active.id),
      String(over.id),
    );
    if (!move) return;
    const previous = tree;
    // Optimistic: reorder locally so the card follows the cursor immediately.
    setTree((prev) => {
      const from = prev.postes.findIndex((p) => p.id === active.id);
      const to = prev.postes.findIndex((p) => p.id === over.id);
      const postes = [...prev.postes];
      const [moved] = postes.splice(from, 1);
      postes.splice(to, 0, moved);
      return { ...prev, postes };
    });
    const res = await reorderPosteAction(projectId, String(active.id), move);
    if (!res.ok) {
      setTree(previous);
      toast.error(res.error);
      return;
    }
    await refresh();
  };

  const onDragEndArticles = async (
    poste: ChiffragePoste,
    event: DragEndEvent,
  ) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const drop = planArticleDrop(poste.articles, String(active.id), String(over.id));
    if (!drop) return;
    if (drop.kind === "otherPhase") {
      toast.info(t("dragOtherPhase"));
      return;
    }
    if (drop.kind === "otherRoom") {
      toast.info(t("dragOtherRoom"));
      return;
    }
    const { move, optimisticPosition } = drop;
    const movingId = String(active.id);
    const previous = tree;
    setTree((prev) => ({
      ...prev,
      postes: prev.postes.map((p) =>
        p.id !== poste.id
          ? p
          : {
              ...p,
              articles: p.articles.map((a) =>
                a.id === movingId ? { ...a, position: optimisticPosition } : a,
              ),
            },
      ),
    }));
    const res = await reorderArticleAction(projectId, movingId, move);
    if (!res.ok) {
      setTree(previous);
      toast.error(res.error);
      return;
    }
    await refresh();
  };

  const posteIds = useMemo(() => tree.postes.map((p) => p.id), [tree.postes]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        {canManage && !loadFailed ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRoomsOpen(true)}
            >
              <DoorOpen className="mr-1 h-4 w-4" />
              {t("rooms")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setStoresOpen(true)}
            >
              <Store className="mr-1 h-4 w-4" />
              {t("stores")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setTemplatesOpen(true)}
            >
              <LayoutTemplate className="mr-1 h-4 w-4" />
              {t("templates")}
            </Button>
            <Button
              type="button"
              onClick={() => setPosteDialog({ open: true, poste: null })}
            >
              <Plus className="mr-1 h-4 w-4" />
              {t("newPoste")}
            </Button>
          </div>
        ) : null}
      </div>

      {loadFailed ? (
        <div role="alert" className="rounded-lg border border-dashed p-10 text-center">
          <p className="font-medium">{t("loadFailedTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("loadFailedHint")}</p>
          <Button type="button" variant="outline" className="mt-4" onClick={() => router.refresh()}>
            {t("retry")}
          </Button>
        </div>
      ) : (
        <ChiffrageTotals tree={tree} />
      )}

      {loadFailed ? null : (
        <div className="inline-flex rounded-md border p-0.5 print:hidden" role="tablist">
          {(["budget", "shopping"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              className={`rounded px-3 py-1 text-sm ${
                view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
              onClick={() => setView(v)}
            >
              {t(v === "budget" ? "viewBudget" : "viewShopping")}
            </button>
          ))}
        </div>
      )}

      {!loadFailed && tree.postes.length > 0 ? (
        <ListToolbar
          filter={filter}
          onChange={setFilter}
          shown={shownCount}
          total={allArticles.length}
          stages={stages}
          onCollapseAll={() => foldAll(true)}
          onExpandAll={() => foldAll(false)}
        />
      ) : null}

      {/* Say why the page cannot be edited, and who can change that. */}
      {!canManage && !loadFailed ? (
        <p className="text-sm text-muted-foreground" data-testid="chiffrage-read-only">
          {t("readOnlyHint")}
        </p>
      ) : null}

      {loadFailed ? null : view === "shopping" && tree.postes.length > 0 ? (
        <ShoppingList
          tree={tree}
          projectId={projectId}
          filter={filter}
          collapsedPostes={collapsedPostes}
          onToggleCollapse={toggleCollapse}
          collapsedGroups={collapsedGroups}
          onToggleGroup={toggleGroup}
          imageVersion={imageVersion}
          canManage={canManage}
          busyIds={busyArticleIds}
          onTogglePurchased={togglePurchased}
          onSetQuantities={(article, change) => savePurchase(article, change)}
        />
      ) : filtering && shownCount === 0 && tree.postes.length > 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground" data-testid="no-match">
          {t("noMatch")}
        </p>
      ) : tree.postes.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="font-medium">{t("emptyTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {canManage ? t("emptyHint") : t("emptyHintReadOnly")}
          </p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEndPostes}
        >
          <SortableContext
            items={posteIds}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-4">
              {tree.postes.map((poste) => {
                const layout = byRoom(poste);
                // A filter hides the sections it leaves empty.
                if (filtering && layout.shown === 0) return null;
                return (
                <SortableItem
                  key={poste.id}
                  id={poste.id}
                  handleLabel={t("moveItem", { name: poste.name })}
                >
                  {(handle) => (
                    <PosteCard
                      poste={poste}
                      canManage={canManage}
                      dragHandle={canManage && !filtering ? handle : undefined}
                      collapsed={!filtering && collapsedPostes.has(poste.id)}
                      onToggleCollapse={() => toggleCollapse(poste.id)}
                      canCompare={hasComparablePrices(poste)}
                      onCompare={() =>
                        setCompareDialog({ open: true, poste })
                      }
                      onEdit={() => setPosteDialog({ open: true, poste })}
                      onManagePhases={() => setPhasesFor(poste.id)}
                      onDelete={async () => {
                        if (
                          await ask(t("confirmDeletePoste", { name: poste.name }))
                        ) {
                          void mutate(() =>
                            deletePosteAction(projectId, poste.id),
                          );
                        }
                      }}
                      onAddArticle={() =>
                        setArticleDialog({
                          open: true,
                          posteId: poste.id,
                          article: null,
                        })
                      }
                    >
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={(e) => void onDragEndArticles(poste, e)}
                      >
                        <SortableContext
                          items={layout.sorted.map((a) => a.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {layout.rows.map((row) =>
                            row.kind === "phase" ? (
                              <PhaseHeading
                                key={row.key}
                                name={row.phase?.name ?? null}
                                rank={row.rank === null ? null : row.rank + 1}
                                subtotal={(poste.phase_subtotals ?? []).find(
                                  (s) => s.phase_id === (row.phase?.id ?? null),
                                )}
                                amount="ht"
                                collapsed={row.collapsed}
                                onToggle={() => toggleGroup(row.key)}
                              />
                            ) : row.kind === "group" ? (
                              <GroupHeading
                                key={row.key}
                                name={row.name}
                                count={row.stats.count}
                                bought={row.stats.bought}
                                amount={row.stats.ht}
                                collapsed={row.collapsed}
                                onToggle={() => toggleGroup(row.key)}
                              />
                            ) : row.kind === "heading" ? (
                              <RoomHeading
                                key={row.key}
                                name={
                                  tree.rooms.find((r) => r.id === row.roomId)
                                    ?.name ?? null
                                }
                                subtotal={poste.room_subtotals.find(
                                  (s) => s.room_id === row.roomId,
                                )}
                              />
                            ) : (
                            <SortableItem
                              key={row.article.id}
                              id={row.article.id}
                              handleLabel={t("moveItem", { name: row.article.name })}
                            >
                              {(articleHandle) => {
                                const article = row.article;
                                return (
                                <ArticleRow
                                  projectId={projectId}
                                  stores={tree.stores}
                                  imageVersion={imageVersion}
                                  onManageImage={() => setImageDialog({ open: true, article })}
                                  article={article}
                                  canManage={canManage}
                                  expanded={expanded.has(article.id)}
                                  busyQuoteId={busyQuoteId}
                                  dragHandle={
                                    canManage && !filtering ? articleHandle : undefined
                                  }
                                  onToggle={() => toggle(article.id)}
                                  onEdit={() =>
                                    setArticleDialog({
                                      open: true,
                                      posteId: poste.id,
                                      article,
                                    })
                                  }
                                  onDelete={async () => {
                                    if (
                                      await ask(
                                        t("confirmDeleteArticle", {
                                          name: article.name,
                                        }),
                                      )
                                    ) {
                                      void mutate(() =>
                                        deleteArticleAction(
                                          projectId,
                                          article.id,
                                        ),
                                      );
                                    }
                                  }}
                                  onAddQuote={() => {
                                    setExpanded((p) =>
                                      new Set(p).add(article.id),
                                    );
                                    setQuoteDialog({
                                      open: true,
                                      articleId: article.id,
                                      quote: null,
                                    });
                                  }}
                                  onSelectQuote={async (q) => {
                                    setBusyQuoteId(q.id);
                                    const res = await selectQuoteAction(
                                      projectId,
                                      q.id,
                                    );
                                    if (!res.ok) toast.error(res.error);
                                    else await refresh();
                                    setBusyQuoteId(null);
                                  }}
                                  onUnselectQuote={async (q) => {
                                    setBusyQuoteId(q.id);
                                    const res = await unselectQuoteAction(
                                      projectId,
                                      q.id,
                                    );
                                    if (!res.ok) toast.error(res.error);
                                    else await refresh();
                                    setBusyQuoteId(null);
                                  }}
                                  onEditQuote={(q) =>
                                    setQuoteDialog({
                                      open: true,
                                      articleId: article.id,
                                      quote: q,
                                    })
                                  }
                                  onDeleteQuote={async (q) => {
                                    if (await ask(t("confirmDeleteQuote"))) {
                                      void mutate(() =>
                                        deleteQuoteAction(projectId, q.id),
                                      );
                                    }
                                  }}
                                />
                              );
                              }}
                            </SortableItem>
                            ),
                          )}
                        </SortableContext>
                      </DndContext>
                    </PosteCard>
                  )}
                </SortableItem>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {compareDialog.open && compareDialog.poste ? (
        <SectionCompareDialog
          key={compareDialog.poste.id}
          open
          poste={compareDialog.poste}
          stores={tree.stores}
          onOpenChange={(open) =>
            setCompareDialog((prev) => ({ ...prev, open }))
          }
        />
      ) : null}

      {roomsOpen ? (
        <RoomsDialog
          open
          rooms={tree.rooms}
          onOpenChange={setRoomsOpen}
          onCreate={async (name) => (await addRoom(name)) !== null}
          onRename={(room, name) =>
            mutate(() => updateRoomAction(projectId, room.id, name))
          }
          onDelete={(room) =>
            mutate(() => deleteRoomAction(projectId, room.id))
          }
          onReorder={reorderRoom}
        />
      ) : null}

      {(() => {
        const poste = phasesFor ? tree.postes.find((p) => p.id === phasesFor) : undefined;
        if (!poste) return null;
        return (
          <RoomsDialog
            open
            labels={{ ...phaseLabels, title: `${t("phases")} · ${poste.name}` }}
            testId="phase"
            rooms={poste.phases ?? []}
            onOpenChange={(open) => {
              if (!open) setPhasesFor(null);
            }}
            onCreate={async (name) => (await addPhase(poste.id, name)) !== null}
            onRename={(phase, name) => mutate(() => updatePhaseAction(projectId, phase.id, name))}
            onDelete={(phase) => mutate(() => deletePhaseAction(projectId, phase.id))}
            onReorder={(phaseId, overId) => reorderPhase(poste.id, phaseId, overId)}
          />
        );
      })()}

      {storesOpen ? (
        <StoresDialog
          open
          stores={tree.stores}
          onOpenChange={setStoresOpen}
          onAdd={() => setStoreForm({ open: true, store: null })}
          onEdit={(store) => setStoreForm({ open: true, store })}
          onDelete={(store) =>
            mutate(() => deleteStoreAction(projectId, store.id))
          }
        />
      ) : null}

      {storeForm.open ? (
        <StoreFormDialog
          open
          store={storeForm.store}
          submitting={submitting}
          onOpenChange={(open) => setStoreForm((s) => ({ ...s, open }))}
          onSubmit={async (values) => {
            const ok = await mutate(() =>
              storeForm.store
                ? updateStoreAction(projectId, storeForm.store.id, values)
                : createStoreAction(projectId, values),
            );
            if (ok) setStoreForm({ open: false, store: null });
          }}
        />
      ) : null}

      {templatesOpen ? (
        <PosteTemplatesDialog
          open
          existingNames={tree.postes.map((p) => p.name)}
          submitting={submitting}
          onOpenChange={setTemplatesOpen}
          onSubmit={createFromTemplates}
        />
      ) : null}

      {posteDialog.open ? (
        <PosteFormDialog
          open
          poste={posteDialog.poste}
          submitting={submitting}
          onOpenChange={(open) => setPosteDialog((p) => ({ ...p, open }))}
          onSubmit={async (values) => {
            const ok = await mutate(() =>
              posteDialog.poste
                ? updatePosteAction(projectId, posteDialog.poste.id, values)
                : createPosteAction(projectId, values),
            );
            if (ok) setPosteDialog({ open: false, poste: null });
          }}
        />
      ) : null}

      {imageDialog.open && imageDialog.article ? (
        <ArticleImageDialog
          open
          article={imageDialog.article}
          onOpenChange={(open) => setImageDialog((s) => ({ ...s, open }))}
          onUpload={async (formData) => {
            const ok = await mutate(() =>
              uploadArticleImageAction(projectId, imageDialog.article!.id, formData)
            );
            if (ok) setImageVersion((v) => v + 1);
            return ok;
          }}
          onFromUrl={async (url) => {
            const ok = await mutate(() =>
              setArticleImageFromUrlAction(projectId, imageDialog.article!.id, url)
            );
            if (ok) setImageVersion((v) => v + 1);
            return ok;
          }}
          onRemove={async () => {
            const ok = await mutate(() =>
              deleteArticleImageAction(projectId, imageDialog.article!.id)
            );
            if (ok) setImageVersion((v) => v + 1);
            return ok;
          }}
        />
      ) : null}

      {articleDialog.open ? (
        <ArticleFormDialog
          open
          article={articleDialog.article}
          units={units}
          submitting={submitting}
          onOpenChange={(open) => setArticleDialog((p) => ({ ...p, open }))}
          rooms={tree.rooms}
          phases={
            tree.postes.find((p) => p.id === (articleDialog.article?.poste_id ?? articleDialog.posteId))
              ?.phases ?? []
          }
          defaultStage={filter.stage ?? null}
          onCreatePhase={(name) =>
            addPhase((articleDialog.article?.poste_id ?? articleDialog.posteId) as string, name)
          }
          onCreateUnit={addUnit}
          onDeleteUnit={removeUnit}
          onCreateRoom={addRoom}
          onSubmit={async (values) => {
            const ok = await mutate(() =>
              articleDialog.article
                ? updateArticleAction(
                    projectId,
                    articleDialog.article.id,
                    values,
                  )
                : createArticleAction(
                    projectId,
                    articleDialog.posteId as string,
                    values,
                  ),
            );
            if (ok)
              setArticleDialog({ open: false, posteId: null, article: null });
          }}
        />
      ) : null}

      {quoteDialog.open ? (
        <QuoteFormDialog
          open
          quote={quoteDialog.quote}
          submitting={submitting}
          companyId={companyId}
          stores={tree.stores}
          onCreateStore={addStore}
          onOpenChange={(open) => setQuoteDialog((p) => ({ ...p, open }))}
          onSubmit={async (values: QuoteFormValues) => {
            const ok = await mutate(() =>
              quoteDialog.quote
                ? updateQuoteAction(projectId, quoteDialog.quote.id, values)
                : createQuoteAction(
                    projectId,
                    quoteDialog.articleId as string,
                    values,
                  ),
            );
            if (ok)
              setQuoteDialog({ open: false, articleId: null, quote: null });
          }}
        />
      ) : null}
      {confirmDialog}
    </div>
  );
}
