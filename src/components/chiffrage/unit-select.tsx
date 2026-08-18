"use client";

/**
 * Unit-of-measure picker: preset symbols plus the project's own, with an
 * inline "add a unit" affordance.
 *
 * Deliberately not a free-text input — the backend validates the submitted
 * symbol against the same preset+custom set, so anything typed freely would be
 * rejected anyway. Adding a unit keeps the article form open and selects the
 * new symbol immediately, so the flow is never interrupted mid-entry.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronsUpDown, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { ChiffrageUnit } from "@/lib/api/chiffrage";

interface Props {
  value: string | null;
  units: ChiffrageUnit[];
  onChange: (symbol: string | null) => void;
  onCreateUnit: (symbol: string) => Promise<ChiffrageUnit | null>;
}

export function UnitSelect({ value, units, onChange, onCreateUnit }: Props) {
  const t = useTranslations("chiffrage");
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const presets = units.filter((u) => u.is_preset);
  const custom = units.filter((u) => !u.is_preset);

  const pick = (symbol: string) => {
    onChange(symbol === value ? null : symbol);
    setOpen(false);
  };

  const add = async () => {
    const symbol = draft.trim();
    if (!symbol || busy) return;
    setBusy(true);
    const created = await onCreateUnit(symbol);
    setBusy(false);
    if (created) {
      setDraft("");
      setAdding(false);
      onChange(created.symbol);
      setOpen(false);
    }
  };

  const renderGroup = (label: string, list: ChiffrageUnit[]) =>
    list.length === 0 ? null : (
      <div className="py-1">
        <p className="px-2 py-1 text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <div className="flex flex-wrap gap-1 px-1">
          {list.map((u) => (
            <Button
              key={u.symbol}
              type="button"
              size="sm"
              variant={u.symbol === value ? "default" : "outline"}
              className="h-7"
              onClick={() => pick(u.symbol)}
            >
              {u.symbol}
              {u.symbol === value ? <Check className="ml-1 h-3 w-3" /> : null}
            </Button>
          ))}
        </div>
      </div>
    );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
          )}
          data-testid="unit-select-trigger"
        >
          {value ?? t("selectUnit")}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        {renderGroup(t("presetUnits"), presets)}
        {renderGroup(t("customUnits"), custom)}

        <div className="mt-2 border-t pt-2">
          {adding ? (
            <div className="flex items-center gap-1">
              <Input
                value={draft}
                maxLength={16}
                autoFocus
                placeholder={t("newUnitPlaceholder")}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void add();
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setAdding(false);
                  }
                }}
                className="h-8"
              />
              <Button
                type="button"
                size="sm"
                className="h-8"
                disabled={!draft.trim() || busy}
                onClick={add}
              >
                {t("add")}
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => setAdding(true)}
              data-testid="add-unit-button"
            >
              <Plus className="mr-1 h-4 w-4" />
              {t("addUnit")}
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
