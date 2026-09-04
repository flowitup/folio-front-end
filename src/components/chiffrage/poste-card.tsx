"use client";

/**
 * One poste (e.g. "Lumière") with its articles and running subtotal.
 */

import { useTranslations } from "next-intl";
import {
  ChevronDown,
  ChevronRight,
  Pencil,
  Plus,
  Scale,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { money } from "@/components/chiffrage/format";
import type { ChiffragePoste } from "@/lib/api/chiffrage";

interface Props {
  poste: ChiffragePoste;
  canManage: boolean;
  dragHandle?: React.ReactNode;
  /** Whether the section body (the articles) is hidden. */
  collapsed: boolean;
  onToggleCollapse: () => void;
  /** Whether this section has shop baskets worth a comparison. */
  canCompare: boolean;
  /** Open the head-to-head shop comparison for this section. */
  onCompare: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddArticle: () => void;
  children: React.ReactNode;
}

export function PosteCard({
  poste,
  canManage,
  dragHandle,
  collapsed,
  onToggleCollapse,
  canCompare,
  onCompare,
  onEdit,
  onDelete,
  onAddArticle,
  children,
}: Props) {
  const t = useTranslations("chiffrage");

  return (
    <section className="rounded-lg border bg-card" data-testid="poste-card">
      <header className="flex items-center gap-2 border-b px-3 py-2">
        {dragHandle ?? (canManage ? <span className="w-4" /> : null)}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0"
          onClick={onToggleCollapse}
          aria-expanded={!collapsed}
          aria-label={collapsed ? t("expandSection") : t("collapseSection")}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">{poste.name}</h3>
          {poste.note ? (
            <p className="truncate text-xs text-muted-foreground">
              {poste.note}
            </p>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          <p className="font-medium tabular-nums">{money(poste.subtotal_ht)}</p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {money(poste.subtotal_ttc)} {t("ttcShort")}
          </p>
        </div>
        {canCompare ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={onCompare}
            title={t("compareToggle")}
          >
            <Scale className="h-4 w-4" />
            <span className="ml-1 hidden sm:inline">{t("compareToggle")}</span>
          </Button>
        ) : null}
        {canManage ? (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onAddArticle}
              title={t("addArticle")}
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onEdit}
              aria-label={t("editPoste")}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onDelete}
              aria-label={t("deletePoste")}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
      </header>

      {collapsed ? null : (
        <>
          {poste.articles.length === 0 ? (
            <p className="px-4 py-4 text-sm text-muted-foreground">
              {t("noArticlesYet")}
            </p>
          ) : (
            <div>{children}</div>
          )}
        </>
      )}
    </section>
  );
}
