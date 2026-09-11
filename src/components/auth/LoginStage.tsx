"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { FolioLogo } from "@/components/folio-logo";
import type { LoginMode } from "@/lib/auth/types";
import { LoginForm } from "./LoginForm";
import { usePhoneLoginFlow } from "./use-phone-login-flow";

/**
 * Ink board the sign-in card sits on. Colours here are the on-ink half of the
 * palette — the tokens in globals.css cover paper surfaces, and these three
 * (cream text, muted cream, ink rule) only ever appear over the dark board.
 */
const ON_INK = {
  cream: "#f1ece3",
  creamMuted: "#d9d2c5",
  creamDim: "#9c948a",
  accent: "#ee9552",
  rule: "#3d372f",
} as const;

interface LoginStageProps {
  loginMode: LoginMode;
}

export function LoginStage({ loginMode }: LoginStageProps) {
  const t = useTranslations("auth");
  const flow = usePhoneLoginFlow();
  // "both" opens on the phone form; the toggle inside the card swaps to email
  // and back. The copy column follows it, so the view is owned here.
  const [view, setView] = useState<"phone" | "email">(loginMode === "email" ? "email" : "phone");

  const onPhoneFlow = view === "phone";
  const isCodeStep = onPhoneFlow && flow.step === "code";

  return (
    <div
      className="relative grid min-h-screen grid-cols-1 content-center items-center gap-8 px-6 py-12 lg:grid-cols-[1fr_440px] lg:gap-16 lg:px-20 lg:py-0"
      style={{ background: "var(--ink)" }}
    >
      {/* The board: a site photograph on raised ink, then the scrim that darkens
          it towards the copy column and lets it show through behind the card. */}
      <div className="absolute inset-0" style={{ background: "var(--ink-2)" }}>
        {/* `fill` takes the image out of flow and pins it to this box, so the
            scrim stacked over it still needs no layout pass — the reason the
            bare <img> was here before. What it buys in exchange is the part a
            plain tag cannot do: the optimizer negotiates AVIF/WebP and hands
            each device a width off the srcset, instead of one desktop-sized
            JPEG for everyone. `priority` preloads it, since the board is the
            largest thing this page paints. */}
        <Image
          src="/login-hero.jpg"
          alt=""
          aria-hidden="true"
          fill
          priority
          fetchPriority="high"
          quality={60}
          sizes="100vw"
          className="object-cover"
        />
      </div>
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background:
            "linear-gradient(90deg, rgba(26,26,26,0.94) 0%, rgba(26,26,26,0.88) 45%, rgba(26,26,26,0.6) 100%)",
        }}
      />

      {/* Copy column — the step the card is on, told in words */}
      <div className="relative z-[2] flex max-w-[520px] flex-col gap-5 lg:gap-7">
        <div className="flex items-center gap-3">
          <div
            className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center"
            style={{ background: "var(--ink-2)", borderRadius: 9 }}
          >
            <FolioLogo bare size={22} />
          </div>
          <span
            className="font-display text-[18px] font-semibold"
            style={{ color: ON_INK.cream }}
          >
            Folio
          </span>
        </div>

        <h1
          className="font-display max-w-[460px] text-[34px] font-medium leading-[1.02] lg:text-[56px]"
          style={{ color: ON_INK.cream, letterSpacing: "-0.02em" }}
        >
          {isCodeStep ? t("codeTitle") : t("heroTitle")}
        </h1>

        <p
          className="max-w-[380px] text-[15px] leading-[1.55]"
          style={{ color: ON_INK.creamMuted }}
        >
          {isCodeStep ? (
            <>
              {t.rich("codeSentTo", {
                phone: flow.sentTo,
                mono: (chunks) => (
                  <span className="num" style={{ color: ON_INK.cream }}>
                    {chunks}
                  </span>
                ),
              })}{" "}
              <button
                type="button"
                data-testid="login-change-number"
                onClick={flow.changeNumber}
                style={{ color: ON_INK.accent }}
              >
                {t("changeNumber")}
              </button>
            </>
          ) : onPhoneFlow ? (
            t("heroSubtitlePhone")
          ) : (
            t("heroSubtitle")
          )}
        </p>

        {onPhoneFlow && (
          <ol
            className="flex max-w-[380px] flex-wrap gap-x-6 gap-y-2 pt-5 text-[12px]"
            style={{ borderTop: `1px solid ${ON_INK.rule}`, color: ON_INK.creamMuted }}
          >
            {[t("stepEnterPhone"), t("stepEnterCode"), t("stepEnterSite")].map((label, index) => {
              const done = isCodeStep && index === 0;
              const current = index === (isCodeStep ? 1 : 0);
              return (
                <li key={label} style={{ color: done ? ON_INK.creamDim : ON_INK.creamMuted }}>
                  <span
                    className="num"
                    style={{ color: current ? ON_INK.accent : done ? ON_INK.creamDim : ON_INK.cream }}
                  >
                    {`0${index + 1}`}
                  </span>
                  <span className="ml-1.5" style={{ color: current ? ON_INK.cream : undefined }}>
                    {label}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* Paper card */}
      <div
        className="relative z-[2] w-full"
        style={{
          background: "var(--paper)",
          borderRadius: 24,
          padding: "36px 36px 32px",
          boxShadow: "0 24px 60px -30px rgba(0,0,0,0.6)",
        }}
      >
        <LoginForm loginMode={loginMode} flow={flow} view={view} onViewChange={setView} />
      </div>
    </div>
  );
}
