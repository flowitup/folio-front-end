"use client";

/**
 * CompanyMembersTable — Settings › Company's single people table.
 *
 * Merges two backend sources (see `mergeMemberRows`): attached-users (role,
 * identity, the companies the caller admins that this person also belongs
 * to) and the company directory (name, phone, pending state, assigned
 * projects). Columns: Name, Phone, Role, Company, Projects, actions —
 * rendered per row by `CompanyMemberRow`.
 *
 * Company and Projects are multi-selects (MemberPickerDropdown):
 *  - Ticking a company attaches the user there (attachUserToCompanyAction).
 *    Unticking is destructive — it drops that company's project
 *    assignments, deactivates the directory profile and rotates the join
 *    code — so it goes through `CompanyMemberBootConfirmDialog` before
 *    calling the existing bootAttachedUserAction.
 *  - Ticking/unticking a project assigns/unassigns the user as "member"
 *    only (D3): this table never changes a project role, and never demotes
 *    or promotes anyone — the Role column is the only path to manager.
 *
 * Pending rows (no user account yet) get disabled Role/Company/Projects —
 * project and company assignment both key on user_id, so neither is
 * possible until the person signs up.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Phone, Users as UsersIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  fetchAttachedUsersAction,
  setMemberRoleAction,
  bootAttachedUserAction,
  fetchMyCompaniesAction,
} from "@/app/[locale]/(app)/settings/_actions/companies-actions";
import {
  fetchCompanyDirectoryAction,
  assignProjectMemberAction,
  unassignProjectMemberAction,
  attachUserToCompanyAction,
} from "@/app/[locale]/(app)/settings/_actions/company-settings-actions";
import { AddMemberByPhoneDialog } from "@/components/companies/add-member-by-phone-dialog";
import { ImportMembersDialog } from "@/components/companies/import-members-dialog";
import { MemberGrantsEditor } from "@/components/companies/member-grants-editor";
import { CompanyMemberRow } from "@/components/companies/company-member-row";
import {
  CompanyMemberBootConfirmDialog,
  type CompanyMemberBootTarget,
} from "@/components/companies/company-member-boot-confirm-dialog";
import type { MemberPickerOption } from "@/components/companies/member-picker-dropdown";
import { useProject } from "@/context/ProjectContext";
import { mergeMemberRows, type MemberRow } from "@/lib/companies/merge-member-rows";
import type { AttachedUser, CompanyRole, MyCompany } from "@/types/companies";

interface Props {
  companyId: string;
  adminOfMultiple: boolean;
  sourceCompanies: MyCompany[];
  onMutated: () => void;
}

export function CompanyMembersTable({ companyId, adminOfMultiple, sourceCompanies, onMutated }: Props) {
  const t = useTranslations("companySettings.members");
  const { projects: allProjects } = useProject();

  const [rows, setRows] = useState<MemberRow[]>([]);
  const [adminCompanies, setAdminCompanies] = useState<MyCompany[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingRoleUserId, setPendingRoleUserId] = useState<string | null>(null);
  const [pendingCompanyUserId, setPendingCompanyUserId] = useState<string | null>(null);
  const [pendingProjectUserId, setPendingProjectUserId] = useState<string | null>(null);
  const [addByPhoneOpen, setAddByPhoneOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [grantsTarget, setGrantsTarget] = useState<AttachedUser | null>(null);
  const [bootTarget, setBootTarget] = useState<CompanyMemberBootTarget | null>(null);
  const [isBooting, setIsBooting] = useState(false);
  const bootingRef = useRef(false);

  const fetchingRef = useRef(false);

  const load = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setIsLoading(true);
    try {
      const [usersResult, directoryResult, companiesResult] = await Promise.all([
        fetchAttachedUsersAction(companyId),
        fetchCompanyDirectoryAction(companyId),
        fetchMyCompaniesAction(),
      ]);

      if (!usersResult.ok) {
        // Surface the failure — an empty table otherwise reads as "no
        // members", not "couldn't load members".
        toast.error(usersResult.error.message);
        setRows([]);
      } else {
        if (!directoryResult.ok) {
          // Directory couldn't load — still show attached members using
          // their own fields (same defensive branch mergeMemberRows takes
          // for a legacy account with no directory profile); phone / project
          // data just won't be available until the retry succeeds.
          toast.error(directoryResult.error.message);
        }
        setRows(mergeMemberRows(usersResult.data, directoryResult.ok ? directoryResult.data : []));
      }

      if (companiesResult.ok) {
        setAdminCompanies(companiesResult.data.filter((c) => c.role === "admin"));
      } else {
        toast.error(companiesResult.error.message);
      }
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  // This company's projects — Projects column options. D3: every attached
  // member is assignable, always as "member"; Role is the only path to manager.
  const projectOptions: MemberPickerOption[] = useMemo(
    () =>
      allProjects
        .filter((p) => p.company_id === companyId)
        .map((p) => ({ id: p.id, label: p.name })),
    [allProjects, companyId]
  );
  // D4: only companies the caller administers — never a cross-tenant leak.
  const companyOptions: MemberPickerOption[] = useMemo(
    () => adminCompanies.map((c) => ({ id: c.id, label: c.legal_name })),
    [adminCompanies]
  );

  async function handleRoleChange(userId: string, role: CompanyRole) {
    setPendingRoleUserId(userId);
    try {
      const result = await setMemberRoleAction(companyId, userId, role);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success(t("roleUpdatedToast"));
      // onMutated() bumps the parent's refreshToken, which remounts this
      // table (new key) and its own effect refetches — an explicit load()
      // here too would be a redundant second fetch of the same data.
      onMutated();
    } finally {
      setPendingRoleUserId(null);
    }
  }

  async function handleCompanyToggle(row: MemberRow, option: MemberPickerOption, checked: boolean) {
    if (!row.userId) return;
    if (!checked) {
      // Destructive (drops project assignments, deactivates the directory
      // profile, rotates the join code) — confirm before booting.
      setBootTarget({ userId: row.userId, memberName: row.name, companyId: option.id, companyName: option.label });
      return;
    }
    setPendingCompanyUserId(row.userId);
    try {
      const result = await attachUserToCompanyAction(option.id, row.userId);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      onMutated();
    } finally {
      setPendingCompanyUserId(null);
    }
  }

  async function handleConfirmBoot() {
    if (!bootTarget || bootingRef.current) return;
    bootingRef.current = true;
    setIsBooting(true);
    try {
      const result = await bootAttachedUserAction(bootTarget.companyId, bootTarget.userId);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setBootTarget(null);
      onMutated();
    } finally {
      setIsBooting(false);
      bootingRef.current = false;
    }
  }

  async function handleProjectToggle(row: MemberRow, option: MemberPickerOption, checked: boolean) {
    if (!row.userId) return;
    setPendingProjectUserId(row.userId);
    try {
      const result = checked
        ? await assignProjectMemberAction(option.id, row.userId, "member")
        : await unassignProjectMemberAction(option.id, row.userId);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      onMutated();
    } finally {
      setPendingProjectUserId(null);
    }
  }

  return (
    <section className="folio-card p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-[20px] font-medium tracking-tight">{t("title")}</h3>
          <p className="mt-0.5 text-[13px]" style={{ color: "var(--muted)" }}>
            {t("description")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {adminOfMultiple && (
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <UsersIcon size={13} className="mr-1.5" />
              {t("importFromCompany")}
            </Button>
          )}
          <Button size="sm" onClick={() => setAddByPhoneOpen(true)}>
            <Phone size={13} className="mr-1.5" />
            {t("addByPhone")}
          </Button>
        </div>
      </div>

      <div className="ink-divider my-5" />

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 size={20} className="animate-spin" style={{ color: "var(--muted)" }} />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-[13px]" style={{ color: "var(--muted)" }}>
          {t("empty")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("col.name")}</TableHead>
                <TableHead>{t("col.phone")}</TableHead>
                <TableHead>{t("col.role")}</TableHead>
                <TableHead>{t("col.company")}</TableHead>
                <TableHead>{t("col.projects")}</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <CompanyMemberRow
                  key={row.key}
                  row={row}
                  companyOptions={companyOptions}
                  projectOptions={projectOptions}
                  isRoleMutating={pendingRoleUserId === row.userId}
                  isCompanyMutating={pendingCompanyUserId === row.userId}
                  isProjectMutating={pendingProjectUserId === row.userId}
                  onRoleChange={handleRoleChange}
                  onCompanyToggle={handleCompanyToggle}
                  onProjectToggle={handleProjectToggle}
                  onOpenGrants={setGrantsTarget}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AddMemberByPhoneDialog
        open={addByPhoneOpen}
        onOpenChange={setAddByPhoneOpen}
        companyId={companyId}
        // onMutated() alone — it bumps the parent's refreshToken, which
        // remounts this table and its own effect refetches (single fetch,
        // not this component's load() plus the remount's).
        onAdded={onMutated}
      />

      {adminOfMultiple && (
        <ImportMembersDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          companyId={companyId}
          sourceCompanies={sourceCompanies}
          // onMutated() alone — see the AddMemberByPhoneDialog comment above.
          onImported={onMutated}
        />
      )}

      {grantsTarget && (
        <MemberGrantsEditor
          open={grantsTarget !== null}
          onOpenChange={(open) => !open && setGrantsTarget(null)}
          companyId={companyId}
          target={grantsTarget}
        />
      )}

      <CompanyMemberBootConfirmDialog
        target={bootTarget}
        isBooting={isBooting}
        onOpenChange={(open) => !open && setBootTarget(null)}
        onConfirm={handleConfirmBoot}
      />
    </section>
  );
}
