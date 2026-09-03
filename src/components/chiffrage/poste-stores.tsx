"use client";

/**
 * The shops to visit for this section — a shopping run, not a single address.
 *
 * Derived, not hand-maintained: these are exactly the shops whose price was
 * retained on one of this section's items — the store on each item's effective
 * quote — so the list cannot drift from the costing. A shop that only has a
 * losing competing quote does not appear; you only need to visit where you
 * actually buy. Shops themselves are declared once for the project.
 *
 * Each entry links out to a map search so the address is one tap away from
 * navigation on a phone, which is where this list actually gets used.
 */

import { useTranslations } from "next-intl";
import { Globe, MapPin, Pencil, Store } from "lucide-react";

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
  onEdit: (store: ChiffrageStore) => void;
}

export function PosteStores({ stores, canManage, onEdit }: Props) {
  const t = useTranslations("chiffrage");

  if (stores.length === 0 && !canManage) return null;

  return (
    <div className="border-b bg-muted/30 px-3 py-2" data-testid="poste-stores">
      <div className="flex items-center gap-2">
        <Store className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">
          {t("storesLabel")}
        </span>
      </div>

      {stores.length === 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">
          {t("noShopPricedHere")}
        </p>
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
                  <span className="block text-sm font-medium">
                    {store.name}
                  </span>
                  {store.address ? (
                    <span className="block text-xs text-muted-foreground">
                      {store.address}
                    </span>
                  ) : null}
                </span>
              </a>
              <div className="flex shrink-0 items-center gap-0.5">
                {store.website_url ? (
                  <a
                    href={store.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                    title={t("openWebsite")}
                    aria-label={t("openWebsite")}
                  >
                    <Globe className="h-3.5 w-3.5" />
                  </a>
                ) : null}
                {canManage ? (
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
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
