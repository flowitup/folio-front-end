"use client";

/**
 * Quote entry with an HT/TTC toggle.
 *
 * Leroy Merlin prints TTC on the shelf label, Point P quotes HT. Forcing the
 * user to convert by hand is where a 20% comparison error creeps in, so the
 * form accepts whichever figure they are reading and always stores HT.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { htToTtc, money, ttcToHt } from "@/components/chiffrage/format";
import { StoreSelect } from "@/components/chiffrage/store-select";
import { SupplierProductPicker } from "@/components/chiffrage/supplier-product-picker";
import type { ChiffrageQuote, ChiffrageStore } from "@/lib/api/chiffrage";

const TVA_PRESETS = ["20", "10", "5.5"];

export interface QuoteFormValues {
  store_id: string | null;
  supplier_name: string | null;
  supplier_id: string | null;
  library_product_id: string | null;
  unit_price_ht: string;
  tva_rate: string;
  product_url: string | null;
  note: string | null;
}

interface Props {
  open: boolean;
  quote: ChiffrageQuote | null;
  submitting: boolean;
  /** Enables the bibliothèque picker; null when the project has no company. */
  companyId: string | null;
  /** The project's shops — a price must name one of these. */
  stores: ChiffrageStore[];
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: QuoteFormValues) => void;
  onCreateStore: (name: string) => Promise<ChiffrageStore | null>;
}

