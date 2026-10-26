"use client";

/**
 * Pick several suggested sections (Doublage, Chauffage, Salle de bains…) to
 * create in one go. Sections the project already has are shown ticked and
 * locked, so the same one is never created twice.
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
import { normalizeName, POSTE_TEMPLATES } from "@/components/chiffrage/poste-templates";

interface Props {
  open: boolean;
  /** Names of the sections the project already has. */
  existingNames: string[];
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (names: string[]) => void;
}

export function PosteTemplatesDialog({ open, existingNames, submitting, onOpenChange, onSubmit }: Props) {
  const t = useTranslations("chiffrage");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const have = new Set(existingNames.map(normalizeName));

  const toggle = (name: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("templatesTitle")}</DialogTitle>
          <DialogDescription>{t("templatesHint")}</DialogDescription>
        </DialogHeader>
        <ul className="grid max-h-[60vh] gap-1 overflow-y-auto sm:grid-cols-2" data-testid="poste-templates">
          {POSTE_TEMPLATES.map((tpl) => {
            const exists = have.has(normalizeName(tpl.name));
            return (
              <li key={tpl.key}>
                <label
                  className={`flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm ${
                    exists ? "opacity-60" : "hover:bg-muted"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4"
                    checked={exists || picked.has(tpl.name)}
                    disabled={exists}
                    onChange={() => toggle(tpl.name)}
                  />
                  <span>
                    <span className="block font-medium">{tpl.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {exists ? t("templateExists") : t(`template_${tpl.key}`)}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button type="button" disabled={picked.size === 0 || submitting} onClick={() => onSubmit([...picked])}>
            {t("templatesCreate", { count: picked.size })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
