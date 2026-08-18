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
import { SupplierProductPicker } from "@/components/chiffrage/supplier-product-picker";
import type { ChiffrageQuote } from "@/lib/api/chiffrage";

const TVA_PRESETS = ["20", "10", "5.5"];

export interface QuoteFormValues {
  supplier_name: string;
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
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: QuoteFormValues) => void;
}

export function QuoteFormDialog({
  open,
  quote,
  submitting,
  companyId,
  onOpenChange,
  onSubmit,
}: Props) {
  const t = useTranslations("chiffrage");
  // Mounted only while open (see the page shell), so initialisers are the reset.
  // Editing always starts on the HT tab because HT is what is stored.
  const [supplier, setSupplier] = useState(quote?.supplier_name ?? "");
  const [mode, setMode] = useState<"ht" | "ttc">("ht");
  const [price, setPrice] = useState(quote ? String(quote.unit_price_ht) : "");
  const [tva, setTva] = useState(quote ? String(quote.tva_rate) : "20");
  const [url, setUrl] = useState(quote?.product_url ?? "");
  const [note, setNote] = useState(quote?.note ?? "");
  const [supplierId, setSupplierId] = useState<string | null>(quote?.supplier_id ?? null);
  const [productId, setProductId] = useState<string | null>(quote?.library_product_id ?? null);

  const priceNum = Number(price);
  const tvaNum = Number(tva);
  const valid =
    supplier.trim() !== "" &&
    price.trim() !== "" &&
    !Number.isNaN(priceNum) &&
    priceNum >= 0 &&
    !Number.isNaN(tvaNum) &&
    tvaNum >= 0 &&
    tvaNum <= 100;

  // What actually gets stored, whichever way the user typed it.
  const htValue = valid
    ? mode === "ht"
      ? priceNum
      : ttcToHt(priceNum, tvaNum)
    : 0;
  const ttcValue = valid
    ? mode === "ht"
      ? htToTtc(priceNum, tvaNum)
      : priceNum
    : 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    onSubmit({
      supplier_name: supplier.trim(),
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
                if (picked.supplierName) setSupplier(picked.supplierName);
                setSupplierId(picked.supplierId);
                setProductId(picked.productId);
                if (picked.productUrl) setUrl(picked.productUrl);
                if (picked.suggestedPrice) {
                  setMode("ht");
                  setPrice(picked.suggestedPrice);
                }
              }}
            />

            <div className="space-y-2">
              <Label htmlFor="quote-supplier">{t("supplier")}</Label>
              <Input
                id="quote-supplier"
                value={supplier}
                maxLength={120}
                placeholder={t("supplierPlaceholder")}
                onChange={(e) => setSupplier(e.target.value)}
                autoFocus
              />
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
                onChange={(e) => setPrice(e.target.value)}
              />
              {valid ? (
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
                  onChange={(e) => setTva(e.target.value)}
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
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={submitting || !valid}>
              {quote ? t("save") : t("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
