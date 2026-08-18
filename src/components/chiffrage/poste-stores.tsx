"use client";

/**
 * The shops to visit for a poste — a shopping run, not a single address.
 *
 * Each entry links out to a map search so the address is one tap away from
 * navigation on a phone, which is where this list actually gets used.
 */

import { useTranslations } from "next-intl";
import { MapPin, Pencil, Plus, Store, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ChiffrageStore } from "@/lib/api/chiffrage";

/** Map search URL. Falls back to the shop name when no address was recorded. */
export function mapsUrl(store: ChiffrageStore): string {
  const query = store.address?.trim() || store.name;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

interface Props {
  stores: ChiffrageStore[];
  canManage: boolean;
  onAdd: () => void;
  onEdit: (store: ChiffrageStore) => void;
  onDelete: (store: ChiffrageStore) => void;
}

export function PosteStores({
  stores,
  canManage,
  onAdd,
  onEdit,
  onDelete,
}: Props) {
  const t = useTranslations("chiffrage");

  if (stores.length === 0 && !canManage) return null;

  return (
    <div className="border-b bg-muted/30 px-3 py-2" data-testid="poste-stores">
      <div className="flex items-center gap-2">
        <Store className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">
          {t("storesLabel")}
        </span>
        {canManage ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto h-6 px-2"
            onClick={onAdd}
          >
            <Plus className="mr-1 h-3 w-3" />
            <span className="text-xs">{t("addStore")}</span>
          </Button>
        ) : null}
      </div>

      {stores.length === 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">{t("noStoresYet")}</p>
      ) : (
        <ul className="mt-1.5 space-y-1">
          {stores.map((store) => (
            <li
              key={store.id}
              className="flex items-start gap-2"
              data-testid="poste-store"
            >
              {/* Name and address are one tap target: this list gets used on a
                  phone, on site, so the whole block opens Maps rather than a
                  16px-tall line of text. */}
              <a
                href={mapsUrl(store)}
                target="_blank"
                rel="noopener noreferrer"
                className="-mx-1 flex min-h-11 min-w-0 flex-1 items-start gap-1 rounded px-1 py-1.5 hover:bg-accent/50"
                title={t("openInMaps")}
              >
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{store.name}</span>
                  {store.address ? (
                    <span className="block text-xs text-muted-foreground">
                      {store.address}
                    </span>
                  ) : null}
                </span>
              </a>
              {canManage ? (
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => onEdit(store)}
                    aria-label={t("editStore")}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => onDelete(store)}
                    aria-label={t("deleteStore")}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
