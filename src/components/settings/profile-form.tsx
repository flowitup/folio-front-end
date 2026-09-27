"use client";

/**
 * ProfileForm — Settings › Profile: display name, saved via PATCH /auth/me.
 * The phone is how the user signs in, so it is read-only here and changes only
 * through the verified "Change number" dialog (code texted to the new number).
 * Email is read-only too: only an administrator can change it (it stays the
 * account's stable identifier while phone-only sign-in rolls out).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { updateProfileAction } from "@/app/[locale]/(app)/settings/_actions/profile-actions";
import { formatFrenchPhone } from "@/lib/auth/phone-number";
import type { User } from "@/lib/auth/types";
import { ChangePhoneDialog } from "./change-phone-dialog";

export function ProfileForm() {
  const t = useTranslations("settings");
  const router = useRouter();
  const { user } = useAuth();

  const [displayName, setDisplayName] = useState(user?.display_name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [changePhoneOpen, setChangePhoneOpen] = useState(false);

  const initials = (user?.display_name ?? user?.email)?.charAt(0).toUpperCase() ?? "·";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    try {
      const trimmedName = displayName.trim();
      const result = await updateProfileAction({
        display_name: trimmedName.length > 0 ? trimmedName : null,
      });

      if (!result.success) {
        toast.error(t("errorSaveFailed"));
        return;
      }

      // Keep the form in sync with what the backend actually saved.
      setDisplayName(result.user.display_name ?? "");
      setPhone(result.user.phone ?? "");
      toast.success(t("profileSaved"));
      // Server components (topbar, other settings sections) read the user
      // from the session cookie — refresh so they pick up the new values.
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  function handlePhoneChanged(updated: User) {
    setPhone(updated.phone ?? "");
    toast.success(t("changePhone.success"));
    router.refresh();
  }

  return (
    <section className="folio-card p-7">
      <div className="mb-5 flex items-center gap-4">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full font-display text-[24px] font-medium text-white"
          style={{ background: "var(--accent)" }}
        >
          {initials}
        </div>
        <div>
          <h2 className="font-display text-[22px] font-medium tracking-tight">
            {user?.display_name ?? user?.email}
          </h2>
        </div>
      </div>

      <div className="ink-divider my-5" />

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div>
          <label htmlFor="profile-display-name" className="label-cap">
            {t("displayName")}
          </label>
          <input
            id="profile-display-name"
            className="folio-input mt-1.5"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            disabled={isSaving}
          />
        </div>
        <div>
          <label htmlFor="profile-phone" className="label-cap">
            {t("phone")}
          </label>
          <div className="mt-1.5 flex gap-2">
            <input
              id="profile-phone"
              className="folio-input num min-w-0 flex-1"
              type="tel"
              value={formatFrenchPhone(phone)}
              readOnly
              aria-describedby="profile-phone-hint"
            />
            <button
              type="button"
              className="btn btn-ghost flex-shrink-0"
              data-testid="profile-change-phone"
              onClick={() => setChangePhoneOpen(true)}
            >
              {t("changePhone.action")}
            </button>
          </div>
          <p id="profile-phone-hint" className="mt-1 text-[12px]" style={{ color: "var(--muted)" }}>
            {t("changePhone.readOnlyHint")}
          </p>
        </div>
        <div className="md:col-span-2">
          <label htmlFor="profile-email" className="label-cap">
            {t("email")}
          </label>
          <input
            id="profile-email"
            className="folio-input mt-1.5"
            type="email"
            value={user?.email ?? ""}
            readOnly
          />
          <p className="mt-1 text-[12px]" style={{ color: "var(--muted)" }}>
            {t("emailReadOnlyHint")}
          </p>
        </div>
        <div className="md:col-span-2">
          <button type="submit" className="btn btn-primary" disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                {t("saving")}
              </>
            ) : (
              t("save")
            )}
          </button>
        </div>
      </form>

      <ChangePhoneDialog
        open={changePhoneOpen}
        onOpenChange={setChangePhoneOpen}
        onChanged={handlePhoneChanged}
      />
    </section>
  );
}
