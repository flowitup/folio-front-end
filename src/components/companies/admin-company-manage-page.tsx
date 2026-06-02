"use client";

/**
 * AdminCompanyManagePage — full admin management UI for a single company.
 *
 * Four tabs (manual implementation — no Tabs primitive in this project):
 *   1. Edit   — update all company fields
 *   2. Invites — generate / revoke invite token; shows TokenGeneratedDialog one-shot
 *   3. Users  — AttachedUsersTable with Boot action
 *   4. Delete — destructive AlertDialog
 *
 * Submit guards: every async handler uses useRef.
 * Regenerate flow: if generateInviteToken returns active_token_exists (409),
 *   automatically retries with regenerate=true — matches spec.
 */

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Save, Zap, Trash2, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TokenGeneratedDialog } from "@/components/companies/token-generated-dialog";
import { AttachedUsersTable } from "@/components/companies/attached-users-table";
import {
  updateCompanyAction,
  deleteCompanyAction,
  generateInviteTokenAction,
  revokeInviteTokenAction,
  fetchAttachedUsersAction,
} from "@/app/[locale]/(app)/settings/_actions/companies-actions";
import type { Company, CompanyInviteTokenGenerated, AttachedUser } from "@/types/companies";
import type { UpdateCompanyPayload } from "@/lib/api/companies/companies";

// ---------------------------------------------------------------------------
// Tab type
// ---------------------------------------------------------------------------

