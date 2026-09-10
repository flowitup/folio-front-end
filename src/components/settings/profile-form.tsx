"use client";

/**
 * ProfileForm — Settings › Profile: display name + phone, saved via
 * PATCH /auth/me. Email is read-only here on purpose: only an administrator
 * can change it (it stays the account's stable identifier while phone-only
 * sign-in rolls out), so there is no input for it.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { updateProfileAction } from "@/app/[locale]/(app)/settings/_actions/profile-actions";

export function ProfileForm() {
  const t = useTranslations("settings");
  const router = useRouter();
  const { user } = useAuth();

  const [displayName, setDisplayName] = useState(user?.display_name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [isSaving, setIsSaving] = useState(false);

  const initials = (user?.display_name ?? user?.email)?.charAt(0).toUpperCase() ?? "·";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    try {
      const trimmedName = displayName.trim();
      const trimmedPhone = phone.trim();
      const result = await updateProfileAction({
        display_name: trimmedName.length > 0 ? trimmedName : null,
        phone: trimmedPhone.length > 0 ? trimmedPhone : null,
      });

      if (!result.success) {
        const key =
          result.error === "invalid_phone"
            ? "errorInvalidPhone"
            : result.error === "phone_taken"
              ? "errorPhoneTaken"
              : "errorSaveFailed";
        toast.error(t(key));
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
          <input
            id="profile-phone"
            className="folio-input mt-1.5"
            type="tel"
            autoComplete="tel"
            placeholder="06 12 34 56 78"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={isSaving}
          />
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
    </section>
  );
}
