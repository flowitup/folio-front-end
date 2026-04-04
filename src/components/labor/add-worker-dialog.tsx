"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { Worker, CreateWorkerPayload, UpdateWorkerPayload } from "@/types/labor";

interface AddWorkerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: CreateWorkerPayload | UpdateWorkerPayload) => Promise<void>;
  editWorker?: Worker | null;
}

export function AddWorkerDialog({
  open,
  onOpenChange,
  onSave,
  editWorker,
}: AddWorkerDialogProps) {
  const t = useTranslations("labor");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [dailyRate, setDailyRate] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!editWorker;

  // Sync form state when editWorker changes
  useEffect(() => {
    if (open && editWorker) {
      setName(editWorker.name);
      setPhone(editWorker.phone || "");
      setDailyRate(editWorker.daily_rate.toString());
    }
  }, [open, editWorker]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError(t("workerName") + " is required");
      return;
    }

    const rate = parseFloat(dailyRate);
    if (isNaN(rate) || rate <= 0) {
      setError(t("dailyRate") + " must be > 0");
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        name: name.trim(),
        daily_rate: rate,
        phone: phone.trim() || undefined,
      });
      handleClose();
    } catch {
      setError("Failed to save worker");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setName("");
    setPhone("");
    setDailyRate("");
    setError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("editWorker") : t("addWorker")}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t("workerName")}</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("workerName")}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dailyRate">{t("dailyRate")} (EUR)</Label>
            <Input
              id="dailyRate"
              type="number"
              step="0.01"
              min="0"
              value={dailyRate}
              onChange={(e) => setDailyRate(e.target.value)}
              placeholder="100.00"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">{t("workerPhone")}</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+33 6 12 34 56 78"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
