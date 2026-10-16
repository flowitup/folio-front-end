"use client";

/**
 * CompanyMemberRow — one row of CompanyMembersTable: Name (+ Pending badge),
 * Phone, Role, Company, Projects, actions.
 *
 * A pending row (mergeMemberRows: no attached-user record) has `role: null`
 * and no `attachedUser` — Role renders as a dash instead of a select, and
 * the Company/Projects pickers are disabled (D2: project and company
 * assignment both key on user_id, so neither is possible before sign-up).
 * Its only action cancels the invitation (a mistyped phone, a change of mind).
 */

import { useTranslations } from "next-intl";
import { SlidersHorizontal, UserMinus, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MemberPickerDropdown, type MemberPickerOption } from "@/components/companies/member-picker-dropdown";
import { formatFrenchPhone } from "@/lib/auth/phone-number";
import { formatDate } from "@/lib/utils/formatters";
import type { MemberRow } from "@/lib/companies/merge-member-rows";
import type { AttachedUser, CompanyRole } from "@/types/companies";

const ROLES: CompanyRole[] = ["admin", "manager", "member"];

interface Props {
  row: MemberRow;
  companyOptions: MemberPickerOption[];
  projectOptions: MemberPickerOption[];
  isRoleMutating: boolean;
  isCompanyMutating: boolean;
  isProjectMutating: boolean;
  onRoleChange: (userId: string, role: CompanyRole) => void;
  onCompanyToggle: (row: MemberRow, option: MemberPickerOption, checked: boolean) => void;
  onProjectToggle: (row: MemberRow, option: MemberPickerOption, checked: boolean) => void;
  onOpenGrants: (target: AttachedUser) => void;
  onCancelInvitation: (row: MemberRow) => void;
  /** Remove this person from the company (confirmed first). Absent: no Remove action (own row). */
  onRemove?: (row: MemberRow) => void;
}

export function CompanyMemberRow({
  row,
  companyOptions,
  projectOptions,
  isRoleMutating,
  isCompanyMutating,
  isProjectMutating,
  onRoleChange,
  onCompanyToggle,
  onProjectToggle,
  onOpenGrants,
  onCancelInvitation,
  onRemove,
}: Props) {
  const t = useTranslations("companySettings.members");
  const userId = row.userId;
  const attachedUser = row.attachedUser;

  function roleLabel(role: CompanyRole): string {
    return role === "admin" ? t("roleAdmin") : role === "manager" ? t("roleManager") : t("roleMember");
  }

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-medium">{row.name}</span>
          {row.pending && (
            <span
              className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium"
              style={{ background: "var(--surface-2, #eee)", color: "var(--muted)" }}
            >
              {t("pendingBadge")}
            </span>
          )}
        </div>
        {row.pending && row.pendingExpiresAt && (
          <div className="mt-0.5 text-[11px]" style={{ color: "var(--muted)" }}>
            {t("pendingExpires", { date: formatDate(row.pendingExpiresAt) })}
          </div>
        )}
      </TableCell>
      <TableCell className="text-[13px]" style={{ color: "var(--muted)" }}>
        {row.phone ? formatFrenchPhone(row.phone) : "—"}
      </TableCell>
      <TableCell>
        {row.role && userId ? (
          <Select
            value={row.role}
            onValueChange={(next) => onRoleChange(userId, next as CompanyRole)}
            disabled={isRoleMutating}
          >
            <SelectTrigger className="h-8 w-[130px] text-[12px]">
              <SelectValue>{roleLabel(row.role)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((role) => (
                <SelectItem key={role} value={role} className="text-[12px]">
                  {roleLabel(role)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : row.pending && row.pendingRole ? (
          // The role they get when they sign up; it cannot change before then.
          <span className="text-[12px]" style={{ color: "var(--muted)" }} title={t("availableAfterSignup")}>
            {roleLabel(row.pendingRole)}
          </span>
        ) : (
          <span className="text-[12px]" style={{ color: "var(--muted)" }}>
            —
          </span>
        )}
      </TableCell>
      {/* A pending person has no account yet: company and project access key on it. */}
      <TableCell title={row.pending ? t("availableAfterSignup") : undefined}>
        <MemberPickerDropdown
          options={companyOptions}
          selectedIds={row.companies.map((c) => c.id)}
          disabled={row.pending}
          isMutating={isCompanyMutating}
          placeholder={t("companyPickerPlaceholder")}
          emptyText={t("companyPickerEmpty")}
          onToggle={(option, checked) => onCompanyToggle(row, option, checked)}
        />
      </TableCell>
      <TableCell title={row.pending ? t("availableAfterSignup") : undefined}>
        {row.role === "admin" ? (
          // A company admin reaches every project of the company: nothing to assign.
          <span className="text-[12px]" style={{ color: "var(--muted)" }}>
            {t("allProjects")}
          </span>
        ) : (
          <MemberPickerDropdown
            options={projectOptions}
            selectedIds={row.assignedProjectIds}
            disabled={row.pending}
            isMutating={isProjectMutating}
            placeholder={t("projectsPickerPlaceholder")}
            emptyText={t("projectsPickerEmpty")}
            onToggle={(option, checked) => onProjectToggle(row, option, checked)}
          />
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {attachedUser && row.role !== "admin" && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[12px]"
            onClick={() => onOpenGrants(attachedUser)}
            // Icon-only (named by aria-label and title): with its label the
            // column left the settings card at every width up to 1440px.
            aria-label={t("customPermissions")}
            title={t("customPermissions")}
          >
            <SlidersHorizontal size={14} aria-hidden="true" />
          </Button>
        )}
        {userId && onRemove && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[12px]"
            style={{ color: "var(--negative)" }}
            onClick={() => onRemove(row)}
            aria-label={t("bootAction")}
            title={t("bootAction")}
          >
            <UserMinus size={12} className="xl:mr-1" aria-hidden="true" />
            <span className="hidden xl:inline">{t("bootAction")}</span>
          </Button>
        )}
        {row.pending && row.personId && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[12px]"
            onClick={() => onCancelInvitation(row)}
            aria-label={t("cancelInvitation")}
            title={t("cancelInvitation")}
          >
            <UserX size={14} aria-hidden="true" />
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}
