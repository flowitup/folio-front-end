"use client";

/**
 * MaskDisplay — renders a sensitive field value or a masked placeholder.
 *
 * - When `isMasked` is true: shows "····" tooltip hint ("Visible to admins only").
 * - When `isMasked` is false: shows the full value (or a dash when empty).
 *
 * The value prop is already either full or pre-masked by the API (e.g. "····5678").
 * This component just adds consistent visual treatment + tooltip for the mask state.
 */

import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";

interface MaskDisplayProps {
  /** The string value to display (may already be masked by the API). */
  value: string | null | undefined;
  /** When true, appends the lock icon + tooltip. */
  isMasked: boolean;
  /** Optional className for the wrapper span. */
  className?: string;
}

export function MaskDisplay({ value, isMasked, className }: MaskDisplayProps) {
  const t = useTranslations("companies");
  const display = value ?? "—";

  if (!isMasked) {
    return (
      <span className={`num font-mono text-[13px] ${className ?? ""}`}>
        {display}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 num font-mono text-[13px] ${className ?? ""}`}
      title={t("masking.tooltip")}
    >
      <Lock
        size={11}
        style={{ color: "var(--muted)", flexShrink: 0 }}
        aria-hidden="true"
      />
      <span style={{ color: "var(--muted)" }}>{display}</span>
    </span>
  );
}
