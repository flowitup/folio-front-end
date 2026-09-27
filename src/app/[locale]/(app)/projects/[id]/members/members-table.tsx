"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { UserPlus, Users } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InviteMemberDialog } from "./invite-member-dialog";
import { EditMemberDialog } from "./edit-member-dialog";
import { AssignMemberDialog } from "@/components/projects/assign-member-dialog";
import { revokeInviteAction, removeMemberAction } from "./actions";
import type { ProjectMember } from "@/lib/api/members";
import type { PendingInvitation } from "@/lib/api/invitations";
import { formatDate } from "@/lib/utils/formatters";
import { realEmail, userContact } from "@/lib/auth/user-display";

interface MembersTableProps {
  projectId: string;
  companyId: string | null;
  members: ProjectMember[];
  invites: PendingInvitation[];
  canInvite: boolean;
  canManageMembers: boolean;
  /** Gates the "Assign member" button + dialog — matches the backend's
      require_project_access(write=True) on PUT /assignments/<userId> (i.e.
      project:update), distinct from canManageMembers (project:manage_users). */
  canAssignMembers: boolean;
  /** Caller's company-admin standing — only an admin may assign the manager
      role (assignments.ts: "manager may only assign member"). */
  callerIsCompanyAdmin: boolean;
  canEditIdentity: boolean;
  currentUserId: string;
}

/** Days left on an invitation, "expired" once past, null when unreadable.
 * The API still lists an invitation nobody opened as pending after it
 * expired, so the past case must read "Expired", not a bare "—". */
