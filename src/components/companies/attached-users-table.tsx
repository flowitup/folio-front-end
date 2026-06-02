"use client";

/**
 * AttachedUsersTable — admin view of users attached to a company.
 *
 * Columns: name/email, primary badge, attached_at, Boot action.
 * "Boot" action requires AlertDialog confirm. Submit guard via useRef.
 */

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Star, Loader2, UserMinus, ShieldCheck, ShieldOff } from "lucide-react";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  bootAttachedUserAction,
  setMemberRoleAction,
} from "@/app/[locale]/(app)/settings/_actions/companies-actions";
import type { AttachedUser } from "@/types/companies";

interface AttachedUsersTableProps {
  companyId: string;
  users: AttachedUser[];
  onMutated: () => void;
}

interface BootTarget {
  userId: string;
  displayName: string;
}

export function AttachedUsersTable({
  companyId,
  users,
  onMutated,
}: AttachedUsersTableProps) {
  const t = useTranslations("companies");

  const [bootTarget, setBootTarget] = useState<BootTarget | null>(null);
  const [isBooting, setIsBooting] = useState(false);
  const bootingRef = useRef(false);

  const [pendingRoleUserId, setPendingRoleUserId] = useState<string | null>(null);
  const roleChangingRef = useRef(false);

  async function handleRoleChange(userId: string, nextRole: "admin" | "member") {
    if (roleChangingRef.current) return;
    roleChangingRef.current = true;
    setPendingRoleUserId(userId);
    try {
      const result = await setMemberRoleAction(companyId, userId, nextRole);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success(t("admin.manage.attached.roleUpdatedToast"));
      onMutated();
    } catch {
      toast.error(t("form.errors.generic"));
    } finally {
      setPendingRoleUserId(null);
      roleChangingRef.current = false;
    }
  }

  async function handleBoot() {
    if (!bootTarget || bootingRef.current) return;
    bootingRef.current = true;
    setIsBooting(true);
    try {
      const result = await bootAttachedUserAction(companyId, bootTarget.userId);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setBootTarget(null);
      onMutated();
    } catch {
      toast.error(t("form.errors.generic"));
    } finally {
      setIsBooting(false);
      bootingRef.current = false;
    }
  }

  if (users.length === 0) {
    return (
      <p className="py-6 text-center text-[13px]" style={{ color: "var(--muted)" }}>
        {t("admin.manage.attached.empty")}
      </p>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("admin.manage.attached.nameEmail")}</TableHead>
            <TableHead>{t("admin.manage.attached.roleColumn")}</TableHead>
            <TableHead>{t("admin.manage.attached.attachedAt")}</TableHead>
            <TableHead className="w-[80px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.user_id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-medium">
                        {u.display_name ?? u.email}
                      </span>
                      {u.is_primary && (
                        <span
                          className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                          style={{ background: "var(--accent)", color: "white" }}
                        >
                          <Star size={8} aria-hidden="true" />
                          {t("admin.manage.attached.primaryBadge")}
                        </span>
                      )}
                    </div>
                    {u.display_name && (
                      <div
                        className="text-[12px]"
                        style={{ color: "var(--muted)" }}
                      >
                        {u.email}
                      </div>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                    style={
                      u.role === "admin"
                        ? { background: "var(--accent)", color: "white" }
                        : { background: "var(--surface-2, #eee)", color: "var(--muted)" }
                    }
                  >
                    {u.role === "admin"
                      ? t("admin.manage.attached.roleAdmin")
                      : t("admin.manage.attached.roleMember")}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7"
                    disabled={pendingRoleUserId === u.user_id}
                    onClick={() =>
                      handleRoleChange(
                        u.user_id,
                        u.role === "admin" ? "member" : "admin"
                      )
                    }
                    title={
                      u.role === "admin"
                        ? t("admin.manage.attached.makeMember")
                        : t("admin.manage.attached.makeAdmin")
                    }
                  >
                    {pendingRoleUserId === u.user_id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : u.role === "admin" ? (
                      <ShieldOff size={13} />
                    ) : (
                      <ShieldCheck size={13} />
                    )}
                    <span className="sr-only">
                      {u.role === "admin"
                        ? t("admin.manage.attached.makeMember")
                        : t("admin.manage.attached.makeAdmin")}
                    </span>
                  </Button>
                </div>
              </TableCell>
              <TableCell>
                <span
                  className="num text-[12px]"
                  style={{ color: "var(--muted)" }}
                >
                  {new Date(u.attached_at).toLocaleDateString()}
                </span>
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() =>
                    setBootTarget({
                      userId: u.user_id,
                      displayName: u.display_name ?? u.email,
                    })
                  }
                  title={t("admin.manage.attached.boot")}
                >
                  <UserMinus size={13} />
                  <span className="sr-only">{t("admin.manage.attached.boot")}</span>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Boot confirm dialog */}
      <AlertDialog
        open={bootTarget !== null}
        onOpenChange={(open) => {
          if (!open && !isBooting) setBootTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("admin.manage.attached.boot")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.manage.attached.bootConfirm", {
                name: bootTarget?.displayName ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBooting}>
              {t("form.actions.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBoot}
              disabled={isBooting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isBooting && (
                <Loader2 size={12} className="mr-1.5 animate-spin" />
              )}
              {t("admin.manage.attached.boot")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
