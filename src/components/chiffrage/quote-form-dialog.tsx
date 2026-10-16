"use client";

/**
 * Quote entry with an HT/TTC toggle.
 *
 * Leroy Merlin prints TTC on the shelf label, Point P quotes HT. Forcing the
 * user to convert by hand is where a 20% comparison error creeps in, so the
 * form accepts whichever figure they are reading and always stores HT.
 */

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

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
import { htToTtc, money, percent, ttcToHt } from "@/components/chiffrage/format";
import { StoreSelect } from "@/components/chiffrage/store-select";
import { SupplierProductPicker } from "@/components/chiffrage/supplier-product-picker";
import type { ChiffrageQuote, ChiffrageStore } from "@/lib/api/chiffrage";
import { MAX_QUOTE_UNIT_PRICE } from "@/lib/numeric-bounds";
import { parseMoneyInput } from "@/lib/utils/parse-money-input";
import { formatDecimalForInput } from "@/components/ui/decimal-input";

const TVA_PRESETS = ["20", "10", "5.5"];
// Width of the quote's supplier_name column (the API refuses anything longer).
const SUPPLIER_NAME_MAX = 120;

export interface QuoteFormValues {
  store_id: string | null;
  supplier_name: string | null;
  supplier_id: string | null;
  library_product_id: string | null;
  /** Omitted on an edit that left price, HT/TTC tab and TVA untouched: the
   * form shows the price rounded to cents, and re-sending that would
   * overwrite the stored 4-decimal value (e.g. 9.9917 → 9.99). */
  unit_price_ht?: string;
  tva_rate?: string;
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

/**
 * The product link as stored: null when empty, "https://" added to a link
 * typed without a scheme ("www.castorama.fr/…"), undefined when it is not an
 * http(s) address at all.
 */
export function normalizeProductUrl(raw: string): string | null | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withScheme);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return undefined;
    if (!parsed.hostname.includes(".")) return undefined;
    return withScheme;
  } catch {
    return undefined;
  }
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
  const locale = useLocale();
  // Mounted only while open (see the page shell), so initialisers are the reset.
  // Editing always starts on the HT tab because HT is what is stored.
  // Prefilled with the locale's decimal mark ("20,75" and "5,5" in French).
  const initialPrice = quote ? formatDecimalForInput(String(quote.unit_price_ht), locale) : "";
  const initialTva = quote ? formatDecimalForInput(String(quote.tva_rate), locale) : "20";
  const [storeId, setStoreId] = useState<string | null>(quote?.store_id ?? null);
  const [mode, setMode] = useState<"ht" | "ttc">("ht");
  const [price, setPrice] = useState(initialPrice);
  const [tva, setTva] = useState(initialTva);
  const [url, setUrl] = useState(quote?.product_url ?? "");
  const [note, setNote] = useState(quote?.note ?? "");
  const [supplierId, setSupplierId] = useState<string | null>(quote?.supplier_id ?? null);
  const [productId, setProductId] = useState<string | null>(quote?.library_product_id ?? null);

  // Surfaced after a submit attempt, never while the user is still typing.
  const [error, setError] = useState<string | null>(null);

  // The price and rate fields are text, not type="number": Chrome reads a
  // number field in the OS language, so in an English browser "19,99" became
  // 1999 without a word. Here "," and "." both work, and anything else is
  // refused. Prices are stored with 4 decimals, VAT rates with 2.
  const priceNum = parseMoneyInput(price, { maxDecimals: 4 }) ?? NaN;
  const tvaNum = parseMoneyInput(tva) ?? NaN;
  // Price validity is deliberately independent of the fournisseur: the HT/TTC
  // preview has to confirm the figure as soon as it is typed, whatever else is
  // still blank, or the price looks like it was not registered at all.
  const priceValid =
    price.trim() !== "" && !Number.isNaN(priceNum) && priceNum >= 0;
  const tvaValid = !Number.isNaN(tvaNum) && tvaNum >= 0 && tvaNum <= 100;
  // The shop is what makes the price comparable, so it is what is required.
  // A price whose shop was deleted keeps its shop name: it can still be
  // edited without picking another shop.
  const orphanName = quote && quote.store_id === null ? quote.supplier_name?.trim() || null : null;
  const storeValid = storeId !== null || orphanName !== null;
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
    if (htValue > MAX_QUOTE_UNIT_PRICE) {
      setError(t("priceTooLarge", { max: MAX_QUOTE_UNIT_PRICE }));
      return;
    }
    const productUrl = normalizeProductUrl(url);
    if (productUrl === undefined) {
      setError(t("productUrlInvalid"));
      return;
    }
    if (!storeValid) {
      setError(t("storeRequired"));
      return;
    }
    setError(null);
    const priceUnchanged =
      quote !== null &&
      mode === "ht" &&
      price === initialPrice &&
      tva === initialTva;
    onSubmit({
      store_id: storeId,
      // A readable snapshot of the shop, kept so deleting the shop later never
      // blanks the row out. The link, not this string, drives the comparison.
      // Shop names run to 160 characters, the snapshot column to 120.
      supplier_name:
        storeId === null
          ? orphanName
          : (stores.find((s) => s.id === storeId)?.name.slice(0, SUPPLIER_NAME_MAX) ?? null),
      supplier_id: supplierId,
      library_product_id: productId,
      ...(priceUnchanged ? {} : { unit_price_ht: htValue.toFixed(4), tva_rate: String(tvaNum) }),
      product_url: productUrl,
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
                <Label id="quote-store-label" htmlFor="quote-store">
                  {t("shop")}
                </Label>
                <span aria-hidden="true" className="text-destructive">
                  *
                </span>
              </div>
              <StoreSelect
                id="quote-store"
                labelledBy="quote-store-label"
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
                type="text"
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
                  type="text"
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
                      // Compared as numbers: a typed "5,5" is the 5,5 % preset.
                      variant={tvaNum === Number(rate) ? "secondary" : "ghost"}
                      className="h-7 px-2"
                      onClick={() => setTva(formatDecimalForInput(rate, locale))}
                    >
                      {percent(Number(rate))}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quote-url">{t("productUrlOptional")}</Label>
              <Input
                id="quote-url"
                // Text, not type="url": the browser would refuse "www.castorama.fr/…"
                // with a tooltip in its own language; the form checks it below.
                type="text"
                inputMode="url"
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