function expiresInDays(expiresAt: string): number | "expired" | null {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  if (ms <= 0) return "expired";
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function memberInitials(member: ProjectMember): string {
  const name = member.display_name?.trim() || realEmail(member);
  if (!name) return "·";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Name shown for a member. Phone-only accounts have a synthetic address, so
 * without a display name their phone stands in, never that address.
 */
function memberName(member: ProjectMember): string {
  const name = member.display_name?.trim();
  if (name) return name;
  const email = realEmail(member);
  return email ? email.split("@")[0] : userContact(member);
}

export function MembersTable({
  projectId,
  companyId,
  members,
  invites,
  canInvite,
  canManageMembers,
  canAssignMembers,
  callerIsCompanyAdmin,
  canEditIdentity,
  currentUserId,
}: MembersTableProps) {
  const t = useTranslations("members");
  const router = useRouter();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<ProjectMember | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);


  const handleRevoke = async (invitationId: string) => {
    if (!confirm(t("revokeConfirm"))) return;
    setRevokingId(invitationId);
    try {
      const result = await revokeInviteAction(invitationId, projectId);
      if (!result.ok) {
        toast.error(result.status === 403 ? t("edit.toast.forbidden") : t("toast.revokeFailed"));
        return;
      }
      toast.success(t("toast.revoked"));
      router.refresh();
    } catch {
      toast.error(t("toast.revokeFailed"));
    } finally {
      setRevokingId(null);
    }
  };

  const handleRemove = async (member: ProjectMember) => {
    if (!confirm(t("edit.removeConfirm", { name: memberName(member) }))) {
      return;
    }
    setRemovingId(member.user_id);
    try {
      const result = await removeMemberAction(projectId, member.user_id);
      if (!result.ok) {
        toast.error(
          result.status === 403 ? t("edit.toast.forbidden") : t("edit.toast.removeFailed")
        );
        return;
      }
      toast.success(t("edit.toast.removed"));
      router.refresh();
    } catch {
      toast.error(t("edit.toast.removeFailed"));
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="fade-up space-y-8 px-8 pb-12">
      {/* Page header */}
      <div className="flex items-center justify-between pt-2">
        <h1 className="font-display text-[22px] font-semibold">{t("title")}</h1>
        <div className="flex gap-2">
          {canAssignMembers && companyId && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAssignDialogOpen(true)}
              className="gap-1.5"
            >
              <Users aria-hidden="true" size={14} />
              {t("assign.button")}
            </Button>
          )}
          {canInvite && (
            <Button
              size="sm"
              onClick={() => setInviteDialogOpen(true)}
              className="gap-1.5"
            >
              <UserPlus aria-hidden="true" size={14} />
              {t("invite.button")}
            </Button>
          )}
        </div>
      </div>

      {/* Members table */}
      <section>
        <div className="label-cap mb-3">{t("tab.current")}</div>
        {members.length === 0 ? (
          <div
            className="folio-card flex items-center justify-center py-10 text-[13px]"
            style={{ color: "var(--muted)" }}
          >
            {t("empty.members")}
          </div>
        ) : (
          <>
            {/* Mobile cards (< lg) */}
            <div className="flex flex-col gap-2 lg:hidden" data-testid="members-mobile">
              {members.map((member) => (
                <div key={member.user_id} className="folio-card p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                      style={{ background: "var(--paper-2)", color: "var(--ink)" }}
                    >
                      {memberInitials(member)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">
                        {memberName(member)}
                      </div>
                      <div className="truncate text-[12px]" style={{ color: "var(--muted)" }}>
                        {userContact(member)}
                      </div>
                      {member.role_name && (
                        <div className="text-[12px]" style={{ color: "var(--muted)" }}>
                          {t(`roles.${member.role_name}`)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div
                    className="mt-3 flex items-center justify-between border-t pt-2.5"
                    style={{ borderColor: "var(--line)" }}
                  >
                    <span className="num text-[12px]" style={{ color: "var(--muted)" }}>
                      {formatDate(member.joined_at)}
                    </span>
                  </div>
                  {canManageMembers && (
                    <div className="mt-2.5 flex gap-2">
                      {canEditIdentity && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 flex-1"
                          onClick={() => setEditing(member)}
                        >
                          {t("edit.button")}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 flex-1"
                        style={{ color: "var(--negative)" }}
                        disabled={
                          removingId === member.user_id ||
                          member.user_id === currentUserId
                        }
                        onClick={() => handleRemove(member)}
                      >
                        {t("edit.remove")}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop table (>= lg) */}
            <div className="folio-card overflow-hidden hidden lg:block" data-testid="members-desktop">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead style={{ width: 40 }} />
                  <TableHead>{t("col.name")}</TableHead>
                  <TableHead>{t("col.email")}</TableHead>
                  <TableHead>{t("col.role")}</TableHead>
                  <TableHead>{t("col.joined")}</TableHead>
                  {canManageMembers && (
                    <TableHead style={{ textAlign: "right" }}>
                      {t("col.actions")}
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.user_id}>
                    <TableCell>
                      <div
                        className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold"
                        style={{
                          background: "var(--paper-2)",
                          color: "var(--ink)",
                        }}
                      >
                        {memberInitials(member)}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {memberName(member)}
                    </TableCell>
                    <TableCell style={{ color: "var(--muted)" }}>
                      {userContact(member) || "—"}
                    </TableCell>
                    <TableCell style={{ color: "var(--muted)" }}>
                      {member.role_name ? t(`roles.${member.role_name}`) : "—"}
                    </TableCell>
                    <TableCell className="num" style={{ color: "var(--muted)" }}>
                      {formatDate(member.joined_at)}
                    </TableCell>
                    {canManageMembers && (
                      <TableCell style={{ textAlign: "right" }}>
                        <div className="flex justify-end gap-1">
                          {canEditIdentity && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-[12px]"
                              onClick={() => setEditing(member)}
                            >
                              {t("edit.button")}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-[12px]"
                            style={{ color: "var(--negative)" }}
                            disabled={
                              removingId === member.user_id ||
                              member.user_id === currentUserId
                            }
                            onClick={() => handleRemove(member)}
                          >
                            {t("edit.remove")}
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </>
        )}
      </section>

      {/* Pending invitations table (outsiders — no role picker, always "member").
          Only for callers who may invite: nobody else can read them. */}
      {canInvite && (
        <section>
          <div className="label-cap mb-3">{t("tab.pending")}</div>
          {invites.length === 0 ? (
            <div
              className="folio-card flex items-center justify-center py-10 text-[13px]"
              style={{ color: "var(--muted)" }}
            >
              {t("empty.pending")}
            </div>
          ) : (
            <>
              {/* Mobile cards (< lg) */}
              <div className="flex flex-col gap-2 lg:hidden" data-testid="invites-mobile">
                {invites.map((invite) => {
                  const days = expiresInDays(invite.expires_at);
                  return (
                    <div key={invite.id} className="folio-card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{invite.email}</div>
                        </div>
                        {canInvite && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9"
                            style={{ color: "var(--negative)" }}
                            disabled={revokingId === invite.id}
                            onClick={() => handleRevoke(invite.id)}
                          >
                            {t("revoke")}
                          </Button>
                        )}
                      </div>
                      <div
                        className="mt-3 flex items-center justify-between border-t pt-2.5 text-[12px]"
                        style={{ borderColor: "var(--line)", color: "var(--muted)" }}
                      >
                        <span className="num">
                          {days === null ? "—" : days === "expired" ? t("expired") : t("expiresIn", { days })}
                        </span>
                        <span>{invite.invited_by_name ?? "—"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop table (>= lg) */}
              <div className="folio-card overflow-hidden hidden lg:block" data-testid="invites-desktop">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("col.email")}</TableHead>
                    <TableHead>{t("col.expires")}</TableHead>
                    <TableHead>{t("col.invitedBy")}</TableHead>
                    {canInvite && (
                      <TableHead style={{ textAlign: "right" }}>
                        {t("col.actions")}
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invites.map((invite) => (
                    <TableRow key={invite.id}>
                      <TableCell>{invite.email}</TableCell>
                      <TableCell className="num" style={{ color: "var(--muted)" }}>
                        {(() => {
                          const days = expiresInDays(invite.expires_at);
                          if (days === null) return "—";
                        return days === "expired" ? t("expired") : t("expiresIn", { days });
                        })()}
                      </TableCell>
                      <TableCell style={{ color: "var(--muted)" }}>
                        {invite.invited_by_name ?? "—"}
                      </TableCell>
                      {canInvite && (
                        <TableCell style={{ textAlign: "right" }}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-[12px]"
                            style={{ color: "var(--negative)" }}
                            disabled={revokingId === invite.id}
                            onClick={() => handleRevoke(invite.id)}
                          >
                            {t("revoke")}
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </>
          )}
        </section>
      )}

      {canInvite && (
        <InviteMemberDialog
          open={inviteDialogOpen}
          onOpenChange={setInviteDialogOpen}
          projectId={projectId}
        />
      )}

      {canAssignMembers && companyId && (
        <AssignMemberDialog
          open={assignDialogOpen}
          onOpenChange={setAssignDialogOpen}
          projectId={projectId}
          companyId={companyId}
          excludeUserIds={members.map((m) => m.user_id)}
          canAssignManager={callerIsCompanyAdmin}
        />
      )}

      {/* The dialog edits identity only (name, email) — nothing else to offer
          a caller who may not change it. */}
      {canManageMembers && canEditIdentity && (
        <EditMemberDialog
          open={editing !== null}
          onOpenChange={(open) => !open && setEditing(null)}
          projectId={projectId}
          member={editing}
          canEditIdentity={canEditIdentity}
        />
      )}
    </div>
  );
}
