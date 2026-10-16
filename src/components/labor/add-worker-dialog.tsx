"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
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
import { PersonTypeahead, type PersonChoice } from "@/components/persons/person-typeahead";
import type {
  Worker,
  CreateWorkerPayload,
  UpdateWorkerPayload,
} from "@/types/labor";
import type { LaborRole } from "@/types/labor-role";
import { RoleSelectWithCreate } from "./role-select-with-create";
import { MAX_DAILY_AMOUNT } from "@/lib/numeric-bounds";
import { ApiError } from "@/lib/api/http";
import { parseMoneyInput } from "@/lib/utils/parse-money-input";

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
  /** The project's company: its roles are listed, and inline "Create" adds there. */
  companyId?: string | null;
  /**
   * Reload the company's roles from the server and return them. Called each
   * time the dialog opens (roles added or deleted elsewhere must not go
   * stale) and after the API refuses the chosen role.
   */
  onRefreshRoles?: () => Promise<LaborRole[] | null>;
}

/** The API refused the role: deleted, or not the project's company (400 InvalidLaborRole). */
function isInvalidRoleError(err: unknown): boolean {
  if (!(err instanceof ApiError) || err.status !== 400) return false;
  const data = err.data as { error?: string; message?: string } | undefined;
  return data?.error === "InvalidLaborRole" || data?.message === "Labor role not found";
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
  companyId,
  onRefreshRoles,
}: AddWorkerDialogProps) {
  const t = useTranslations("labor");
  const locale = useLocale();

  // Create-flow state
  const [selectedPerson, setSelectedPerson] = useState<PersonChoice | null>(
    null,
  );
  // A new person (typed in the search) is only created with the worker:
  // its name and phone are edited here until then.
  const [draftName, setDraftName] = useState("");
  const [draftPhone, setDraftPhone] = useState("");
  const isDraft = !!selectedPerson?.draft;

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
  // The API refused the role (deleted elsewhere, or another company's): shown under the role field.
  const [roleUnavailable, setRoleUnavailable] = useState(false);

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

  // Roles change elsewhere (Settings, another tab, a colleague): reload them
  // every time the dialog opens instead of trusting the list the page loaded.
  useEffect(() => {
    if (open) void onRefreshRoles?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on opening; a new callback identity must not refetch
  }, [open]);

  /** The chosen role is gone or foreign: clear it, reload the list and say so under the field. */
  const handleRoleRefused = () => {
    setRoleId(null);
    setRoleUnavailable(true);
    void onRefreshRoles?.();
  };

  const handlePersonChange = (person: PersonChoice) => {
    setSelectedPerson(person);
    setDraftName(person.draft ? person.name : "");
    setDraftPhone(person.draft ? (person.phone ?? "") : "");
    setPhoneInvalid(false);
  };

  const handleClose = () => {
    setSelectedPerson(null);
    setDraftName("");
    setDraftPhone("");
    setName("");
    setPhone("");
    setDailyRate("");
    setRoleId(null);
    setError(null);
    setPhoneInvalid(false);
    setRoleUnavailable(false);
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPhoneInvalid(false);
    setRoleUnavailable(false);

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
        else if (isInvalidRoleError(err)) handleRoleRefused();
        else if (err instanceof ApiError && err.status === 409) setError(t("errors.sharedPersonEdit"));
        else setError(t("errors.saveWorkerFailed"));
      } finally {
        setIsSaving(false);
      }
      return;
    }

    // Create path — Person selection and rate are required.
    // "150,50" and "150.50" both read as 150.5 (a number input dropped the comma: 15050).
    const rate = parseMoneyInput(dailyRate) ?? Number.NaN;
    if (isNaN(rate) || rate <= 0) {
      setError(t("errors.dailyRatePositive"));
      return;
    }
    if (rate > MAX_DAILY_AMOUNT) {
      setError(t("errors.amountTooLarge", { max: MAX_DAILY_AMOUNT }));
      return;
    }
    if (!selectedPerson || (isDraft && !draftName.trim())) {
      setError(t("errors.workerNameRequired"));
      return;
    }
    setIsSaving(true);
    try {
      await onSave(
        isDraft
          ? {
              // New person: created by the server together with the worker
              // (and matched to the directory by phone when one is given).
              name: draftName.trim(),
              daily_rate: rate,
              phone: draftPhone.trim() || undefined,
              role_id: roleId ?? undefined,
            }
          : {
              name: selectedPerson.name,
              daily_rate: rate,
              phone: selectedPerson.phone ?? undefined,
              person_id: selectedPerson.id,
              role_id: roleId ?? undefined,
            },
      );
      handleClose();
    } catch (err) {
      // 409: the person already has a worker row here (the API names it and
      // whether it is deactivated, in which case it only needs reactivating).
      if (isInvalidPhoneError(err)) {
        setPhoneInvalid(true);
      } else if (err instanceof ApiError && err.status === 409) {
        const inactive = (err.data as { is_active?: boolean } | undefined)?.is_active === false;
        setError(t(inactive ? "errors.workerAlreadyOnProjectInactive" : "errors.workerAlreadyOnProject"));
      } else if (isInvalidRoleError(err)) {
        handleRoleRefused();
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
                onChange={handlePersonChange}
                placeholder={t("workerName")}
                excludeIds={existingPersonIds}
                companyId={companyId ?? undefined}
              />
              {isDraft && (
                <div className="space-y-3 rounded-md border border-dashed p-3">
                  <p className="text-muted-foreground text-xs">{t("newPersonHint")}</p>
                  <div className="space-y-1">
                    <Label htmlFor="draft-name">{t("workerName")}</Label>
                    <Input
                      id="draft-name"
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      maxLength={255}
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="draft-phone">{t("workerPhone")}</Label>
                    <Input
                      id="draft-phone"
                      type="tel"
                      inputMode="tel"
                      value={draftPhone}
                      maxLength={50}
                      onChange={(e) => {
                        setDraftPhone(e.target.value);
                        setPhoneInvalid(false);
                      }}
                      placeholder="+33 6 12 34 56 78"
                      aria-invalid={phoneInvalid || undefined}
                      aria-describedby={phoneInvalid ? "draft-phone-error" : undefined}
                    />
                    {phoneInvalid && (
                      <p id="draft-phone-error" className="text-destructive text-sm" role="alert">
                        {t("errors.invalidPhone")}
                      </p>
                    )}
                  </div>
                </div>
              )}
              {!isDraft && selectedPerson?.phone && (
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
                onChange={(next) => {
                  setRoleId(next);
                  setRoleUnavailable(false);
                }}
                companyId={companyId}
                onRefreshRoles={onRefreshRoles}
                selectedFallback={
                  editWorker && roleId === editWorker.role_id && editWorker.role_name
                    ? {
                        name: editWorker.role_name,
                        color: editWorker.role_color ?? "#94A3B8",
                        slug: editWorker.role_slug,
                      }
                    : undefined
                }
                onRoleCreated={(role) => {
                  onRoleCreated?.(role);
                }}
                canManage={canManageRoles}
                onRoleUpdated={onRoleUpdated}
                onRoleDeleted={onRoleDeleted}
              />
              {roleUnavailable && (
                <p role="alert" className="text-destructive text-sm">
                  {t("errors.roleUnavailable")}
                </p>
              )}
            </div>
          )}

          {!isEdit && (
            <div className="space-y-2">
              <Label htmlFor="dailyRate">{t("dailyRate")} (EUR)</Label>
              <Input
                id="dailyRate"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={dailyRate}
                onChange={(e) => setDailyRate(e.target.value)}
                placeholder={locale === "en" ? "100.00" : "100,00"}
              />
            </div>
          )}

          {error && (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
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
