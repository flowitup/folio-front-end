"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
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
import { revokeInviteAction } from "./actions";
import type { ProjectMember } from "@/lib/api/members";
import type { PendingInvitation } from "@/lib/api/invitations";
import type { Role } from "@/lib/api/roles";

interface MembersTableProps {
  projectId: string;
  members: ProjectMember[];
  invites: PendingInvitation[];
  roles: Role[];
  canInvite: boolean;
}

function formatDate(isoString: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(isoString));
  } catch {
    return isoString;
  }
}

function expiresInDays(expiresAt: string): number | null {
  try {
    const diff = Math.ceil(
      (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return diff > 0 ? diff : null;
  } catch {
    return null;
  }
}

function memberInitials(member: ProjectMember): string {
  const name = member.display_name ?? member.email;
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function MembersTable({
  projectId,
  members,
  invites,
  roles,
  canInvite,
}: MembersTableProps) {
  const t = useTranslations("members");
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const handleRevoke = async (invitationId: string) => {
    if (!confirm(t("revokeConfirm"))) return;
    setRevokingId(invitationId);
    try {
      await revokeInviteAction(invitationId, projectId);
      toast.success(t("toast.revoked"));
      router.refresh();
    } catch {
      toast.error(t("toast.error"));
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div className="fade-up space-y-8 px-8 pb-12">
      {/* Page header */}
      <div className="flex items-center justify-between pt-2">
        <h1 className="font-display text-[22px] font-semibold">{t("title")}</h1>
        {canInvite && (
          <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-1.5">
            <UserPlus aria-hidden="true" size={14} />
            {t("invite.button")}
          </Button>
        )}
      </div>

      {/* Members table */}
      <section>
        <div className="label-cap mb-3">{t("tab.current")}</div>
        <div className="folio-card overflow-hidden">
          {members.length === 0 ? (
            <div
              className="flex items-center justify-center py-10 text-[13px]"
              style={{ color: "var(--muted)" }}
            >
              {t("empty.members")}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead style={{ width: 40 }} />
                  <TableHead>{t("col.name")}</TableHead>
                  <TableHead>{t("col.email")}</TableHead>
                  <TableHead>{t("col.role")}</TableHead>
                  <TableHead>{t("col.joined")}</TableHead>
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
                      {member.display_name ?? member.email.split("@")[0]}
                    </TableCell>
                    <TableCell style={{ color: "var(--muted)" }}>
                      {member.email}
                    </TableCell>
                    <TableCell>
                      <span className="stamp">{member.role_name}</span>
                    </TableCell>
                    <TableCell className="num" style={{ color: "var(--muted)" }}>
                      {formatDate(member.joined_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>

      {/* Pending invitations table */}
      <section>
        <div className="label-cap mb-3">{t("tab.pending")}</div>
        <div className="folio-card overflow-hidden">
          {invites.length === 0 ? (
            <div
              className="flex items-center justify-center py-10 text-[13px]"
              style={{ color: "var(--muted)" }}
            >
              {t("empty.pending")}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("col.email")}</TableHead>
                  <TableHead>{t("col.role")}</TableHead>
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
                    <TableCell>
                      <span className="stamp">{invite.role_name}</span>
                    </TableCell>
                    <TableCell className="num" style={{ color: "var(--muted)" }}>
                      {(() => {
                        const days = expiresInDays(invite.expires_at);
                        return days === null ? "—" : t("expiresIn", { days });
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
          )}
        </div>
      </section>

      {canInvite && (
        <InviteMemberDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          projectId={projectId}
          roles={roles}
        />
      )}
    </div>
  );
}
