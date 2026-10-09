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
import { RoleSelectWithCreate } from "./role-select-with-create";
import { MAX_DAILY_AMOUNT } from "@/lib/numeric-bounds";
import { ApiError } from "@/lib/api/http";

interface AddWorkerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: CreateWorkerPayload | UpdateWorkerPayload) => Promise<void>;
  editWorker?: Worker | null;
  roles?: LaborRole[];
  palette?: string[];
  onRoleCreated?: (role: LaborRole) => void;
  /** Company admin or manager: the role picker offers rename / recolor / delete. */
  canManageRoles?: boolean;
  onRoleUpdated?: (role: LaborRole) => void;
  onRoleDeleted?: (roleId: string) => void;
  /** People who already have a worker row on this project: the picker shows
   * them as unavailable (one person, one row per project). */
  existingPersonIds?: string[];
}

/** The API refused the worker's phone as not a phone number (400 InvalidPhone). */
function isInvalidPhoneError(err: unknown): boolean {
  return (
    err instanceof ApiError &&
    err.status === 400 &&
    (err.data as { error?: string } | undefined)?.error === "InvalidPhone"
  );
}

/**
 * AddWorkerDialog
 *
 * Create flow (cook 1d-ii-b): picks or inline-creates a Person via
 * PersonTypeahead, then attaches a daily_rate. The Worker is linked to
 * the Person's id; name/phone derive from the Person selection.
 *
 * Edit flow: name/phone/role. The name and phone are the shared Person's
 * (what every screen shows); saving them changes that person in every
 * project and company that uses them.
 */
export function AddWorkerDialog({
  open,
  onOpenChange,
  onSave,
  editWorker,
  roles = [],
  palette = [],
  onRoleCreated,
  canManageRoles = false,
  onRoleUpdated,
  onRoleDeleted,
  existingPersonIds,
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
  // The API refused the phone ("hello world"): shown under the phone field.
  const [phoneInvalid, setPhoneInvalid] = useState(false);

  const isEdit = !!editWorker;

  // Hydrate form when entering edit mode.
  useEffect(() => {
    if (open && editWorker) {
      setName(editWorker.person_name ?? editWorker.name);
      setPhone(editWorker.person_phone ?? editWorker.phone ?? "");
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
    setPhoneInvalid(false);
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPhoneInvalid(false);

    if (isEdit) {
      // Edit path: name/phone/role only — rate changes go through AdjustRateDialog.
      if (!name.trim()) {
        setError(t("errors.workerNameRequired"));
        return;
      }

      setIsSaving(true);
      try {
        await onSave({
          name: name.trim(),
          // "" clears the phone (the API reads an absent field as unchanged).
          phone: phone.trim(),
          role_id: roleId,
        });
        handleClose();
      } catch (err) {
        if (isInvalidPhoneError(err)) setPhoneInvalid(true);
        else setError(t("errors.saveWorkerFailed"));
      } finally {
        setIsSaving(false);
      }
      return;
    }

    // Create path — Person selection and rate are required.
    const rate = parseFloat(dailyRate);
    if (isNaN(rate) || rate <= 0) {
      setError(t("errors.dailyRatePositive"));
      return;
    }
    if (rate > MAX_DAILY_AMOUNT) {
      setError(t("errors.amountTooLarge", { max: MAX_DAILY_AMOUNT }));
      return;
    }
    if (!selectedPerson) {
      setError(t("errors.workerNameRequired"));
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
    } catch (err) {
      // 409: the person already has a worker row here (the API names it and
      // whether it is deactivated, in which case it only needs reactivating).
      if (err instanceof ApiError && err.status === 409) {
        const inactive = (err.data as { is_active?: boolean } | undefined)?.is_active === false;
        setError(t(inactive ? "errors.workerAlreadyOnProjectInactive" : "errors.workerAlreadyOnProject"));
      } else {
        setError(t("errors.saveWorkerFailed"));
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
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
                  maxLength={255}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">{t("workerPhone")}</Label>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  maxLength={50}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setPhoneInvalid(false);
                  }}
                  placeholder="+33 6 12 34 56 78"
                  aria-invalid={phoneInvalid || undefined}
                  aria-describedby={phoneInvalid ? "phone-error" : undefined}
                />
                {phoneInvalid && (
                  <p id="phone-error" className="text-destructive text-sm">
                    {t("errors.invalidPhone")}
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label>{t("workerName")}</Label>
              <PersonTypeahead
                value={selectedPerson}
                onChange={setSelectedPerson}
                placeholder={t("workerName")}
                excludeIds={existingPersonIds}
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
                canManage={canManageRoles}
                onRoleUpdated={onRoleUpdated}
                onRoleDeleted={onRoleDeleted}
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
                max={MAX_DAILY_AMOUNT}
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
