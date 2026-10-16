"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useOptionalAuth } from "@/context/AuthContext";
import { projectIdFromPath, useProject } from "@/context/ProjectContext";
import { onSessionEvent } from "@/lib/auth/session-events";
import {
  AUTO_REFRESH_MIN_GAP_MS,
  DENIED_REFRESH_MIN_GAP_MS,
  accessSignature,
  createRefreshThrottle,
  sessionEndedLoginPath,
} from "@/lib/auth/session-freshness";

/** How long after an automatic re-read a permission change is attributed to it (and toasted). */
const AUTO_CHANGE_WINDOW_MS = 2_000;

/**
 * Keeps the open session in step with changes made elsewhere: another admin changing this
 * user's role or grants, assigning them to a project or removing them from one, a project
 * created on another device. The user (`/auth/me`) and the project list were read once per page
 * load, so until a full reload the navigation, the project switcher and every picker built from
 * the list stayed as they were.
 *
 * - Re-reads both on window focus, when the tab is shown again and on client navigation, at
 *   most every 30 s (no polling: nothing runs while the user stays put).
 * - Re-reads them after any 403 from the API (permissions known to be stale).
 * - When the access itself changed, refreshes the server-rendered layout (billing entry, gates)
 *   and says so; when the project on screen was taken away, says so and leaves it.
 * - When the API refuses the session outright (deactivated account), sends the user to sign in
 *   with an explanation instead of leaving every page failing to load.
 *
 * Mounted once, inside the ProjectProvider of the app layout.
 */
export function SessionFreshness() {
  const auth = useOptionalAuth();
  const { refetch, accessLostProjectId, clearAccessLost } = useProject();
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations("common");

  const throttle = useRef<ReturnType<typeof createRefreshThrottle> | null>(null);
  const autoChangeUntil = useRef(0);
  // Latest callbacks, read by the listeners without re-subscribing them on every render.
  const refreshUserRef = useRef(auth?.refreshUser);
  const refetchRef = useRef(refetch);
  useEffect(() => {
    refreshUserRef.current = auth?.refreshUser;
    refetchRef.current = refetch;
  });

  const runRef = useRef(async (minGapMs: number) => {
    throttle.current ??= createRefreshThrottle();
    if (!throttle.current.tryStart(minGapMs)) return;
    // A change landing while this runs (or just after) came from someone else.
    autoChangeUntil.current = Number.POSITIVE_INFINITY;
    try {
      await Promise.all([
        refetchRef.current({ silent: true }),
        refreshUserRef.current?.(),
      ]);
    } finally {
      autoChangeUntil.current = Date.now() + AUTO_CHANGE_WINDOW_MS;
      throttle.current.finish();
    }
  });

  // Window focus, tab shown again, a 403 from the API.
  useEffect(() => {
    throttle.current ??= createRefreshThrottle();
    const run = (gap: number) => void runRef.current(gap);
    const onFocus = () => run(AUTO_REFRESH_MIN_GAP_MS);
    const onVisibility = () => {
      if (!document.hidden) run(AUTO_REFRESH_MIN_GAP_MS);
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    const offDenied = onSessionEvent("access-denied", () => run(DENIED_REFRESH_MIN_GAP_MS));
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      offDenied();
    };
  }, []);

  // Client navigation (the layout, and so this component, stays mounted across pages).
  const previousPath = useRef(pathname);
  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    void runRef.current(AUTO_REFRESH_MIN_GAP_MS);
  }, [pathname]);

  // The session was refused outright: sign in again, back to this page afterwards.
  const pathRef = useRef(pathname);
  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);
  useEffect(() => {
    let leaving = false;
    return onSessionEvent("session-ended", () => {
      if (leaving) return;
      leaving = true;
      window.location.assign(sessionEndedLoginPath(pathRef.current, locale));
    });
  }, [locale]);

  // Access changed (role, grants, primary company, hidden sections): the sidebar's billing
  // entry and the page gates are rendered on the server, so re-render them.
  const signature = accessSignature(auth?.user);
  const previousSignature = useRef(signature);
  useEffect(() => {
    if (previousSignature.current === signature) return;
    const hadUser = previousSignature.current !== "";
    previousSignature.current = signature;
    if (!hadUser || !signature) return;
    router.refresh();
    // The user's own action (switching the primary company…) needs no explanation.
    if (Date.now() < autoChangeUntil.current) toast.info(t("accessChanged"));
  }, [signature, router, t]);

  // The project on screen was taken away from the user while they were on it.
  useEffect(() => {
    if (!accessLostProjectId) return;
    clearAccessLost();
    if (projectIdFromPath(pathname) !== accessLostProjectId) return;
    toast.warning(t("projectAccessLost"));
    router.replace(`/${locale}/projects`);
  }, [accessLostProjectId, clearAccessLost, pathname, router, locale, t]);

  return null;
}
