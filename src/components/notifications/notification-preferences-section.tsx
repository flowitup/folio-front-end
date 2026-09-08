"use client";

/**
 * Settings → Notifications: per-user push opt-outs.
 *
 * One master switch plus one switch per event family, bound to
 * GET/PUT /notifications/preferences. Toggles are optimistic — the switch moves at
 * once and snaps back with a toast if the save fails — because a settings page that
 * waits on the network for every flick feels broken.
 *
 * Push only reaches the mobile app; the intro line says so, since this page is web.
 */

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Bell, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  fetchNotificationPreferencesAction,
  updateNotificationPreferencesAction,
} from "@/app/[locale]/(app)/settings/_actions/notification-preferences-actions";
import {
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
  type NotificationPreferences,
} from "@/types/notification-preferences";

type LoadState = "loading" | "ready" | "error";
type PreferenceKey = "push_enabled" | NotificationCategory;

export function NotificationPreferencesSection() {
  const t = useTranslations("settings.notificationPrefs");
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [saving, setSaving] = useState<PreferenceKey | null>(null);
  // One fetch per mounted section. A ref (not a cancel flag) so the strict-mode
  // mount → cleanup → mount cycle in development neither double-fetches nor throws
  // away the only result; a state update after unmount is harmless in React 19.
  const loadingRef = useRef(false);

  useEffect(() => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    void (async () => {
      const result = await fetchNotificationPreferencesAction();
      if (!result.ok) {
        setState("error");
        return;
      }
      setPrefs(result.data);
      setState("ready");
    })();
  }, []);

  const toggle = async (key: PreferenceKey, value: boolean) => {
    if (!prefs) return;
    const previous = prefs;
    setPrefs({ ...prefs, [key]: value });
    setSaving(key);
    const result = await updateNotificationPreferencesAction({ [key]: value });
    setSaving(null);
    if (result.ok) {
      setPrefs(result.data);
    } else {
      setPrefs(previous);
      toast.error(t("saveError"));
    }
  };

  return (
    <div data-testid="notification-preferences">
      <div className="flex items-center gap-3">
        <Bell size={18} style={{ color: "var(--accent)" }} />
        <div>
          <h3 className="font-display text-[22px] font-medium tracking-tight">{t("title")}</h3>
          <p className="mt-0.5 text-[13px]" style={{ color: "var(--muted)" }}>
            {t("intro")}
          </p>
        </div>
      </div>

      <div className="ink-divider my-5" />

      {state === "loading" && (
        <div className="flex items-center gap-2 text-[13px]" style={{ color: "var(--muted)" }}>
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("loading")}
        </div>
      )}

      {state === "error" && (
        <p role="alert" className="text-[13px]" style={{ color: "var(--negative, #b42318)" }}>
          {t("loadError")}
        </p>
      )}

      {state === "ready" && prefs && (
        <ul className="divide-y" style={{ borderColor: "var(--line)" }}>
          <PreferenceRow
            id="push_enabled"
            label={t("pushEnabled")}
            description={t("pushEnabledDesc")}
            checked={prefs.push_enabled}
            disabled={saving !== null}
            onChange={(value) => void toggle("push_enabled", value)}
          />
          {NOTIFICATION_CATEGORIES.map((category) => (
            <PreferenceRow
              key={category}
              id={category}
              label={t(`categories.${category}`)}
              description={t(`categories.${category}Desc`)}
              checked={prefs[category]}
              // A muted master switch makes every category moot; greying them says so.
              disabled={saving !== null || !prefs.push_enabled}
              onChange={(value) => void toggle(category, value)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function PreferenceRow({
  id,
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  id: PreferenceKey;
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  const inputId = `notification-pref-${id}`;
  return (
    <li className="flex items-center justify-between gap-4 py-3.5">
      <label htmlFor={inputId} className="min-w-0 cursor-pointer select-none">
        <span className="block text-[14px] font-medium">{label}</span>
        <span className="mt-0.5 block text-[12.5px]" style={{ color: "var(--muted)" }}>
          {description}
        </span>
      </label>
      <input
        id={inputId}
        type="checkbox"
        role="switch"
        aria-label={label}
        aria-checked={checked}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 flex-shrink-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
        style={{ accentColor: "var(--accent)" }}
      />
    </li>
  );
}
