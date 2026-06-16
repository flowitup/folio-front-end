"use client";

import { useEffect, useState } from "react";
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
import { PersonTypeahead } from "@/components/persons/person-typeahead";
import type { PersonSummary } from "@/types/person";
import type {
  Worker,
  CreateWorkerPayload,
  UpdateWorkerPayload,
} from "@/types/labor";
import type { LaborRole } from "@/types/labor-role";
import { RoleSelectWithCreate } from "@/app/[locale]/(app)/projects/[id]/labor/components/role-select-with-create";

interface AddWorkerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: CreateWorkerPayload | UpdateWorkerPayload) => Promise<void>;
  editWorker?: Worker | null;
  roles?: LaborRole[];
  palette?: string[];
  onRoleCreated?: (role: LaborRole) => void;
}

/**
 * AddWorkerDialog
 *
 * Create flow (cook 1d-ii-b): picks or inline-creates a Person via
 * PersonTypeahead, then attaches a daily_rate. The Worker is linked to
 * the Person's id; name/phone derive from the Person selection.
 *
 * Edit flow: unchanged. The Worker's inline name/phone columns and
 * daily_rate remain editable. A future release (after workers.name and
 * workers.phone columns are dropped) will move name/phone edits to a
 * dedicated Person edit surface.
 */
export function AddWorkerDialog({
  open,
  onOpenChange,
  onSave,
  editWorker,
  roles = [],
  palette = [],
  onRoleCreated,
}: AddWorkerDialogProps) {
  const t = useTranslations("labor");

  // Create-flow state
  const [selectedPerson, setSelectedPerson] = useState<PersonSummary | null>(
    null,
  );

  // Edit-flow state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  // Shared state
  const [dailyRate, setDailyRate] = useState("");
  const [roleId, setRoleId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!editWorker;

  // Hydrate form when entering edit mode.
  useEffect(() => {
    if (open && editWorker) {
      setName(editWorker.name);
      setPhone(editWorker.phone || "");
      // daily_rate is intentionally not hydrated in edit mode:
      // rate changes are handled exclusively via the AdjustRateDialog.
      setRoleId(editWorker.role_id ?? null);
    }
    if (open && !editWorker) {
      setRoleId(null);
    }
  }, [open, editWorker]);

  const handleClose = () => {
    setSelectedPerson(null);
    setName("");
    setPhone("");
    setDailyRate("");
    setRoleId(null);
    setError(null);
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isEdit) {
      // Edit path: name/phone/role only — rate changes go through AdjustRateDialog.
      if (!name.trim()) {
        setError(t("workerName") + " is required");
        return;
      }

      setIsSaving(true);
      try {
        await onSave({
          name: name.trim(),
          phone: phone.trim() || undefined,
          role_id: roleId,
        });
        handleClose();
      } catch {
        setError("Failed to save worker");
      } finally {
        setIsSaving(false);
      }
      return;
    }

    // Create path — Person selection and rate are required.
    const rate = parseFloat(dailyRate);
    if (isNaN(rate) || rate <= 0) {
      setError(t("dailyRate") + " must be > 0");
      return;
    }
    if (!selectedPerson) {
      setError(t("workerName") + " is required");
      return;
    }
    setIsSaving(true);
    try {
      await onSave({
        name: selectedPerson.name,
        daily_rate: rate,
        phone: selectedPerson.phone ?? undefined,
        person_id: selectedPerson.id,
        role_id: roleId ?? undefined,
      });
      handleClose();
    } catch {
      setError("Failed to save worker");
    } finally {
      setIsSaving(false);
    }
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
          {isEdit ? (
            <>
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
                <Label htmlFor="phone">{t("workerPhone")}</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+33 6 12 34 56 78"
                />
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label>{t("workerName")}</Label>
              <PersonTypeahead
                value={selectedPerson}
                onChange={setSelectedPerson}
                placeholder={t("workerName")}
              />
              {selectedPerson?.phone && (
                <p className="text-muted-foreground font-mono text-xs">
                  {selectedPerson.phone}
                </p>
              )}
            </div>
          )}

          {/* Role selection — shown in both create and edit flows when roles exist */}
          {(roles.length > 0 || palette.length > 0) && (
            <div className="space-y-2">
              <Label>{t("role.label")}</Label>
              <RoleSelectWithCreate
                roles={roles}
                palette={palette}
                value={roleId}
                onChange={setRoleId}
                onRoleCreated={(role) => {
                  onRoleCreated?.(role);
                }}
              />
            </div>
          )}

          {!isEdit && (
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
          )}

          {error && <p className="text-destructive text-sm">{error}</p>}

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
