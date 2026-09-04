"use client";

/**
 * Chiffrage page shell: postes -> articles -> quotes, totals, and the
 * provisioning table.
 *
 * Server truth is authoritative for every total. Reordering applies an
 * optimistic local swap for responsiveness, then re-fetches; on failure the
 * previous order is restored rather than left silently diverged from the DB.
 */

import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ArticleRow, DragHandle } from "@/components/chiffrage/article-row";
import { ArticleFormDialog } from "@/components/chiffrage/article-form-dialog";
import { ChiffrageTotals } from "@/components/chiffrage/chiffrage-totals";
import { PosteCard } from "@/components/chiffrage/poste-card";
import { RoomHeading } from "@/components/chiffrage/room-heading";
import { ArticleImageDialog } from "@/components/chiffrage/article-image-dialog";
import { SectionCompareDialog } from "@/components/chiffrage/section-compare-dialog";
import { PosteFormDialog } from "@/components/chiffrage/poste-form-dialog";
import {
  QuoteFormDialog,
  type QuoteFormValues,
} from "@/components/chiffrage/quote-form-dialog";
import {
  createArticleAction,
  createPosteAction,
  createRoomAction,
  createStoreAction,
  deleteArticleImageAction,
  createQuoteAction,
  createUnitAction,
  deleteArticleAction,
  deletePosteAction,
  deleteStoreAction,
  deleteQuoteAction,
  getChiffrageAction,
  reorderArticleAction,
  reorderPosteAction,
  selectQuoteAction,
  updateArticleAction,
  updatePosteAction,
  setArticleImageFromUrlAction,
  uploadArticleImageAction,
  updateQuoteAction,
} from "./_actions/chiffrage-actions";
import type {
  ChiffrageArticle,
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
}

/** Neighbours of the slot an item was dropped into, in the post-move list. */
function neighboursAfterMove<T extends { id: string }>(
  items: T[],
  activeId: string,
  overId: string,
): { before_id: string | null; after_id: string | null } | null {
  const from = items.findIndex((i) => i.id === activeId);
  const to = items.findIndex((i) => i.id === overId);
  if (from === -1 || to === -1 || from === to) return null;
  const reordered = [...items];
  const [moved] = reordered.splice(from, 1);
  reordered.splice(to, 0, moved);
  const idx = reordered.findIndex((i) => i.id === activeId);
  return {
    before_id: idx > 0 ? reordered[idx - 1].id : null,
    after_id: idx < reordered.length - 1 ? reordered[idx + 1].id : null,
  };
}

function SortableItem({
  id,
  children,
}: {
  id: string;
  children: (handle: React.ReactNode) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
      }}
    >
      {children(<DragHandle {...attributes} {...listeners} />)}
    </div>
  );
}

