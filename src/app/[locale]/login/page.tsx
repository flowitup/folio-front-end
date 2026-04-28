import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getSession } from "@/lib/auth/session";
import { LoginForm } from "@/components/auth/LoginForm";
import { FolioLogo } from "@/components/folio-logo";

interface LoginPageProps {
  searchParams: Promise<{ callbackUrl?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await getSession();
  const locale = await getLocale();
  const t = await getTranslations("auth");
  const tCommon = await getTranslations("common");

  if (session) {
    redirect(`/${locale}/dashboard`);
  }

  const params = await searchParams;
  const callbackUrl = params.callbackUrl || `/${locale}/dashboard`;

  return (
    <div className="grid min-h-screen grid-cols-12">
      {/* Left — form column (cream paper) */}
      <div
        className="col-span-12 flex flex-col p-10 lg:col-span-5"
        style={{ background: "var(--paper)" }}
      >
        <div className="flex items-center gap-3">
          <FolioLogo />
          <div className="leading-tight">
            <div className="font-display text-[18px] font-semibold tracking-tight">Folio</div>
          </div>
        </div>

        <div className="m-auto w-full max-w-[380px]">
          <span className="stamp accent mb-5 inline-flex">{t("welcomeBack")}</span>
          <h1 className="font-display text-[40px] font-medium leading-[1.05] tracking-tight">
            {t("heroTitle")}
          </h1>
          <p className="mt-3 text-[14px]" style={{ color: "var(--muted)" }}>
            {t("heroSubtitle")}
          </p>

          <div className="mt-8">
            <LoginForm callbackUrl={callbackUrl} />
          </div>

          <p className="mt-7 text-[12px]" style={{ color: "var(--muted)" }}>
            {t("newToFolio")}{" "}
            <a
              style={{
                color: "var(--accent-ink)",
                textDecoration: "underline",
                textUnderlineOffset: 3,
              }}
            >
              {t("startProject")}
            </a>
            .
          </p>
        </div>

        <div className="text-[11px]" style={{ color: "var(--muted)" }}>
          {tCommon("copyright")}
        </div>
      </div>

      {/* Right — visual / blueprint panel */}
      <div
        className="relative col-span-7 hidden overflow-hidden lg:flex"
        style={{
          background: "linear-gradient(135deg, #d8b896 0%, #b8845f 60%, #5b3a1f 100%)",
        }}
      >
        <div className="blueprint-grid absolute inset-0 opacity-25" />
        <div className="paper-noise absolute inset-0" />

        <svg
          className="absolute inset-0 m-auto opacity-90"
          width="80%"
          height="80%"
          viewBox="0 0 400 280"
          fill="none"
          stroke="white"
          strokeWidth="0.6"
          strokeLinecap="round"
        >
          <rect x="60" y="50" width="280" height="180" />
          <line x1="60" y1="120" x2="340" y2="120" />
          <line x1="200" y1="50" x2="200" y2="230" />
          <line x1="60" y1="170" x2="200" y2="170" />
          <rect x="80" y="70" width="40" height="20" strokeDasharray="2 2" />
          <circle cx="270" cy="85" r="14" />
          <text x="100" y="110" fill="white" fontSize="6" fontFamily="JetBrains Mono">
            LIVING · 32 m²
          </text>
          <text x="240" y="110" fill="white" fontSize="6" fontFamily="JetBrains Mono">
            KITCHEN · 18 m²
          </text>
          <text x="100" y="200" fill="white" fontSize="6" fontFamily="JetBrains Mono">
            BED 1 · 14 m²
          </text>
          <text x="240" y="200" fill="white" fontSize="6" fontFamily="JetBrains Mono">
            BED 2 · 12 m²
          </text>
          <line x1="60" y1="40" x2="340" y2="40" strokeDasharray="2 3" />
          <text x="190" y="35" fill="white" fontSize="6" fontFamily="JetBrains Mono">
            14.0 m
          </text>
          <line x1="50" y1="50" x2="50" y2="230" strokeDasharray="2 3" />
          <text
            x="30"
            y="145"
            fill="white"
            fontSize="6"
            fontFamily="JetBrains Mono"
            transform="rotate(-90 30 145)"
          >
            9.0 m
          </text>
        </svg>

        <div className="absolute bottom-8 left-8 right-8 text-white">
          <div className="font-display text-[28px] leading-tight">
            &ldquo;
            {t.rich("quote", {
              em: (chunks) => <em>{chunks}</em>,
            })}
            &rdquo;
          </div>
          <div className="mt-3 flex items-center gap-2 text-[12px] opacity-80">
            <div className="h-px w-6 bg-white/60" /> {t("quoteAuthor")}
          </div>
        </div>
      </div>
    </div>
  );
}
