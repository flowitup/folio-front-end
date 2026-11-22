"use client";

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
import { Textarea } from "@/components/ui/textarea";
import { UnitSelect } from "@/components/chiffrage/unit-select";
import { RoomSelect } from "@/components/chiffrage/room-select";
import type {
  ChiffrageArticle,
  ChiffragePhase,
  ChiffrageRoom,
  ChiffrageUnit,
} from "@/lib/api/chiffrage";
import { MAX_ARTICLE_QUANTITY } from "@/lib/numeric-bounds";
import { parseMoneyInput } from "@/lib/utils/parse-money-input";
import { formatDecimalForInput } from "@/components/ui/decimal-input";

interface Props {
  open: boolean;
  article: ChiffrageArticle | null;
  units: ChiffrageUnit[];
  rooms: ChiffrageRoom[];
  /** The poste's stages (giai đoạn), in order. */
  phases?: ChiffragePhase[];
  /** Rank of the stage a new item starts in (the stage filter on screen), if any. */
  defaultStage?: number | null;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: {
    name: string;
    quantity: string;
    unit: string | null;
    note: string | null;
    room_id: string | null;
    /** Sent only when the poste has stages or the item had one. */
    phase_id?: string | null;
  }) => void;
  onCreateUnit: (symbol: string) => Promise<ChiffrageUnit | null>;
  /** Remove a custom unit (refused while articles use it). */
  onDeleteUnit?: (unit: ChiffrageUnit) => Promise<boolean>;
  onCreateRoom: (name: string) => Promise<ChiffrageRoom | null>;
  /** Add a stage to the poste from the picker; omitted, no stage picker shows. */
  onCreatePhase?: (name: string) => Promise<ChiffragePhase | null>;
}

export function ArticleFormDialog({
  open,
  article,
  units,
  rooms,
  phases = [],
  defaultStage = null,
  submitting,
  onOpenChange,
  onSubmit,
  onCreateUnit,
  onDeleteUnit,
  onCreateRoom,
  onCreatePhase,
}: Props) {
  const t = useTranslations("chiffrage");
  const locale = useLocale();
  // Mounted only while open (see the page shell), so initialisers are the reset.
  const [name, setName] = useState(article?.name ?? "");
  const [qty, setQty] = useState(
    article ? formatDecimalForInput(String(article.quantity), locale) : "1"
  );
  const [unit, setUnit] = useState<string | null>(article?.unit ?? null);
  const [note, setNote] = useState(article?.note ?? "");
  const [roomId, setRoomId] = useState<string | null>(article?.room_id ?? null);
  const [phaseId, setPhaseId] = useState<string | null>(
    article ? (article.phase_id ?? null) : defaultStage !== null ? (phases[defaultStage]?.id ?? null) : null
  );
  // A stage created from the picker is not in `phases` until the page re-reads the tree.
  const [createdPhases, setCreatedPhases] = useState<ChiffragePhase[]>([]);
  const phaseOptions = [...phases, ...createdPhases.filter((c) => !phases.some((p) => p.id === c.id))];
  // Unreadable text is flagged once the field is left, not on a half-typed "2,".
  const [qtyTouched, setQtyTouched] = useState(false);

  // A text field, not type="number": Chrome reads a number field in the OS
  // language, so in an English browser "2,5" became 25 without a word. Here
  // "," and "." both work (3 decimals, as stored) and anything else is refused.
  const qtyNum = parseMoneyInput(qty, { maxDecimals: 3, ambiguousGrouping: "decimal" });
  const qtyTooLarge = qtyNum !== null && qtyNum > MAX_ARTICLE_QUANTITY;
  const qtyInvalid = qty.trim() !== "" && qtyNum === null && qtyTouched;
  const qtyValid = qtyNum !== null && !qtyTooLarge;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || qtyNum === null || !qtyValid) return;
    onSubmit({
      name: name.trim(),
      quantity: String(qtyNum),
      unit,
      note: note.trim() || null,
      room_id: roomId,
      ...(phaseOptions.length > 0 || article?.phase_id ? { phase_id: phaseId } : {}),
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
              <Label id="article-room-label" htmlFor="article-room">
                {t("room")}
              </Label>
              <RoomSelect
                id="article-room"
                labelledBy="article-room-label"
                value={roomId}
                rooms={rooms}
                onChange={setRoomId}
                onCreateRoom={onCreateRoom}
              />
            </div>
            {onCreatePhase ? (
              <div className="space-y-2">
                <Label id="article-phase-label" htmlFor="article-phase">
                  {t("phase")}
                </Label>
                <RoomSelect
                  id="article-phase"
                  labelledBy="article-phase-label"
                  testId="phase-select"
                  value={phaseId}
                  rooms={phaseOptions}
                  onChange={setPhaseId}
                  onCreateRoom={async (name) => {
                    const created = await onCreatePhase(name);
                    if (created) setCreatedPhases((prev) => [...prev, created]);
                    return created;
                  }}
                  labels={{
                    none: t("noPhase"),
                    addPlaceholder: t("addPhasePlaceholder"),
                    add: t("addPhase"),
                  }}
                />
              </div>
            ) : null}
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
                  type="text"
                  inputMode="decimal"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  onBlur={() => setQtyTouched(true)}
                  aria-invalid={qtyTooLarge || qtyInvalid || undefined}
                />
                {qtyTooLarge ? (
                  <p className="text-xs text-destructive" role="alert">
                    {t("quantityTooLarge", { max: MAX_ARTICLE_QUANTITY })}
                  </p>
                ) : qtyInvalid ? (
                  <p className="text-xs text-destructive" role="alert">
                    {t("quantityInvalid")}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="article-unit">{t("unit")}</Label>
                <UnitSelect
                  value={unit}
                  units={units}
                  onChange={setUnit}
                  onCreateUnit={onCreateUnit}
                  onDeleteUnit={onDeleteUnit}
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