type ManageTab = "edit" | "invites" | "users" | "delete";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AdminCompanyManagePageProps {
  company: Company;
  initialUsers: AttachedUser[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AdminCompanyManagePage({
  company,
  initialUsers,
}: AdminCompanyManagePageProps) {
  const t = useTranslations("companies");
  const locale = useLocale();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<ManageTab>("edit");

  // ---- Edit tab state ----
  const [form, setForm] = useState<UpdateCompanyPayload>({
    legal_name: company.legal_name,
    address: company.address,
    siret: company.siret,
    tva_number: company.tva_number,
    iban: company.iban,
    bic: company.bic,
    logo_url: company.logo_url,
    default_payment_terms: company.default_payment_terms,
    prefix_override: company.prefix_override,
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  // ---- Invite tab state ----
  const [generatedToken, setGeneratedToken] = useState<CompanyInviteTokenGenerated | null>(null);
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const generatingRef = useRef(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const revokingRef = useRef(false);
  const [revokeConfirmOpen, setRevokeConfirmOpen] = useState(false);
  const [regenConfirmOpen, setRegenConfirmOpen] = useState(false);

  // ---- Users tab state ----
  const [users, setUsers] = useState<AttachedUser[]>(initialUsers);
  const fetchingUsersRef = useRef(false);

  // ---- Delete tab state ----
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const deletingRef = useRef(false);

  // ---------------------------------------------------------------------------
  // Edit tab handlers
  // ---------------------------------------------------------------------------

  function setField(field: keyof UpdateCompanyPayload) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const val = e.target.value;
      setForm((prev) => ({ ...prev, [field]: val === "" ? null : val }));
      setFieldErrors((prev) => {
        const n = { ...prev };
        delete n[field];
        return n;
      });
    };
  }

  function validateEdit(): boolean {
    const errors: Record<string, string> = {};
    if (!form.legal_name?.trim()) errors.legal_name = t("form.errors.legalNameRequired");
    if (!form.address?.trim()) errors.address = t("form.errors.addressRequired");
    if (form.logo_url) {
      try {
        const u = new URL(form.logo_url);
        if (!/^https?:$/.test(u.protocol)) {
          errors.logo_url = t("form.errors.logoUrlInvalidScheme");
        }
      } catch {
        errors.logo_url = t("form.errors.logoUrlInvalidUrl");
      }
    }
    if (form.prefix_override) {
      if (form.prefix_override.length > 8) errors.prefix_override = t("form.errors.prefixTooLong");
      else if (!/^[A-Z0-9]+$/.test(form.prefix_override))
        errors.prefix_override = t("form.errors.prefixInvalidChars");
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!validateEdit() || savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);
    try {
      const result = await updateCompanyAction(company.id, form);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success(t("admin.manage.edit.savedToast"));
    } catch {
      toast.error(t("form.errors.generic"));
    } finally {
      setIsSaving(false);
      savingRef.current = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Invite tab handlers
  // ---------------------------------------------------------------------------

  async function doGenerate(regenerate: boolean) {
    if (generatingRef.current) return;
    generatingRef.current = true;
    setIsGenerating(true);
    try {
      const result = await generateInviteTokenAction(company.id, { regenerate, role: inviteRole });
      if (!result.ok) {
        if (result.error.code === "active_token_exists" && !regenerate) {
          // Prompt admin to confirm regeneration
          setRegenConfirmOpen(true);
          return;
        }
        toast.error(result.error.message);
        return;
      }
      // Show token once
      setGeneratedToken(result.data);
      setTokenDialogOpen(true);
    } catch {
      toast.error(t("form.errors.generic"));
    } finally {
      setIsGenerating(false);
      generatingRef.current = false;
    }
  }

  async function handleRevoke() {
    if (revokingRef.current) return;
    revokingRef.current = true;
    setIsRevoking(true);
    try {
      const result = await revokeInviteTokenAction(company.id);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setRevokeConfirmOpen(false);
      toast.success(t("admin.manage.invites.revokedToast"));
    } catch {
      toast.error(t("form.errors.generic"));
    } finally {
      setIsRevoking(false);
      revokingRef.current = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Users tab handlers
  // ---------------------------------------------------------------------------

  const refreshUsers = useCallback(async () => {
    if (fetchingUsersRef.current) return;
    fetchingUsersRef.current = true;
    try {
      const result = await fetchAttachedUsersAction(company.id);
      if (result.ok) setUsers(result.data);
    } finally {
      fetchingUsersRef.current = false;
    }
  }, [company.id]);

  // ---------------------------------------------------------------------------
  // Delete tab handlers
  // ---------------------------------------------------------------------------

  async function handleDelete() {
    if (deletingRef.current) return;
    deletingRef.current = true;
    setIsDeleting(true);
    try {
      const result = await deleteCompanyAction(company.id);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setDeleteConfirmOpen(false);
      toast.success(t("admin.manage.delete.deletedToast"));
      router.push(`/${locale}/settings`);
    } catch {
      toast.error(t("form.errors.generic"));
    } finally {
      setIsDeleting(false);
      deletingRef.current = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const str = (v: string | null | undefined) => v ?? "";

  const TABS: { key: ManageTab; label: string }[] = [
    { key: "edit", label: t("admin.manage.tabs.edit") },
    { key: "invites", label: t("admin.manage.tabs.invites") },
    { key: "users", label: t("admin.manage.tabs.users") },
    { key: "delete", label: t("admin.manage.tabs.delete") },
  ];

  return (
    <div className="space-y-6">
      {/* Company name heading */}
      <div>
        <h2 className="font-display text-[24px] font-medium tracking-tight">
          {company.legal_name}
        </h2>
        <p className="text-[13px]" style={{ color: "var(--muted)" }}>
          {company.address}
        </p>
      </div>

      {/* Tab nav */}
      <div className="flex gap-0.5 border-b" style={{ borderColor: "var(--line)" }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-[13px] font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent"
            } ${tab.key === "delete" ? "text-red-600 ml-auto" : ""}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Tab: Edit */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === "edit" && (
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="mp-legal-name">
                {t("form.fields.legalName.label")}
                <span className="ml-1 text-red-500">*</span>
              </Label>
              <Input
                id="mp-legal-name"
                value={str(form.legal_name)}
                onChange={setField("legal_name")}
                disabled={isSaving}
              />
              {fieldErrors.legal_name && (
                <p className="text-[12px] text-red-600">{fieldErrors.legal_name}</p>
              )}
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="mp-address">
                {t("form.fields.address.label")}
                <span className="ml-1 text-red-500">*</span>
              </Label>
              <Textarea
                id="mp-address"
                value={str(form.address)}
                onChange={setField("address")}
                disabled={isSaving}
                rows={2}
              />
              {fieldErrors.address && (
                <p className="text-[12px] text-red-600">{fieldErrors.address}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mp-siret">{t("form.fields.siret.label")}</Label>
              <Input id="mp-siret" value={str(form.siret)} onChange={setField("siret")} disabled={isSaving} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mp-tva">{t("form.fields.tvaNumber.label")}</Label>
              <Input id="mp-tva" value={str(form.tva_number)} onChange={setField("tva_number")} disabled={isSaving} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mp-iban">{t("form.fields.iban.label")}</Label>
              <Input id="mp-iban" value={str(form.iban)} onChange={setField("iban")} disabled={isSaving} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mp-bic">{t("form.fields.bic.label")}</Label>
              <Input id="mp-bic" value={str(form.bic)} onChange={setField("bic")} disabled={isSaving} />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="mp-logo">{t("form.fields.logoUrl.label")}</Label>
              <Input id="mp-logo" type="url" value={str(form.logo_url)} onChange={setField("logo_url")} disabled={isSaving} />
              {fieldErrors.logo_url && (
                <p className="text-[12px] text-red-600">{fieldErrors.logo_url}</p>
              )}
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="mp-terms">{t("form.fields.defaultPaymentTerms.label")}</Label>
              <Textarea id="mp-terms" value={str(form.default_payment_terms)} onChange={setField("default_payment_terms")} disabled={isSaving} rows={2} />
              <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                {t("form.fields.defaultPaymentTerms.help")}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mp-prefix">{t("form.fields.prefixOverride.label")}</Label>
              <Input
                id="mp-prefix"
                value={str(form.prefix_override)}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase();
                  setForm((prev) => ({ ...prev, prefix_override: val === "" ? null : val }));
                  setFieldErrors((prev) => { const n = { ...prev }; delete n.prefix_override; return n; });
                }}
                disabled={isSaving}
                maxLength={8}
              />
              {fieldErrors.prefix_override ? (
                <p className="text-[12px] text-red-600">{fieldErrors.prefix_override}</p>
              ) : (
                <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                  {t("form.fields.prefixOverride.help")}
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <Loader2 size={14} className="mr-2 animate-spin" />
              ) : (
                <Save size={14} className="mr-2" />
              )}
              {t("admin.manage.edit.save")}
            </Button>
          </div>
        </form>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Tab: Invites */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === "invites" && (
        <div className="space-y-6">
          <div className="folio-card p-5 space-y-4">
            <div>
              <h4 className="font-medium text-[15px]">
                {t("admin.manage.invites.title")}
              </h4>
              <p className="mt-1 text-[13px]" style={{ color: "var(--muted)" }}>
                {t("admin.manage.invites.description")}
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="invite-role"
                className="text-[12px] font-medium"
                style={{ color: "var(--muted)" }}
              >
                {t("admin.manage.invites.roleLabel")}
              </label>
              <select
                id="invite-role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as "admin" | "member")}
                disabled={isGenerating || isRevoking}
                className="h-9 w-fit rounded-md border px-2 text-[13px]"
                style={{ borderColor: "var(--border)", background: "var(--paper)" }}
              >
                <option value="member">{t("admin.manage.invites.roleMemberOption")}</option>
                <option value="admin">{t("admin.manage.invites.roleAdminOption")}</option>
              </select>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={() => void doGenerate(false)}
                disabled={isGenerating || isRevoking}
              >
                {isGenerating ? (
                  <Loader2 size={14} className="mr-2 animate-spin" />
                ) : (
                  <Zap size={14} className="mr-2" />
                )}
                {t("admin.manage.invites.generate")}
              </Button>

              <Button
                variant="outline"
                onClick={() => setRevokeConfirmOpen(true)}
                disabled={isRevoking || isGenerating}
                className="text-red-600 border-red-200 hover:border-red-300 hover:text-red-700"
              >
                {isRevoking ? (
                  <Loader2 size={14} className="mr-2 animate-spin" />
                ) : (
                  <X size={14} className="mr-2" />
                )}
                {t("admin.manage.invites.revoke")}
              </Button>
            </div>

            <p className="text-[12px]" style={{ color: "var(--muted)" }}>
              {t("admin.manage.invites.policyNote")}
            </p>
          </div>

          {/* Token generated dialog */}
          <TokenGeneratedDialog
            open={tokenDialogOpen}
            onOpenChange={(open) => {
              setTokenDialogOpen(open);
              if (!open) setGeneratedToken(null); // discard plaintext on close
            }}
            tokenData={generatedToken}
          />

          {/* Revoke confirm */}
          <AlertDialog open={revokeConfirmOpen} onOpenChange={setRevokeConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("admin.manage.invites.revoke")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("admin.manage.invites.revokeConfirm")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isRevoking}>
                  {t("form.actions.cancel")}
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleRevoke}
                  disabled={isRevoking}
                  className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                >
                  {isRevoking && <Loader2 size={12} className="mr-1.5 animate-spin" />}
                  {t("admin.manage.invites.revoke")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Regenerate confirm (active token exists) */}
          <AlertDialog open={regenConfirmOpen} onOpenChange={setRegenConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("admin.manage.invites.regenerate")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("admin.manage.invites.regenerateConfirm")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("form.actions.cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    setRegenConfirmOpen(false);
                    void doGenerate(true);
                  }}
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  <RefreshCw size={12} className="mr-1.5" />
                  {t("admin.manage.invites.regenerate")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Tab: Users */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === "users" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-[15px]">
              {t("admin.manage.tabs.users")}
            </h4>
            <span className="text-[12px]" style={{ color: "var(--muted)" }}>
              {users.length}{" "}
              {users.length === 1
                ? t("admin.manage.attached.countSingular")
                : t("admin.manage.attached.countPlural")}
            </span>
          </div>
          <AttachedUsersTable
            companyId={company.id}
            users={users}
            onMutated={refreshUsers}
          />
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Tab: Delete */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === "delete" && (
        <div className="folio-card border-red-200 p-5 space-y-4">
          <div>
            <h4 className="font-medium text-[15px] text-red-700">
              {t("admin.manage.delete.title")}
            </h4>
            <p className="mt-1 text-[13px]" style={{ color: "var(--muted)" }}>
              {t("admin.manage.delete.body")}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setDeleteConfirmOpen(true)}
            disabled={isDeleting}
            className="border-red-200 text-red-600 hover:border-red-300 hover:text-red-700"
          >
            {isDeleting ? (
              <Loader2 size={14} className="mr-2 animate-spin" />
            ) : (
              <Trash2 size={14} className="mr-2" />
            )}
            {t("admin.manage.delete.confirm")}
          </Button>
        </div>
      )}

      {/* Delete confirm dialog (rendered outside tab so it persists on navigate) */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.manage.delete.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.manage.delete.body")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {t("form.actions.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isDeleting && <Loader2 size={12} className="mr-1.5 animate-spin" />}
              {t("admin.manage.delete.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
