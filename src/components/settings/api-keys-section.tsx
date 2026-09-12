"use client";

/**
 * Settings → API Keys: personal automation tokens for the current user.
 *
 * A key's plaintext token is only ever visible once, in the panel shown right
 * after creation (see ./api-key-created-token-panel.tsx) — the backend stores
 * just a hash from then on, so it cannot be recovered later even by us. The
 * list below (./api-key-row.tsx) only ever shows the short `prefix` the
 * backend returns alongside each key, never the secret itself.
 *
 * Load state mirrors NotificationPreferencesSection: a `loadingRef` guard
 * (not a cancel flag) survives the dev-mode mount → cleanup → mount cycle
 * without double-fetching or discarding the only result.
 */

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { KeyRound, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  fetchApiKeysAction,
  createApiKeyAction,
  deleteApiKeyAction,
  type ApiKeyError,
} from "@/app/[locale]/(app)/settings/_actions/api-keys-actions";
import { ApiKeyRow } from "./api-key-row";
import { CreatedTokenPanel } from "./api-key-created-token-panel";
import type { ApiKey, CreatedApiKey } from "@/lib/api/api-keys";

type LoadState = "loading" | "ready" | "error";

export function ApiKeysSection() {
  const t = useTranslations("settings.apiKeys");

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState<ApiKeyError>("unknown");
  // One fetch per mounted section — see file docblock.
  const loadingRef = useRef(false);

  const [name, setName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const creatingRef = useRef(false);

  // The one-time token panel: set only by a successful create, and only ever
  // cleared locally (dismiss, revoking the same key, or unmount) — never
  // persisted, never logged.
  const [createdToken, setCreatedToken] = useState<CreatedApiKey | null>(null);

  const [revokingKey, setRevokingKey] = useState<ApiKey | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);
  const revokingRef = useRef(false);

  useEffect(() => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    void (async () => {
      const result = await fetchApiKeysAction();
      if (!result.ok) {
        setLoadError(result.error);
        setState("error");
        return;
      }
      setApiKeys(result.data);
      setState("ready");
    })();
  }, []);

  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || creatingRef.current) return;
    creatingRef.current = true;
    setIsCreating(true);
    try {
      const result = await createApiKeyAction(trimmed);
      if (!result.ok) {
        toast.error(t(`errors.${result.error}`));
        return;
      }
      const { token: _token, ...masked } = result.data;
      setApiKeys((prev) => [masked, ...prev]);
      setCreatedToken(result.data);
      setName("");
      toast.success(t("toasts.created"));
    } finally {
      setIsCreating(false);
      creatingRef.current = false;
    }
  }

  function handleNameKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") setName("");
  }

  async function handleRevokeConfirm() {
    if (!revokingKey || revokingRef.current) return;
    revokingRef.current = true;
    setIsRevoking(true);
    try {
      const result = await deleteApiKeyAction(revokingKey.id);
      if (!result.ok) {
        toast.error(t(`errors.${result.error}`));
        return;
      }
      setApiKeys((prev) => prev.filter((k) => k.id !== revokingKey.id));
      setCreatedToken((prev) => (prev?.id === revokingKey.id ? null : prev));
      setRevokingKey(null);
      toast.success(t("toasts.revoked"));
    } finally {
      setIsRevoking(false);
      revokingRef.current = false;
    }
  }

  return (
    <div data-testid="api-keys-section">
      <div className="flex items-center gap-3">
        <KeyRound size={18} style={{ color: "var(--accent)" }} />
        <div>
          <h3 className="font-display text-[22px] font-medium tracking-tight">{t("title")}</h3>
          <p className="mt-0.5 text-[13px]" style={{ color: "var(--muted)" }}>
            {t("intro")}
          </p>
        </div>
      </div>

      <div className="ink-divider my-5" />

      {state === "loading" && (
        <div data-testid="api-keys-loading" className="flex items-center py-4">
          <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--muted)" }} aria-hidden />
        </div>
      )}

      {state === "error" && (
        <p
          role="alert"
          data-testid="api-keys-error"
          className="text-[13px]"
          style={{ color: "var(--negative, #b42318)" }}
        >
          {t(`errors.${loadError}`)}
        </p>
      )}

      {state === "ready" && (
        <>
          <form onSubmit={(e) => void handleCreateSubmit(e)} className="flex gap-2 mb-5">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleNameKeyDown}
              placeholder={t("namePlaceholder")}
              aria-label={t("namePlaceholder")}
              disabled={isCreating}
              className="h-8 text-[13px]"
              maxLength={100}
            />
            <Button
              type="submit"
              size="sm"
              disabled={isCreating || !name.trim()}
              className="h-8 shrink-0"
            >
              {isCreating ? (
                <Loader2 size={13} className="mr-1.5 animate-spin" />
              ) : (
                <Plus size={13} className="mr-1.5" />
              )}
              {isCreating ? t("creating") : t("createCta")}
            </Button>
          </form>

          {createdToken && (
            <CreatedTokenPanel apiKey={createdToken} onDismiss={() => setCreatedToken(null)} />
          )}

          {apiKeys.length === 0 ? (
            <p className="text-[13px] py-4 text-center" style={{ color: "var(--muted)" }}>
              {t("listEmpty")}
            </p>
          ) : (
            <ul className="divide-y" style={{ borderColor: "var(--line)" }} aria-label={t("title")}>
              {apiKeys.map((key) => (
                <ApiKeyRow key={key.id} apiKey={key} onRevokeRequest={setRevokingKey} />
              ))}
            </ul>
          )}

          <div
            className="mt-6 rounded-md border px-4 py-3"
            style={{ borderColor: "var(--line)", background: "var(--paper-2)" }}
          >
            <p className="text-[13px] font-medium">{t("usageHintTitle")}</p>
            <p className="mt-1 text-[12.5px]" style={{ color: "var(--muted)" }}>
              {t("usageHintBody")}
            </p>
            <span className="mt-2 block font-mono text-[12.5px] break-all">
              Authorization: Bearer &lt;your key&gt;
            </span>
          </div>
        </>
      )}

      {/* Revoke confirm — one shared dialog, targeting whichever row requested it. */}
      <AlertDialog
        open={!!revokingKey}
        onOpenChange={(open) => {
          if (!open && !isRevoking) setRevokingKey(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("revokeConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("revokeConfirmBody", { name: revokingKey?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRevoking}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleRevokeConfirm();
              }}
              disabled={isRevoking}
              className="bg-destructive hover:bg-destructive/90 focus:ring-destructive"
            >
              {isRevoking && <Loader2 size={12} className="mr-1.5 animate-spin" />}
              {t("revokeConfirmCta")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
