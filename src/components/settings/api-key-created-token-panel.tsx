"use client";

/**
 * CreatedTokenPanel — the one-time display of a freshly created API key's
 * plaintext token.
 *
 * This is the only moment the secret is ever visible: the backend stores a
 * hash from creation onward, so once this panel is dismissed (or the section
 * unmounts) the value is gone from the client for good. Never persisted
 * (no storage write) and never logged.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CreatedApiKey } from "@/lib/api/api-keys";

interface CreatedTokenPanelProps {
  apiKey: CreatedApiKey;
  onDismiss: () => void;
}

export function CreatedTokenPanel({ apiKey, onDismiss }: CreatedTokenPanelProps) {
  const t = useTranslations("settings.apiKeys");
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(apiKey.token);
      setCopied(true);
      toast.success(t("copied"));
      setTimeout(() => setCopied(false), 2_000);
    } catch {
      toast.error(t("copyFailed"));
    }
  }

  return (
    <div
      className="mb-5 rounded-md border-2 px-4 py-3.5 space-y-2.5"
      style={{ borderColor: "var(--accent)", background: "var(--paper)" }}
      data-testid="api-key-created-panel"
      // The secret appears once and never again, so a screen-reader user must
      // be told it is here rather than having to hunt for it.
      role="status"
      aria-live="polite"
    >
      <p className="text-[14px] font-medium">{t("createdTitle")}</p>
      <p className="font-mono break-all text-[13px]" data-testid="api-key-token">
        {apiKey.token}
      </p>
      <p className="text-[12.5px]" style={{ color: "var(--negative, #b42318)" }}>
        {t("createdWarning")}
      </p>
      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={() => void handleCopy()}>
          {copied ? <Check size={13} className="mr-1.5" /> : <Copy size={13} className="mr-1.5" />}
          {copied ? t("copied") : t("copy")}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
          {t("dismiss")}
        </Button>
      </div>
    </div>
  );
}
