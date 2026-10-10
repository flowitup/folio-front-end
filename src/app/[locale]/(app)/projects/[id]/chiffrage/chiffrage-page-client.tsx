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

import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
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
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { DoorOpen, Plus, Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ArticleRow } from "@/components/chiffrage/article-row";
import { ArticleFormDialog } from "@/components/chiffrage/article-form-dialog";
import { ChiffrageTotals } from "@/components/chiffrage/chiffrage-totals";
import { PosteCard } from "@/components/chiffrage/poste-card";
import { RoomHeading } from "@/components/chiffrage/room-heading";
import { ArticleImageDialog } from "@/components/chiffrage/article-image-dialog";
import { SectionCompareDialog } from "@/components/chiffrage/section-compare-dialog";
import { PosteFormDialog } from "@/components/chiffrage/poste-form-dialog";
import { RoomsDialog } from "@/components/chiffrage/rooms-dialog";
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
  createPosteAction,
  createRoomAction,
  createStoreAction,
  deleteArticleImageAction,
  createQuoteAction,
  createUnitAction,
  deleteArticleAction,
  deletePosteAction,
  deleteRoomAction,
  deleteStoreAction,
  deleteQuoteAction,
  getChiffrageAction,
  reorderArticleAction,
  reorderPosteAction,
  reorderRoomAction,
  selectQuoteAction,
  unselectQuoteAction,
  updateArticleAction,
  updatePosteAction,
  updateRoomAction,
  updateStoreAction,
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
  const router = useRouter();
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
  const [roomsOpen, setRoomsOpen] = useState(false);
  const [storesOpen, setStoresOpen] = useState(false);
  const [storeForm, setStoreForm] = useState<{
    open: boolean;
    store: ChiffrageStore | null;
  }>({ open: false, store: null });

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

      {loadFailed ? null : tree.postes.length === 0 ? (
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
              {tree.postes.map((poste) => (
                <SortableItem key={poste.id} id={poste.id}>
                  {(handle) => (
                    <PosteCard
                      poste={poste}
                      canManage={canManage}
                      dragHandle={canManage ? handle : undefined}
                      collapsed={collapsedPostes.has(poste.id)}
                      onToggleCollapse={() => toggleCollapse(poste.id)}
                      canCompare={hasComparablePrices(poste)}
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
