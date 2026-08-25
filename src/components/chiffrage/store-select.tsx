"use client";

/**
 * Pick which shop a price came from, adding one inline when it is not declared
 * yet.
 *
 * Shops are project-level, so the same list serves every section — and that is
 * the point: two prices at the same shop only aggregate into one comparable
 * basket if they point at the same record. Typing the name by hand, as this
 * replaces, made "Leroy Merlin" and "leroy merlin" two different shops and
 * quietly split the comparison.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronDown, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ChiffrageStore } from "@/lib/api/chiffrage";

interface Props {
  value: string | null;
  stores: ChiffrageStore[];
  invalid?: boolean;
  onChange: (storeId: string | null) => void;
  onCreateStore: (name: string) => Promise<ChiffrageStore | null>;
}

export function StoreSelect({
  value,
  stores,
  invalid = false,
  onChange,
  onCreateStore,
}: Props) {
  const t = useTranslations("chiffrage");
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState("");
  const [busy, setBusy] = useState(false);

  const selected = stores.find((s) => s.id === value) ?? null;

  const add = async () => {
    const name = adding.trim();
    if (!name) return;
    setBusy(true);
    const created = await onCreateStore(name);
    setBusy(false);
    if (created) {
      setAdding("");
      onChange(created.id);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-invalid={invalid}
          className="w-full justify-between font-normal"
          data-testid="store-select-trigger"
        >
          <span className={selected ? "" : "text-muted-foreground"}>
            {selected ? selected.name : t("pickStore")}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-1"
        align="start"
      >
        <div className="max-h-56 overflow-y-auto">
          {stores.length === 0 ? (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">
              {t("noStoresYet")}
            </p>
          ) : null}
          {stores.map((store) => (
            <button
              key={store.id}
              type="button"
              className="flex w-full items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-accent"
              onClick={() => {
                onChange(store.id);
                setOpen(false);
              }}
            >
              <span className="min-w-0 truncate text-left">
                {store.name}
                {store.address ? (
                  <span className="block truncate text-xs text-muted-foreground">
                    {store.address}
                  </span>
                ) : null}
              </span>
              {value === store.id ? (
                <Check className="ml-2 h-4 w-4 shrink-0" />
              ) : null}
            </button>
          ))}
        </div>

        <div className="mt-1 border-t pt-1">
          <div className="flex gap-1">
            <Input
              value={adding}
              maxLength={160}
              placeholder={t("addStorePlaceholder")}
              onChange={(e) => setAdding(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void add();
                }
              }}
              className="h-8"
              data-testid="store-select-new"
            />
            <Button
              type="button"
              size="sm"
              className="h-8 shrink-0"
              disabled={busy || !adding.trim()}
              onClick={() => void add()}
              aria-label={t("addStore")}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
