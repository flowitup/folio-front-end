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
import type { ChiffrageStore } from "@/lib/api/chiffrage";

interface Props {
  open: boolean;
  store: ChiffrageStore | null;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: { name: string; address: string | null }) => void;
}

export function StoreFormDialog({
  open,
  store,
  submitting,
  onOpenChange,
  onSubmit,
}: Props) {
  const t = useTranslations("chiffrage");
  // The parent mounts this dialog only while it is open, so plain initialisers
  // reset the form for each new target — no effect needed.
  const [name, setName] = useState(store?.name ?? "");
  const [address, setAddress] = useState(store?.address ?? "");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), address: address.trim() || null });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{store ? t("editStore") : t("addStore")}</DialogTitle>
            <DialogDescription>{t("storeDialogHint")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="store-name">{t("storeName")}</Label>
              <Input
                id="store-name"
                value={name}
                maxLength={160}
                placeholder={t("storeNamePlaceholder")}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="store-address">{t("storeAddressOptional")}</Label>
              <Textarea
                id="store-address"
                value={address}
                rows={2}
                maxLength={500}
                placeholder={t("storeAddressPlaceholder")}
                onChange={(e) => setAddress(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {t("storeAddressHint")}
              </p>
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
              {store ? t("save") : t("add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