export function QuoteFormDialog({
  open,
  quote,
  submitting,
  companyId,
  stores,
  onOpenChange,
  onSubmit,
  onCreateStore,
}: Props) {
  const t = useTranslations("chiffrage");
  // Mounted only while open (see the page shell), so initialisers are the reset.
  // Editing always starts on the HT tab because HT is what is stored.
  const [storeId, setStoreId] = useState<string | null>(quote?.store_id ?? null);
  const [mode, setMode] = useState<"ht" | "ttc">("ht");
  const [price, setPrice] = useState(quote ? String(quote.unit_price_ht) : "");
  const [tva, setTva] = useState(quote ? String(quote.tva_rate) : "20");
  const [url, setUrl] = useState(quote?.product_url ?? "");
  const [note, setNote] = useState(quote?.note ?? "");
  const [supplierId, setSupplierId] = useState<string | null>(quote?.supplier_id ?? null);
  const [productId, setProductId] = useState<string | null>(quote?.library_product_id ?? null);

  // Surfaced after a submit attempt, never while the user is still typing.
  const [error, setError] = useState<string | null>(null);

  const priceNum = Number(price);
  const tvaNum = Number(tva);
  // Price validity is deliberately independent of the fournisseur: the HT/TTC
  // preview has to confirm the figure as soon as it is typed, whatever else is
  // still blank, or the price looks like it was not registered at all.
  const priceValid =
    price.trim() !== "" && !Number.isNaN(priceNum) && priceNum >= 0;
  const tvaValid = !Number.isNaN(tvaNum) && tvaNum >= 0 && tvaNum <= 100;
  // The shop is what makes the price comparable, so it is what is required.
  const storeValid = storeId !== null;
  const converts = priceValid && tvaValid;

  // What actually gets stored, whichever way the user typed it.
  const htValue = converts
    ? mode === "ht"
      ? priceNum
      : ttcToHt(priceNum, tvaNum)
    : 0;
  const ttcValue = converts
    ? mode === "ht"
      ? htToTtc(priceNum, tvaNum)
      : priceNum
    : 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    // Validated on submit rather than by disabling the button: a dead button
    // tells the user nothing about which field is holding the price back.
    if (!priceValid) {
      setError(t("priceRequired"));
      return;
    }
    if (!tvaValid) {
      setError(t("tvaInvalid"));
      return;
    }
    if (!storeValid) {
      setError(t("storeRequired"));
      return;
    }
    setError(null);
    onSubmit({
      store_id: storeId,
      // A readable snapshot of the shop, kept so deleting the shop later never
      // blanks the row out. The link, not this string, drives the comparison.
      supplier_name: stores.find((s) => s.id === storeId)?.name ?? null,
      supplier_id: supplierId,
      library_product_id: productId,
      unit_price_ht: htValue.toFixed(4),
      tva_rate: tva,
      product_url: url.trim() || null,
      note: note.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{quote ? t("editQuote") : t("newQuote")}</DialogTitle>
            <DialogDescription>{t("quoteDialogHint")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <SupplierProductPicker
              companyId={companyId}
              onPick={(picked) => {
                // Prefill, never overwrite silently: the price is a past
                // purchase and the user still confirms it on the HT/TTC tabs.
                // The library supplier is matched to a shop by name when the
                // project already has one; otherwise the user picks it.
                if (picked.supplierName) {
                  const match = stores.find(
                    (s) =>
                      s.name.trim().toLowerCase() ===
                      picked.supplierName!.trim().toLowerCase(),
                  );
                  if (match) setStoreId(match.id);
                }
                setSupplierId(picked.supplierId);
                setProductId(picked.productId);
                if (picked.productUrl) setUrl(picked.productUrl);
                if (picked.suggestedPrice) {
                  setMode("ht");
                  setPrice(picked.suggestedPrice);
                }
                setError(null);
              }}
            />

            <div className="space-y-2">
              {/* The asterisk sits beside the Label, not inside it, so the
                  field's accessible name stays the plain label. */}
              <div className="flex items-center gap-1">
                <Label htmlFor="quote-store">{t("shop")}</Label>
                <span aria-hidden="true" className="text-destructive">
                  *
                </span>
              </div>
              <StoreSelect
                value={storeId}
                stores={stores}
                invalid={error !== null && !storeValid}
                onChange={(id) => {
                  setStoreId(id);
                  setError(null);
                }}
                onCreateStore={onCreateStore}
              />
              <p className="text-xs text-muted-foreground">
                {t("shopHelp")}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="quote-price">{t("unitPrice")}</Label>
                <div
                  className="flex gap-1"
                  role="group"
                  aria-label={t("priceMode")}
                >
                  {(["ht", "ttc"] as const).map((m) => (
                    <Button
                      key={m}
                      type="button"
                      size="sm"
                      className="h-7 px-2"
                      variant={mode === m ? "default" : "outline"}
                      onClick={() => setMode(m)}
                      data-testid={`price-mode-${m}`}
                    >
                      {m.toUpperCase()}
                    </Button>
                  ))}
                </div>
              </div>
              <Input
                id="quote-price"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={price}
                placeholder={
                  mode === "ht"
                    ? t("pricePlaceholderHt")
                    : t("pricePlaceholderTtc")
                }
                aria-invalid={error !== null && !priceValid}
                onChange={(e) => {
                  setPrice(e.target.value);
                  setError(null);
                }}
              />
              {converts ? (
                <p
                  className="text-xs text-muted-foreground"
                  data-testid="price-conversion"
                >
                  {t("storedAsHt", {
                    ht: money(htValue),
                    ttc: money(ttcValue),
                  })}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="quote-tva">{t("tvaRate")}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="quote-tva"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  inputMode="decimal"
                  value={tva}
                  aria-invalid={error !== null && !tvaValid}
                  onChange={(e) => {
                    setTva(e.target.value);
                    setError(null);
                  }}
                  className="w-24"
                />
                <div className="flex gap-1">
                  {TVA_PRESETS.map((rate) => (
                    <Button
                      key={rate}
                      type="button"
                      size="sm"
                      variant={tva === rate ? "secondary" : "ghost"}
                      className="h-7 px-2"
                      onClick={() => setTva(rate)}
                    >
                      {rate}%
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quote-url">{t("productUrlOptional")}</Label>
              <Input
                id="quote-url"
                type="url"
                value={url}
                maxLength={500}
                placeholder="https://"
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quote-note">{t("noteOptional")}</Label>
              <Input
                id="quote-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            {error ? (
              <p
                className="text-sm text-destructive"
                role="alert"
                data-testid="quote-form-error"
              >
                {error}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={submitting}>
              {quote ? t("save") : t("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
