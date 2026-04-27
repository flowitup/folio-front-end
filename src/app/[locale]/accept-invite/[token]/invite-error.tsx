import { getTranslations } from "next-intl/server";
import { AlertCircle, ArrowRight } from "lucide-react";
import type { InviteErrorReason } from "@/lib/api/invitations";

interface InviteErrorProps {
  reason: InviteErrorReason;
  locale: string;
}

const reasonToKey: Record<InviteErrorReason, string> = {
  expired: "errors.expired",
  revoked: "errors.revoked",
  accepted: "errors.accepted",
  not_found: "errors.notFound",
};

export async function InviteError({ reason, locale }: InviteErrorProps) {
  const t = await getTranslations("acceptInvite");
  const messageKey = reasonToKey[reason] ?? "errors.notFound";

  return (
    <div className="grid min-h-screen place-items-center p-6" style={{ background: "var(--paper)" }}>
      <div className="w-full max-w-[400px] space-y-5">
        <div
          className="flex items-start gap-3 rounded-[12px] p-4 text-[13px]"
          style={{
            background: "var(--negative-tint)",
            color: "#8a3924",
            border: "1px solid #e6c0ad",
          }}
        >
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">{t("title")}</p>
            <p className="mt-1 text-[12.5px]">{t(messageKey as Parameters<typeof t>[0])}</p>
          </div>
        </div>

        <a
          href={`/${locale}/login`}
          className="btn btn-primary flex w-full items-center justify-center gap-2"
          style={{ padding: "12px 16px", fontSize: 14 }}
        >
          {t("backToLogin")} <ArrowRight size={14} />
        </a>
      </div>
    </div>
  );
}
