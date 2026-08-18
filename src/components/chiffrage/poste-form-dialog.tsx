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
import type { ChiffragePoste } from "@/lib/api/chiffrage";

interface Props {
  open: boolean;
  poste: ChiffragePoste | null;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: { name: string; note: string | null }) => void;
}

export function PosteFormDialog({
  open,
  poste,
  submitting,
  onOpenChange,
  onSubmit,
}: Props) {
  const t = useTranslations("chiffrage");
  // The parent mounts this dialog only while it is open, so plain initialisers
  // reset the form for each new target — no effect needed.
  const [name, setName] = useState(poste?.name ?? "");
  const [note, setNote] = useState(poste?.note ?? "");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), note: note.trim() || null });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{poste ? t("editPoste") : t("newPoste")}</DialogTitle>
            <DialogDescription>{t("posteDialogHint")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="poste-name">{t("posteName")}</Label>
              <Input
                id="poste-name"
                value={name}
                maxLength={120}
                placeholder={t("postePlaceholder")}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="poste-note">{t("noteOptional")}</Label>
              <Textarea
                id="poste-note"
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
            <Button type="submit" disabled={submitting || !name.trim()}>
              {poste ? t("save") : t("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
