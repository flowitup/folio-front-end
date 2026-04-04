"use client";

import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Worker, LogAttendancePayload } from "@/types/labor";

interface LogAttendanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: LogAttendancePayload) => Promise<void>;
  workers: Worker[];
}

export function LogAttendanceDialog({
  open,
  onOpenChange,
  onSave,
  workers,
}: LogAttendanceDialogProps) {
  const t = useTranslations("labor");
  const [workerId, setWorkerId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [amountOverride, setAmountOverride] = useState("");
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!workerId) {
      setError(t("filterWorker") + " is required");
      return;
    }

    if (!date) {
      setError(t("date") + " is required");
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        worker_id: workerId,
        date,
        amount_override: amountOverride ? parseFloat(amountOverride) : undefined,
        note: note.trim() || undefined,
      });
      handleClose();
    } catch (err: unknown) {
      // Check for duplicate entry error (409)
      if (err instanceof Error && err.message.includes("409")) {
        setError(t("duplicateEntry"));
      } else {
        setError("Failed to log attendance");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setWorkerId("");
    setDate(new Date().toISOString().split("T")[0]);
    setAmountOverride("");
    setNote("");
    setError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("logAttendance")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t("filterWorker")}</Label>
            <Select value={workerId} onValueChange={setWorkerId}>
              <SelectTrigger>
                <SelectValue placeholder={t("filterWorker")} />
              </SelectTrigger>
              <SelectContent>
                {workers.filter((w) => w.is_active).map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">{t("date")}</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="override">{t("override")} (EUR)</Label>
            <Input
              id="override"
              type="number"
              step="0.01"
              min="0"
              value={amountOverride}
              onChange={(e) => setAmountOverride(e.target.value)}
              placeholder="Leave empty for default rate"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">{t("note")}</Label>
            <Input
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("note")}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
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
