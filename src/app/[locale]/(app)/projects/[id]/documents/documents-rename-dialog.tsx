"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
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
import { Button } from "@/components/ui/button";
import type { ProjectDocument } from "@/lib/api/project-documents";

type Props = {
  doc: ProjectDocument | null;
  onCancel: () => void;
  onConfirm: (newFilename: string) => Promise<void> | void;
};

export function DocumentsRenameDialog({ doc, onCancel, onConfirm }: Props) {
  const t = useTranslations("documents.rename");
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (doc) setValue(doc.filename);
  }, [doc]);

  const extension = doc ? doc.filename.slice(doc.filename.lastIndexOf(".")) : "";
  const unchanged = value.trim() === doc?.filename;
  const empty = !value.trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (empty || unchanged || loading) return;
    setLoading(true);
    try {
      await onConfirm(value.trim());
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={doc !== null} onOpenChange={(open) => !open && !loading && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description", { extension })}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="rename-input" className="sr-only">
              {t("label")}
            </Label>
            <Input
              id="rename-input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={loading}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={loading || empty || unchanged}>
              {loading ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
