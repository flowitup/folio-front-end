"use client";

/**
 * AdminCompanyManagePage — full admin management UI for a single company.
 *
 * Five tabs (manual implementation — no Tabs primitive in this project):
 *   1. Edit     — update all company fields (CompanyProfileForm)
 *   2. Code     — the reusable company join code (mobile onboarding); the
 *                 only mechanism left to bring someone into the company
 *   3. Users    — AttachedUsersTable with Boot action
 *   4. Payments — PaymentMethodsSection
 *   5. Delete   — destructive AlertDialog
 *
 * Submit guards: every async handler uses useRef.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { AttachedUsersTable } from "@/components/companies/attached-users-table";
import { CompanyJoinCodeCard } from "@/components/companies/company-join-code-card";
import { CompanyProfileForm } from "@/components/companies/company-profile-form";
import {
  deleteCompanyAction,
  fetchAttachedUsersAction,
} from "@/app/[locale]/(app)/settings/_actions/companies-actions";
import type { Company, AttachedUser } from "@/types/companies";
import { PaymentMethodsSection } from "@/app/[locale]/(app)/settings/companies/[id]/_components/payment-methods-section";
import { listPaymentMethodsAction } from "@/app/[locale]/(app)/settings/companies/[id]/_actions/payment-methods-actions";
import type { PaymentMethod } from "@/lib/api/payment-methods-api";

// ---------------------------------------------------------------------------
// Tab type
// ---------------------------------------------------------------------------

type ManageTab = "edit" | "code" | "users" | "payments" | "delete";

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

  // ---- Payment methods tab state (refetched on every tab activation) ----
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[] | null>(null);
  const [paymentMethodsError, setPaymentMethodsError] = useState(false);
  useEffect(() => {
    if (activeTab !== "payments") return;
    let cancelled = false;
    setPaymentMethodsError(false);
    listPaymentMethodsAction(company.id)
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setPaymentMethods(result.data);
        } else {
          setPaymentMethodsError(true);
        }
      })
      .catch(() => {
        if (!cancelled) setPaymentMethodsError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, company.id]);

  // ---- Users tab state ----
  const [users, setUsers] = useState<AttachedUser[]>(initialUsers);
  const fetchingUsersRef = useRef(false);

  // ---- Delete tab state ----
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const deletingRef = useRef(false);

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

  const TABS: { key: ManageTab; label: string }[] = [
    { key: "edit", label: t("admin.manage.tabs.edit") },
    { key: "code", label: t("admin.manage.tabs.code") },
    { key: "users", label: t("admin.manage.tabs.users") },
    { key: "payments", label: t("admin.manage.tabs.payments") },
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
            } ${tab.key === "delete" ? "text-destructive ml-auto" : ""}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Tab: Edit */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === "edit" && <CompanyProfileForm company={company} />}

      {/* ------------------------------------------------------------------ */}
      {/* Tab: Code — the reusable company join code (only attach mechanism) */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === "code" && (
        <CompanyJoinCodeCard companyId={company.id} initialCode={company.join_code ?? null} />
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
      {/* Tab: Payment methods */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === "payments" &&
        (paymentMethodsError ? (
          <p className="text-[13px]" style={{ color: "var(--muted)" }}>
            {t("admin.manage.paymentsLoadError")}
          </p>
        ) : paymentMethods !== null ? (
          <PaymentMethodsSection initial={paymentMethods} companyId={company.id} />
        ) : (
          <p className="text-[13px]" style={{ color: "var(--muted)" }}>
            {t("admin.manage.paymentsLoading")}
          </p>
        ))}

      {/* ------------------------------------------------------------------ */}
      {/* Tab: Delete */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === "delete" && (
        <div className="folio-card border-destructive/30 p-5 space-y-4">
          <div>
            <h4 className="font-medium text-[15px] text-destructive">
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
            className="border-destructive/30 text-destructive hover:border-destructive/50 hover:text-destructive"
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
              className="bg-destructive hover:bg-destructive/90 focus:ring-destructive"
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
