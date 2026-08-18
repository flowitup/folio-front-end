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
import { PosteStores } from "@/components/chiffrage/poste-stores";
import { StoreFormDialog } from "@/components/chiffrage/store-form-dialog";
import { PosteFormDialog } from "@/components/chiffrage/poste-form-dialog";
import { ProvisioningTable } from "@/components/chiffrage/provisioning-table";
import {
  QuoteFormDialog,
  type QuoteFormValues,
} from "@/components/chiffrage/quote-form-dialog";
import {
  createArticleAction,
  createPosteAction,
  createStoreAction,
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
  updateStoreAction,
  updateQuoteAction,
} from "./_actions/chiffrage-actions";
import type {
  ChiffrageArticle,
  ChiffragePoste,
  ChiffrageQuote,
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
  const [storeDialog, setStoreDialog] = useState<{
    open: boolean;
    posteId: string | null;
    store: ChiffrageStore | null;
  }>({ open: false, posteId: null, store: null });
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
                      stores={
                        <PosteStores
                          stores={poste.stores}
                          canManage={canManage}
                          onAdd={() =>
                            setStoreDialog({
                              open: true,
                              posteId: poste.id,
                              store: null,
                            })
                          }
                          onEdit={(store) =>
                            setStoreDialog({
                              open: true,
                              posteId: poste.id,
                              store,
                            })
                          }
                          onDelete={(store) => {
                            if (
                              confirm(
                                t("confirmDeleteStore", { name: store.name }),
                              )
                            ) {
                              void mutate(() =>
                                deleteStoreAction(projectId, store.id),
                              );
                            }
                          }}
                        />
                      }
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
                          items={poste.articles.map((a) => a.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {poste.articles.map((article) => (
                            <SortableItem key={article.id} id={article.id}>
                              {(articleHandle) => (
                                <ArticleRow
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
                              )}
                            </SortableItem>
                          ))}
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

      <ProvisioningTable tree={tree} />

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

      {storeDialog.open ? (
        <StoreFormDialog
          open
          store={storeDialog.store}
          submitting={submitting}
          onOpenChange={(open) => setStoreDialog((s) => ({ ...s, open }))}
          onSubmit={async (values) => {
            const ok = await mutate(() =>
              storeDialog.store
                ? updateStoreAction(projectId, storeDialog.store.id, values)
                : createStoreAction(projectId, storeDialog.posteId!, values),
            );
            if (ok) setStoreDialog({ open: false, posteId: null, store: null });
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
          onCreateUnit={addUnit}
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
