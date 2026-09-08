"use client";

/**
 * CompanyMembersTable — Settings › Company members list for a company admin.
 *
 * Role select (admin/manager/member) calls the shared setMemberRoleAction
 * (companies-actions.ts, already company-role-aware). "Quyền tuỳ chỉnh"
 * (custom permissions) opens the D8 grants editor for manager/member rows —
 * admins are never customisable (matrix.py: CUSTOMISABLE_PERMISSIONS applies
 * to manager/member only).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Phone, Users as UsersIcon, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fetchAttachedUsersAction,
  setMemberRoleAction,
} from "@/app/[locale]/(app)/settings/_actions/companies-actions";
import { AddMemberByPhoneDialog } from "@/components/companies/add-member-by-phone-dialog";
import { ImportMembersDialog } from "@/components/companies/import-members-dialog";
import { MemberGrantsEditor } from "@/components/companies/member-grants-editor";
import type { AttachedUser, CompanyRole, MyCompany } from "@/types/companies";

interface Props {
  companyId: string;
  adminOfMultiple: boolean;
  sourceCompanies: MyCompany[];
  onMutated: () => void;
}

const ROLES: CompanyRole[] = ["admin", "manager", "member"];

export function CompanyMembersTable({ companyId, adminOfMultiple, sourceCompanies, onMutated }: Props) {
  const t = useTranslations("companySettings.members");

  const [users, setUsers] = useState<AttachedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingRoleUserId, setPendingRoleUserId] = useState<string | null>(null);
  const [addByPhoneOpen, setAddByPhoneOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [grantsTarget, setGrantsTarget] = useState<AttachedUser | null>(null);

  const fetchingRef = useRef(false);

  const load = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setIsLoading(true);
    try {
      const result = await fetchAttachedUsersAction(companyId);
      if (result.ok) {
        setUsers(result.data);
      } else {
        // Surface the failure — an empty table otherwise reads as "no
        // members", not "couldn't load members".
        toast.error(result.error.message);
      }
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

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

  function roleLabel(role: CompanyRole): string {
    return role === "admin" ? t("roleAdmin") : role === "manager" ? t("roleManager") : t("roleMember");
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
      ) : users.length === 0 ? (
        <p className="py-10 text-center text-[13px]" style={{ color: "var(--muted)" }}>
          {t("empty")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("col.nameEmail")}</TableHead>
                <TableHead>{t("col.role")}</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.user_id}>
                  <TableCell>
                    <div className="text-[13px] font-medium">{u.display_name ?? u.email}</div>
                    {u.display_name && (
                      <div className="text-[12px]" style={{ color: "var(--muted)" }}>
                        {u.email}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={u.role}
                      onValueChange={(next) => handleRoleChange(u.user_id, next as CompanyRole)}
                      disabled={pendingRoleUserId === u.user_id}
                    >
                      <SelectTrigger className="h-8 w-[130px] text-[12px]">
                        <SelectValue>{roleLabel(u.role)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((role) => (
                          <SelectItem key={role} value={role} className="text-[12px]">
                            {roleLabel(role)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {u.role !== "admin" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[12px]"
                        onClick={() => setGrantsTarget(u)}
                      >
                        <SlidersHorizontal size={12} className="mr-1" />
                        {t("customPermissions")}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
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
    </section>
  );
}
