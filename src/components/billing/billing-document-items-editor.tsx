"use client";

/**
 * BillingDocumentItemsEditor — editable line-items table with live totals.
 *
 * Each row: section (category) | description | qty | unit_price | vat_rate | line HT | delete
 * Footer: "+ Add line" button
 * Below: BillingTotalsCard (updates on every keystroke, no server roundtrip)
 *
 * VAT rate options: 20 / 10 / 5.5 / 0 — plus "custom" freetext fallback.
 * All values kept as strings to preserve Decimal-as-string transport invariant.
 *
 * Phase 05 additions:
 *   - "Section" (category) Combobox column to the left of description.
 *   - "Description" becomes a Combobox with async suggestions from
 *     getActivitySuggestionsAction, debounced 200 ms.
 *   - Selecting a description suggestion prefills unit_price and vat_rate.
 *   - Per-editor Map cache: (category||'') + '|' + q → suggestions.
 */

import { useId, useEffect, useRef, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { BillingTotalsCard, computeTotals } from "@/components/billing/billing-totals-card";
import { getActivitySuggestionsAction } from "@/app/[locale]/(app)/billing/_actions/billing-actions";
import type { BillingDocumentItem } from "@/types/billing";
import type { ActivitySuggestion, ActivityCategory } from "@/lib/api/billing/documents";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRESET_VAT_RATES = ["20", "10", "5.5", "0"];

function emptyItem(): BillingDocumentItem {
  return { description: "", quantity: "1", unit_price: "0", vat_rate: "20", category: null };
}

function lineHt(item: BillingDocumentItem): string {
  const qty = Number(item.quantity);
  const up = Number(item.unit_price);
  if (!Number.isFinite(qty) || !Number.isFinite(up)) return "—";
  const ht = Math.round((qty * up + Number.EPSILON) * 100) / 100;
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(ht);
}

// ---------------------------------------------------------------------------
// useDebouncedValue — returns a value that lags behind by `delay` ms
// ---------------------------------------------------------------------------

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BillingDocumentItemsEditorProps {
  items: BillingDocumentItem[];
  onChange: (items: BillingDocumentItem[]) => void;
  readOnly?: boolean;
  /** Set to false for template forms where totals are not meaningful. Default: true. */
  showTotals?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BillingDocumentItemsEditor({
  items,
  onChange,
  readOnly = false,
  showTotals = true,
}: BillingDocumentItemsEditorProps) {
  const uid = useId();
  const t = useTranslations("billing.form.items");

  // Per-editor suggestion cache: key = `${category||''}|${q}` → suggestions
  const suggestionCache = useRef<Map<string, ActivitySuggestion[]>>(new Map());
  // Global categories loaded once on mount
  const [categories, setCategories] = useState<ActivityCategory[]>([]);

  // Load categories on mount (empty q, no category filter — returns all past categories)
  useEffect(() => {
    let cancelled = false;
    getActivitySuggestionsAction({ limit: 50 }).then((result) => {
      if (cancelled) return;
      if (result.ok) setCategories(result.data.categories);
    }).catch(() => {
      // Non-fatal — category combobox works as free-text without suggestions
    });
    return () => { cancelled = true; };
  }, []);

  function updateItem(index: number, patch: Partial<BillingDocumentItem>) {
    const next = items.map((item, i) =>
      i === index ? { ...item, ...patch } : item
    );
    onChange(next);
  }

  function addItem() {
    onChange([...items, emptyItem()]);
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  const totals = computeTotals(items);

  const categoryOptions: ComboboxOption[] = categories.map((c) => ({
    value: c.name,
    label: c.name,
    meta: String(c.frequency),
  }));

  return (
    <div className="space-y-4">
      {/* Items table */}
      <div className="folio-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="ledger">
            <thead>
              <tr>
                <th className="w-32 min-w-[120px]">{t("categoryLabel")}</th>
                <th className="min-w-[180px]">{t("description")}</th>
                <th className="w-20 text-right">{t("quantity")}</th>
                <th className="w-28 text-right">{t("unitPrice")}</th>
                <th className="w-24">{t("vatRate")}</th>
                <th className="w-24 text-right">{t("totalHt")}</th>
                {!readOnly && <th className="w-10" />}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td
                    colSpan={readOnly ? 6 : 7}
                    className="py-8 text-center text-[13px]"
                    style={{ color: "var(--muted)" }}
                  >
                    {t("noItems")}
                  </td>
                </tr>
              )}
              {items.map((item, index) => (
                <ItemRow
                  key={`${uid}-${index}`}
                  item={item}
                  index={index}
                  readOnly={readOnly}
                  categoryOptions={categoryOptions}
                  suggestionCache={suggestionCache}
                  onUpdate={(patch) => updateItem(index, patch)}
                  onRemove={() => removeItem(index)}
                  t={t}
                />
              ))}
            </tbody>
          </table>
        </div>

        {!readOnly && (
          <div className="border-t px-4 py-2" style={{ borderColor: "var(--border)" }}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addItem}
              className="h-7 text-[13px]"
            >
              <Plus size={13} className="mr-1" />
              {t("addLine")}
            </Button>
          </div>
        )}
      </div>

      {/* Live totals — hidden for template forms */}
      {showTotals && (
        <div className="flex justify-end">
          <div className="w-full max-w-xs">
            <BillingTotalsCard totals={totals} />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ItemRow — isolated row component so debounce state is per-row
// ---------------------------------------------------------------------------

interface ItemRowProps {
  item: BillingDocumentItem;
  index: number;
  readOnly: boolean;
  categoryOptions: ComboboxOption[];
  suggestionCache: React.RefObject<Map<string, ActivitySuggestion[]>>;
  onUpdate: (patch: Partial<BillingDocumentItem>) => void;
  onRemove: () => void;
  t: ReturnType<typeof useTranslations<"billing.form.items">>;
}

function ItemRow({
  item,
  readOnly,
  categoryOptions,
  suggestionCache,
  onUpdate,
  onRemove,
  t,
}: ItemRowProps) {
  const [descQuery, setDescQuery] = useState(item.description);
  const [descLoading, setDescLoading] = useState(false);
  const [descOptions, setDescOptions] = useState<ComboboxOption[]>([]);

  const debouncedDescQuery = useDebouncedValue(descQuery, 200);
  const debouncedCategory = useDebouncedValue(item.category ?? "", 200);

  // Keep a ref to the latest item id-equivalent so stale async closures can
  // bail out after unmount or rapid updates.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Fetch description suggestions whenever debounced query or category changes
  const fetchSuggestions = useCallback(async (q: string, category: string) => {
    const cacheKey = `${category}|${q}`;
    const cache = suggestionCache.current;
    if (cache && cache.has(cacheKey)) {
      const cached = cache.get(cacheKey)!;
      if (mountedRef.current) setDescOptions(toComboboxOptions(cached));
      return;
    }
    if (mountedRef.current) setDescLoading(true);
    try {
      const result = await getActivitySuggestionsAction({
        category: category || undefined,
        q: q || undefined,
        limit: 20,
      });
      if (!mountedRef.current) return;
      if (result.ok) {
        cache?.set(cacheKey, result.data.suggestions);
        setDescOptions(toComboboxOptions(result.data.suggestions));
      }
    } catch {
      // Silent — user can still type free-text
    } finally {
      if (mountedRef.current) setDescLoading(false);
    }
  }, [suggestionCache]);

  useEffect(() => {
    fetchSuggestions(debouncedDescQuery, debouncedCategory);
  }, [debouncedDescQuery, debouncedCategory, fetchSuggestions]);

  function handleDescSelect(value: string) {
    // Find the full suggestion to prefill unit_price / vat_rate
    const cache = suggestionCache.current;
    const cacheKey = `${debouncedCategory}|${debouncedDescQuery}`;
    const suggestions = cache?.get(cacheKey) ?? [];
    const match = suggestions.find((s) => s.description === value);
    const patch: Partial<BillingDocumentItem> = { description: value };
    if (match) {
      patch.unit_price = match.last_unit_price;
      patch.vat_rate = match.last_vat_rate;
      // Note: BE ItemSchema is strict-mode (extra='forbid') and does not
      // accept a `unit` field on line items. The last_unit hint is shown as
      // meta on the suggestion row instead, not pre-filled into the row.
    }
    onUpdate(patch);
    setDescQuery(value);
  }

  function handleDescQueryChange(q: string) {
    setDescQuery(q);
    // Keep parent description in sync with every keystroke so free-text
    // is preserved even if the user never selects from the list.
    onUpdate({ description: q });
  }

  return (
    <tr>
      {/* Section (category) */}
      <td>
        {readOnly ? (
          <span className="text-sm text-muted-foreground">{item.category ?? ""}</span>
        ) : (
          <Combobox
            value={item.category ?? ""}
            onChange={(v) => onUpdate({ category: v || null })}
            options={categoryOptions}
            onQueryChange={() => {/* categories already loaded on mount */}}
            placeholder={t("categoryPlaceholder")}
            emptyText={t("categoryNoMatches")}
            allowFreeText
          />
        )}
      </td>

      {/* Description */}
      <td>
        {readOnly ? (
          <span className="text-sm">{item.description}</span>
        ) : (
          <Combobox
            value={item.description}
            onChange={handleDescSelect}
            options={descOptions}
            onQueryChange={handleDescQueryChange}
            placeholder={t("descriptionPlaceholder")}
            emptyText={t("noSuggestions")}
            groupHeading={descOptions.length > 0 ? t("descriptionSuggestionsHeading") : undefined}
            loading={descLoading}
            allowFreeText
          />
        )}
      </td>

      {/* Quantity */}
      <td className="text-right">
        {readOnly ? (
          <span className="num text-sm">{item.quantity}</span>
        ) : (
          <Input
            type="number"
            min="0"
            step="any"
            value={item.quantity}
            onChange={(e) => onUpdate({ quantity: e.target.value })}
            className="h-7 border-0 bg-transparent px-0 text-right text-sm shadow-none focus-visible:ring-0 num"
          />
        )}
      </td>

      {/* Unit price */}
      <td className="text-right">
        {readOnly ? (
          <span className="num text-sm">{item.unit_price}</span>
        ) : (
          <Input
            type="number"
            min="0"
            step="any"
            value={item.unit_price}
            onChange={(e) => onUpdate({ unit_price: e.target.value })}
            className="h-7 border-0 bg-transparent px-0 text-right text-sm shadow-none focus-visible:ring-0 num"
          />
        )}
      </td>

      {/* VAT rate */}
      <td>
        {readOnly ? (
          <span className="num text-sm">{item.vat_rate}%</span>
        ) : (
          <VatRateCell
            value={item.vat_rate}
            onChange={(v) => onUpdate({ vat_rate: v })}
          />
        )}
      </td>

      {/* Line HT (computed) */}
      <td className="num text-right text-sm font-medium">
        {lineHt(item)}
      </td>

      {/* Delete */}
      {!readOnly && (
        <td className="text-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={onRemove}
            aria-label={t("removeLine")}
          >
            <Trash2 size={12} style={{ color: "var(--muted)" }} />
          </Button>
        </td>
      )}
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Helper: convert ActivitySuggestion[] to ComboboxOption[]
// ---------------------------------------------------------------------------

function toComboboxOptions(suggestions: ActivitySuggestion[]): ComboboxOption[] {
  return suggestions.map((s) => ({
    value: s.description,
    label: s.description,
    meta: s.frequency > 1 ? `×${s.frequency}` : undefined,
  }));
}

// ---------------------------------------------------------------------------
// VAT rate cell sub-component — preset select + custom freetext toggle
// ---------------------------------------------------------------------------

interface VatRateCellProps {
  value: string;
  onChange: (value: string) => void;
}

function VatRateCell({ value, onChange }: VatRateCellProps) {
  // isCustom: value not in presets, OR empty string (user just triggered custom mode)
  const isCustom = !PRESET_VAT_RATES.includes(value);

  if (isCustom) {
    return (
      <div className="flex items-center gap-1">
        <Input
          type="number"
          min="0"
          max="100"
          step="any"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-16 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0 num"
          placeholder="0"
        />
        <button
          type="button"
          className="text-[11px] underline"
          style={{ color: "var(--muted)" }}
          onClick={() => onChange("20")}
        >
          ↩
        </button>
      </div>
    );
  }

  return (
    <Select
      value={value}
      onValueChange={(v) => {
        if (v === "__custom__") {
          onChange(""); // switch to freetext mode; user types their rate
        } else {
          onChange(v);
        }
      }}
    >
      <SelectTrigger className="h-7 border-0 bg-transparent px-0 text-sm shadow-none focus:ring-0 num">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PRESET_VAT_RATES.map((r) => (
          <SelectItem key={r} value={r}>
            {r}%
          </SelectItem>
        ))}
        <SelectItem value="__custom__">Custom…</SelectItem>
      </SelectContent>
    </Select>
  );
}
