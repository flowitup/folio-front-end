"use client";

/**
 * BillingDocumentItemsEditor — editable line-items table with live totals.
 *
 * Each row: description | qty | unit_price | vat_rate | line HT (computed) | delete
 * Footer: "+ Add line" button
 * Below: BillingTotalsCard (updates on every keystroke, no server roundtrip)
 *
 * VAT rate options: 20 / 10 / 5.5 / 0 — plus "custom" freetext fallback.
 * All values kept as strings to preserve Decimal-as-string transport invariant.
 */

import { useId } from "react";
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
import { BillingTotalsCard, computeTotals } from "@/components/billing/billing-totals-card";
import type { BillingDocumentItem } from "@/types/billing";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRESET_VAT_RATES = ["20", "10", "5.5", "0"];

function emptyItem(): BillingDocumentItem {
  return { description: "", quantity: "1", unit_price: "0", vat_rate: "20" };
}

function lineHt(item: BillingDocumentItem): string {
  const qty = Number(item.quantity);
  const up = Number(item.unit_price);
  if (!Number.isFinite(qty) || !Number.isFinite(up)) return "—";
  const ht = Math.round((qty * up + Number.EPSILON) * 100) / 100;
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(ht);
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

  return (
    <div className="space-y-4">
      {/* Items table */}
      <div className="folio-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="ledger">
            <thead>
              <tr>
                <th className="min-w-[200px]">{t("description")}</th>
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
                    colSpan={readOnly ? 5 : 6}
                    className="py-8 text-center text-[13px]"
                    style={{ color: "var(--muted)" }}
                  >
                    {t("noItems")}
                  </td>
                </tr>
              )}
              {items.map((item, index) => (
                <tr key={`${uid}-${index}`}>
                  {/* Description */}
                  <td>
                    {readOnly ? (
                      <span className="text-sm">{item.description}</span>
                    ) : (
                      <Input
                        value={item.description}
                        onChange={(e) =>
                          updateItem(index, { description: e.target.value })
                        }
                        placeholder={t("descriptionPlaceholder")}
                        className="h-7 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
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
                        onChange={(e) =>
                          updateItem(index, { quantity: e.target.value })
                        }
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
                        onChange={(e) =>
                          updateItem(index, { unit_price: e.target.value })
                        }
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
                        onChange={(v) => updateItem(index, { vat_rate: v })}
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
                        onClick={() => removeItem(index)}
                        aria-label={t("removeLine")}
                      >
                        <Trash2 size={12} style={{ color: "var(--muted)" }} />
                      </Button>
                    </td>
                  )}
                </tr>
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
