"use client";

/**
 * ApiKeyRow — single row in the Settings → API Keys list.
 *
 * Shows the key's name, masked prefix, created date and last-used date (or
 * "never used"). The revoke confirmation dialog is owned by the parent
 * section; this component only requests it via onRevokeRequest.
 */

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { ApiKey } from "@/lib/api/api-keys";

function formatKeyDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

interface ApiKeyRowProps {
  apiKey: ApiKey;
  onRevokeRequest: (key: ApiKey) => void;
}

export function ApiKeyRow({ apiKey, onRevokeRequest }: ApiKeyRowProps) {
  const t = useTranslations("settings.apiKeys");

  return (
    <li className="flex items-center gap-3 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-medium truncate">{apiKey.name}</p>
        <div
          className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px]"
          style={{ color: "var(--muted)" }}
        >
          <span className="font-mono">{apiKey.prefix}…</span>
          <span aria-hidden>·</span>
          <span>{t("created", { date: formatKeyDate(apiKey.createdAt) })}</span>
          <span aria-hidden>·</span>
          <span>
            {apiKey.lastUsedAt
              ? t("lastUsed", { date: formatKeyDate(apiKey.lastUsedAt) })
              : t("neverUsed")}
          </span>
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
        onClick={() => onRevokeRequest(apiKey)}
      >
        {t("revoke")}
      </Button>
    </li>
  );
}
