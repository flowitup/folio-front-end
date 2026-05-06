"use client";

/**
 * TokenGeneratedDialog — shows the plaintext invite token ONCE.
 *
 * Design constraints:
 * - Token is visible only while this dialog instance is open.
 * - After close the parent MUST discard the token from state — it will NOT
 *   be visible if the same dialog is reopened (new generation required).
 * - Auto-closes after 60 s with a countdown display.
 * - "Copy to clipboard" button copies token + expiry line together.
 */

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Copy, Check, AlertTriangle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CompanyInviteTokenGenerated } from "@/types/companies";

const AUTO_CLOSE_SECONDS = 60;

interface TokenGeneratedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Token data returned from generateInviteToken action. */
  tokenData: CompanyInviteTokenGenerated | null;
}

export function TokenGeneratedDialog({
  open,
  onOpenChange,
  tokenData,
}: TokenGeneratedDialogProps) {
  const t = useTranslations("companies");

  const [copied, setCopied] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(AUTO_CLOSE_SECONDS);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Start / stop countdown whenever the dialog opens or closes.
  useEffect(() => {
    if (!open) {
      // Cleanup only — state reset happens in handleOpenChange below.
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    // Dialog just opened: start the countdown.
    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          onOpenChange(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1_000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [open, onOpenChange]);

  // Reset transient UI state when the dialog closes (called from Dialog's own handler).
  function handleOpenChange(next: boolean) {
    if (!next) {
      setCopied(false);
      setSecondsLeft(AUTO_CLOSE_SECONDS);
    }
    onOpenChange(next);
  }

  async function handleCopy() {
    if (!tokenData) return;
    const expiresAt = new Date(tokenData.expires_at).toLocaleString();
    const text = `${tokenData.token}\n${t("tokenGenerated.expiresLine", { expiresAt })}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(t("tokenGenerated.copiedToast"));
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 3_000);
    } catch {
      toast.error("Could not copy to clipboard.");
    }
  }

  const expiresAtFormatted = tokenData
    ? new Date(tokenData.expires_at).toLocaleString()
    : "";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("tokenGenerated.dialogTitle")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* One-shot warning banner */}
          <div
            className="flex items-start gap-3 rounded-md border p-3"
            style={{
              background: "var(--paper)",
              borderColor: "var(--warning, #f59e0b)",
            }}
          >
            <AlertTriangle
              size={15}
              className="mt-0.5 flex-shrink-0"
              style={{ color: "var(--warning, #f59e0b)" }}
            />
            <p className="text-[13px]">
              {t("tokenGenerated.oneShotWarning")}
            </p>
          </div>

          {/* Token display */}
          {tokenData && (
            <div
              className="rounded-md border p-4 font-mono text-[13px] break-all select-all"
              style={{
                background: "var(--paper)",
                borderColor: "var(--line)",
              }}
            >
              {tokenData.token}
            </div>
          )}

          {/* Expiry line */}
          {tokenData && (
            <p className="text-[12px]" style={{ color: "var(--muted)" }}>
              {t("tokenGenerated.expiresLine", { expiresAt: expiresAtFormatted })}
            </p>
          )}

          {/* Copy button + auto-close countdown */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <div
              className="flex items-center gap-1.5 text-[12px]"
              style={{ color: "var(--muted)" }}
            >
              <Clock size={12} />
              <span>
                {t("tokenGenerated.autoCloseCountdown", {
                  seconds: secondsLeft,
                })}
              </span>
            </div>
            <Button size="sm" onClick={handleCopy} disabled={!tokenData}>
              {copied ? (
                <Check size={13} className="mr-1.5" />
              ) : (
                <Copy size={13} className="mr-1.5" />
              )}
              {t("tokenGenerated.copyCta")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
