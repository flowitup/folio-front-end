"use client";

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
import { Textarea } from "@/components/ui/textarea";
import { UnitSelect } from "@/components/chiffrage/unit-select";
import type { ChiffrageArticle, ChiffrageUnit } from "@/lib/api/chiffrage";

interface Props {
  open: boolean;
  article: ChiffrageArticle | null;
  units: ChiffrageUnit[];
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: {
    name: string;
    quantity: string;
    unit: string | null;
    note: string | null;
  }) => void;
  onCreateUnit: (symbol: string) => Promise<ChiffrageUnit | null>;
}

export function ArticleFormDialog({
  open,
  article,
  units,
  submitting,
  onOpenChange,
  onSubmit,
  onCreateUnit,
}: Props) {
  const t = useTranslations("chiffrage");
  // Mounted only while open (see the page shell), so initialisers are the reset.
  const [name, setName] = useState(article?.name ?? "");
  const [qty, setQty] = useState(article ? String(article.quantity) : "1");
  const [unit, setUnit] = useState<string | null>(article?.unit ?? null);
  const [note, setNote] = useState(article?.note ?? "");

  const qtyValid =
    qty.trim() !== "" && Number(qty) >= 0 && !Number.isNaN(Number(qty));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !qtyValid) return;
    onSubmit({
      name: name.trim(),
      quantity: qty,
      unit,
      note: note.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>
              {article ? t("editArticle") : t("newArticle")}
            </DialogTitle>
            <DialogDescription>{t("articleDialogHint")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="article-name">{t("articleName")}</Label>
              <Input
                id="article-name"
                value={name}
                maxLength={200}
                placeholder={t("articlePlaceholder")}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="article-qty">{t("quantity")}</Label>
                <Input
                  id="article-qty"
                  type="number"
                  min="0"
                  step="0.001"
                  inputMode="decimal"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="article-unit">{t("unit")}</Label>
                <UnitSelect
                  value={unit}
                  units={units}
                  onChange={setUnit}
                  onCreateUnit={onCreateUnit}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="article-note">{t("noteOptional")}</Label>
              <Textarea
                id="article-note"
                value={note}
                rows={2}
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
            <Button
              type="submit"
              disabled={submitting || !name.trim() || !qtyValid}
            >
              {article ? t("save") : t("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
