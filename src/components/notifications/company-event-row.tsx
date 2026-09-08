"use client";

/**
 * CompanyEventRow — "X joined your company" notification (admins only).
 * Links to Settings › Company where the admin can assign the new member to
 * a project (assignment itself is per-project, so this is a hand-off point,
 * not a direct assign action).
 */

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import type { CompanyEvent } from "@/lib/api/notifications";

interface CompanyEventRowProps {
  item: CompanyEvent;
  onNavigate: () => void;
}

export function CompanyEventRow({ item, onNavigate }: CompanyEventRowProps) {
  const t = useTranslations("notifications");
  const router = useRouter();
  const locale = useLocale();

  function handleClick() {
    router.push(`/${locale}/settings#company`);
    onNavigate();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left hover:bg-accent/40 transition-colors focus:outline-none focus-visible:underline"
      aria-label={t("companyEvents.aria", { name: item.display_name })}
    >
      <p className="min-w-0 flex-1 truncate text-sm" style={{ color: "var(--foreground)" }}>
        {t("companyEvents.joined", { name: item.display_name })}
      </p>
    </button>
  );
}