export function ChiffragePageClient({
  projectId,
  canManage,
  companyId,
  initialTree,
  initialUnits,
}: Props) {
  const t = useTranslations("chiffrage");
  const [tree, setTree] = useState(initialTree);
  const [units, setUnits] = useState(initialUnits);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Postes collapsed by the reader; empty by default so sections open as before.
  const [collapsedPostes, setCollapsedPostes] = useState<Set<string>>(new Set());
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

  // dnd-kit's distance constraint is what keeps a click on a row button from
  // being swallowed as the start of a drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
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

  const toggleCollapse = (posteId: string) =>
    setCollapsedPostes((prev) => {
      const next = new Set(prev);
      if (next.has(posteId)) next.delete(posteId);
      else next.add(posteId);
      return next;
    });

  /** Run a mutation, surface its error, and re-sync from server truth. */
  const mutate = useCallback(
    async (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
      setSubmitting(true);
      const res = await fn();
      if (!res.ok) toast.error(res.error);
      else await refresh();
      setSubmitting(false);
      return res.ok;
    },
    [refresh],
  );

  /**
   * Lay a poste's articles out room by room. Rooms follow the project's
   * declared order and unassigned items come last, matching how the backend
   * orders room_subtotals — the two must agree or the headings would show one
   * room's figure above another room's items.
   */
  const byRoom = (poste: ChiffragePoste) => {
    const rank = new Map(tree.rooms.map((r, i) => [r.id, i]));
    const sorted = [...poste.articles].sort((a, b) => {
      const ra = a.room_id === null ? Number.MAX_SAFE_INTEGER : (rank.get(a.room_id) ?? rank.size);
      const rb = b.room_id === null ? Number.MAX_SAFE_INTEGER : (rank.get(b.room_id) ?? rank.size);
      return ra === rb ? a.position - b.position : ra - rb;
    });
    const rows: Array<
      { kind: "heading"; key: string; roomId: string | null } | { kind: "article"; article: ChiffrageArticle }
    > = [];
    let current: string | null | undefined = undefined;
    for (const article of sorted) {
      if (article.room_id !== current) {
        current = article.room_id;
        rows.push({ kind: "heading", key: `h-${current ?? "none"}`, roomId: current });
      }
      rows.push({ kind: "article", article });
    }
    return { sorted, rows };
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

  const addUnit = async (symbol: string): Promise<ChiffrageUnit | null> => {
    const res = await createUnitAction(projectId, symbol);
    if (!res.ok) {
      toast.error(res.error);
      return null;
    }
    setUnits((prev) => [...prev, res.data]);
    return res.data;
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
    const move = neighboursAfterMove(
      poste.articles,
      String(active.id),
      String(over.id),
    );
    if (!move) return;
    const previous = tree;
    setTree((prev) => ({
      ...prev,
      postes: prev.postes.map((p) => {
        if (p.id !== poste.id) return p;
        const from = p.articles.findIndex((a) => a.id === active.id);
        const to = p.articles.findIndex((a) => a.id === over.id);
        const articles = [...p.articles];
        const [moved] = articles.splice(from, 1);
        articles.splice(to, 0, moved);
        return { ...p, articles };
      }),
    }));
    const res = await reorderArticleAction(projectId, String(active.id), move);
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
        {canManage ? (
          <Button
            type="button"
            onClick={() => setPosteDialog({ open: true, poste: null })}
          >
            <Plus className="mr-1 h-4 w-4" />
            {t("newPoste")}
          </Button>
        ) : null}
      </div>

      <ChiffrageTotals tree={tree} />

      {tree.postes.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="font-medium">{t("emptyTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("emptyHint")}</p>
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
              {tree.postes.map((poste) => (
                <SortableItem key={poste.id} id={poste.id}>
                  {(handle) => (
                    <PosteCard
                      poste={poste}
                      canManage={canManage}
                      dragHandle={canManage ? handle : undefined}
                      collapsed={collapsedPostes.has(poste.id)}
                      onToggleCollapse={() => toggleCollapse(poste.id)}
                      canCompare={poste.store_baskets.length > 0}
                      onCompare={() =>
                        setCompareDialog({ open: true, poste })
                      }
                      onEdit={() => setPosteDialog({ open: true, poste })}
                      onDelete={() => {
                        if (
                          confirm(t("confirmDeletePoste", { name: poste.name }))
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
                          items={byRoom(poste).sorted.map((a) => a.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {byRoom(poste).rows.map((row) =>
                            row.kind === "heading" ? (
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
                            <SortableItem key={row.article.id} id={row.article.id}>
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
                                    canManage ? articleHandle : undefined
                                  }
                                  onToggle={() => toggle(article.id)}
                                  onEdit={() =>
                                    setArticleDialog({
                                      open: true,
                                      posteId: poste.id,
                                      article,
                                    })
                                  }
                                  onDelete={() => {
                                    if (
                                      confirm(
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
                                  onEditQuote={(q) =>
                                    setQuoteDialog({
                                      open: true,
                                      articleId: article.id,
                                      quote: q,
                                    })
                                  }
                                  onDeleteQuote={(q) => {
                                    if (confirm(t("confirmDeleteQuote"))) {
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
              ))}
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
          onCreateUnit={addUnit}
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
    </div>
  );
}
