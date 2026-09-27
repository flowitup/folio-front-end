"use client";

/**
 * The shops this project buys from, declared once and shared by every poste.
 *
 * Each price an item records points at one of these shops, which is what lets
 * the comparison total a shop's basket. From here a manager corrects a shop's
 * name, address or website, removes one, or declares a new one with its
 * details; the add and edit form itself is the page's StoreFormDialog.
 *
 * Name and address open a map search, so the list doubles as the shopping run
 * on a phone.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Globe, MapPin, Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ChiffrageStore } from "@/lib/api/chiffrage";

/** Map search URL. Falls back to the shop name when no address was recorded. */
export function mapsUrl(
  store: Pick<ChiffrageStore, "name" | "address">,
): string {
  const query = store.address?.trim() || store.name;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/**
 * A clickable URL for a shop's website, or null when there is none worth
 * opening. The backend stores whatever was pasted, so a bare domain gets a
 * scheme (it would otherwise resolve as a path inside this app) and anything
 * that is not http(s) is not linked at all.
 */
export function websiteHref(raw: string | null): string | null {
  const value = raw?.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return null;
  return `https://${value}`;
}

interface Props {
  open: boolean;
  stores: ChiffrageStore[];
  onOpenChange: (open: boolean) => void;
  onAdd: () => void;
  onEdit: (store: ChiffrageStore) => void;
  onDelete: (store: ChiffrageStore) => Promise<boolean>;
}

export function StoresDialog({
  open,
  stores,
  onOpenChange,
  onAdd,
  onEdit,
  onDelete,
}: Props) {
  const t = useTranslations("chiffrage");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const busy = deletingId !== null;

  const remove = async (store: ChiffrageStore) => {
    if (!confirm(t("confirmDeleteStore", { name: store.name }))) return;
    setDeletingId(store.id);
    try {
      await onDelete(store);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("stores")}</DialogTitle>
          <DialogDescription>{t("storesDialogHint")}</DialogDescription>
        </DialogHeader>

        {stores.length === 0 ? (
          <p
            className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground"
            data-testid="stores-empty"
          >
            {t("noStoresYet")}
          </p>
        ) : (
          <ul className="divide-y rounded-md border" aria-busy={busy}>
            {stores.map((store) => {
              const website = websiteHref(store.website_url);
              return (
                <li
                  key={store.id}
                  className="flex items-start gap-1 px-2 py-1"
                  data-testid="store-row"
                >
                  <a
                    href={mapsUrl(store)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-11 min-w-0 flex-1 items-start gap-2 rounded px-1 py-1.5 hover:bg-accent/50"
                    title={t("openInMaps")}
                  >
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {store.name}
                      </span>
                      {store.address ? (
                        <span className="block text-xs text-muted-foreground">
                          {store.address}
                        </span>
                      ) : null}
                    </span>
                  </a>
                  <div className="flex shrink-0 items-center gap-0.5 py-1">
                    {website ? (
                      <a
                        href={website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                        title={t("openWebsite")}
                        aria-label={t("openWebsite")}
                      >
                        <Globe className="h-4 w-4" />
                      </a>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      disabled={busy}
                      onClick={() => onEdit(store)}
                      aria-label={t("editStore")}
                      title={t("editStore")}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      disabled={busy}
                      onClick={() => void remove(store)}
                      aria-label={t("deleteStore")}
                      title={t("deleteStore")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onAdd}
          >
            <Plus className="mr-1 h-4 w-4" />
            {t("addStore")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            {t("close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
