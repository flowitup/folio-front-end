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
        </div>
      </div>

      {/* Right — visual: workbench flat-lay */}
      <div
        className="relative col-span-7 hidden overflow-hidden lg:flex"
        style={{
          background:
            "radial-gradient(ellipse at 50% 40%, #a07a4e 0%, #5a3e22 75%, #2a1810 100%)",
        }}
      >
        <div className="paper-noise absolute inset-0" style={{ opacity: 0.4 }} />

        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="-105 -105 610 710"
          preserveAspectRatio="xMidYMid slice"
        >
          {/* wood grain */}
          <g stroke="#3a2510" strokeWidth="0.5" opacity="0.4">
            <line x1="0" y1="60" x2="400" y2="55" />
            <line x1="0" y1="160" x2="400" y2="158" />
            <line x1="0" y1="280" x2="400" y2="278" />
            <line x1="0" y1="380" x2="400" y2="378" />
            <line x1="0" y1="450" x2="400" y2="448" />
          </g>

          {/* rolled plans */}
          <g transform="translate(50 80) rotate(-8)">
            <rect width="180" height="36" rx="4" fill="#efe9de" />
            <rect x="0" y="0" width="180" height="6" fill="#d6cdbb" />
            <rect x="0" y="30" width="180" height="6" fill="#d6cdbb" />
            <line x1="20" y1="18" x2="160" y2="18" stroke="#b96523" strokeWidth="0.6" strokeDasharray="3 2" />
            <line x1="30" y1="22" x2="120" y2="22" stroke="#b96523" strokeWidth="0.5" strokeDasharray="2 2" />
          </g>

          {/* hammer */}
          <g transform="translate(60 200) rotate(15)">
            <rect x="0" y="20" width="180" height="10" fill="#5a3a22" />
            <rect x="0" y="20" width="180" height="2" fill="#3a2510" />
            <path d="M 170 0 L 230 0 L 240 18 L 240 32 L 230 50 L 170 50 Z" fill="#3a3530" />
            <rect x="220" y="14" width="8" height="22" fill="#1a1a1a" />
          </g>

          {/* level */}
          <g transform="translate(80 300) rotate(-3)">
            <rect width="240" height="22" rx="3" fill="#e8843c" />
            <rect x="6" y="6" width="228" height="10" rx="2" fill="#3a2510" />
            <rect x="108" y="8" width="24" height="6" fill="#fff5dc" />
            <circle cx="120" cy="11" r="2" fill="#1a1a1a" />
            <rect x="32" y="8" width="14" height="6" fill="#fff5dc" opacity="0.7" />
            <rect x="200" y="8" width="14" height="6" fill="#fff5dc" opacity="0.7" />
          </g>

          {/* pencil */}
          <g transform="translate(180 380) rotate(20)">
            <rect width="120" height="6" fill="#fbd9a4" />
            <polygon points="-12,0 0,3 -12,6" fill="#3a2510" />
            <polygon points="-14,2 -12,3 -14,4" fill="#1a1a1a" />
            <rect x="116" width="14" height="6" fill="#c25a35" />
            <rect x="120" width="6" height="6" fill="#8a4a2a" />
          </g>

          {/* nail */}
          <g transform="translate(290 110) rotate(40)">
            <circle r="4" fill="#8a8479" />
            <rect x="-1.5" y="0" width="3" height="36" fill="#8a8479" />
            <polygon points="-1.5,36 1.5,36 0,42" fill="#8a8479" />
          </g>

          {/* second nail */}
          <g transform="translate(330 240) rotate(-20)">
            <circle r="3" fill="#8a8479" />
            <rect x="-1" y="0" width="2" height="26" fill="#8a8479" />
            <polygon points="-1,26 1,26 0,30" fill="#8a8479" />
          </g>

          {/* PVC window */}
          <g transform="translate(250 380) rotate(-6)">
            <ellipse cx="80" cy="120" rx="100" ry="6" fill="#1a1a1a" opacity="0.35" />
            <rect x="0" y="0" width="160" height="120" fill="#d8d4ca" />
            <rect x="2" y="2" width="156" height="116" fill="#f4f1ea" />
            <rect x="2" y="2" width="156" height="3" fill="#fff" />
            <rect x="2" y="115" width="156" height="3" fill="#c8c4ba" />
            <rect x="10" y="10" width="140" height="100" fill="#e8e4da" />
            <rect x="12" y="12" width="136" height="96" fill="#fafaf4" />
            <rect x="12" y="12" width="136" height="2" fill="#fff" />
            <rect x="12" y="106" width="136" height="2" fill="#c8c4ba" />
            <rect x="16" y="16" width="128" height="88" fill="url(#sky-grad)" />
            <rect x="76" y="12" width="8" height="96" fill="#fafaf4" />
            <rect x="76" y="12" width="8" height="2" fill="#fff" />
            <rect x="82" y="12" width="2" height="96" fill="#c8c4ba" />
            <rect x="12" y="56" width="136" height="8" fill="#fafaf4" />
            <rect x="12" y="56" width="136" height="2" fill="#fff" />
            <rect x="12" y="62" width="136" height="2" fill="#c8c4ba" />
            <path d="M 18 18 L 60 18 L 18 60 Z" fill="#fff" opacity="0.22" />
            <path d="M 88 66 L 124 66 L 88 102 Z" fill="#fff" opacity="0.12" />
            <ellipse cx="40" cy="92" rx="3" ry="10" fill="#3a2a1a" opacity="0.65" />
            <ellipse cx="110" cy="94" rx="3" ry="8" fill="#3a2a1a" opacity="0.55" />
            <line x1="16" y1="86" x2="76" y2="86" stroke="#a8927a" strokeWidth="0.6" opacity="0.6" />
            <line x1="84" y1="86" x2="144" y2="86" stroke="#a8927a" strokeWidth="0.6" opacity="0.6" />
            <rect x="74" y="58" width="12" height="6" fill="#b8b4ac" />
            <rect x="78" y="56" width="4" height="14" fill="#d8d4ca" />
            <rect x="78" y="56" width="4" height="3" fill="#fff" />
            <rect x="124" y="14" width="18" height="4" fill="#fff" opacity="0.7" />
          </g>

          {/* tape measure */}
          <g transform="translate(40 420)">
            <circle cx="22" cy="22" r="22" fill="#1a1a1a" />
            <circle cx="22" cy="22" r="14" fill="#e8843c" />
            <circle cx="22" cy="22" r="6" fill="#1a1a1a" />
            <rect x="44" y="18" width="40" height="8" fill="#fff5dc" />
            <g stroke="#1a1a1a" strokeWidth="0.5">
              <line x1="50" y1="18" x2="50" y2="22" />
              <line x1="56" y1="18" x2="56" y2="24" />
              <line x1="62" y1="18" x2="62" y2="22" />
              <line x1="68" y1="18" x2="68" y2="24" />
              <line x1="74" y1="18" x2="74" y2="22" />
              <line x1="80" y1="18" x2="80" y2="24" />
            </g>
          </g>

          {/* stack of bricks */}
          <g transform="translate(310 30) rotate(-6)">
            <ellipse cx="50" cy="58" rx="58" ry="6" fill="#1a1a1a" opacity="0.35" />
            <g>
              <rect x="0" y="34" width="50" height="22" fill="#a8482a" stroke="#6b2a16" strokeWidth="0.8" />
              <rect x="0" y="34" width="50" height="3" fill="#c25a35" />
              <rect x="50" y="34" width="50" height="22" fill="#b04d2c" stroke="#6b2a16" strokeWidth="0.8" />
              <rect x="50" y="34" width="50" height="3" fill="#c86a3d" />
            </g>
            <g>
              <rect x="-22" y="14" width="50" height="22" fill="#9a3f24" stroke="#6b2a16" strokeWidth="0.8" />
              <rect x="-22" y="14" width="50" height="3" fill="#b85230" />
              <rect x="28" y="14" width="50" height="22" fill="#a8482a" stroke="#6b2a16" strokeWidth="0.8" />
              <rect x="28" y="14" width="50" height="3" fill="#c25a35" />
              <rect x="78" y="14" width="34" height="22" fill="#8a3920" stroke="#6b2a16" strokeWidth="0.8" />
            </g>
            <g>
              <rect x="14" y="-6" width="50" height="22" fill="#b04d2c" stroke="#6b2a16" strokeWidth="0.8" />
              <rect x="14" y="-6" width="50" height="3" fill="#c86a3d" />
              <circle cx="28" cy="6" r="0.8" fill="#5a2010" />
              <circle cx="44" cy="9" r="0.6" fill="#5a2010" />
              <circle cx="55" cy="4" r="0.7" fill="#5a2010" />
            </g>
          </g>

          {/* rebar bundle */}
          <g transform="translate(-50 30) rotate(20)">
            <rect x="0" y="14" width="320" height="18" fill="#1a1a1a" opacity="0.3" />
            <g>
              <rect x="0" y="0" width="320" height="5" fill="#7a6555" />
              <rect x="0" y="0" width="320" height="1.5" fill="#a8927a" />
              <g stroke="#3a2a1a" strokeWidth="0.5" opacity="0.7">
                {Array.from({ length: 32 }).map((_, i) => (
                  <line key={i} x1={i * 10} y1="0" x2={i * 10 + 3} y2="5" />
                ))}
              </g>
            </g>
            <g transform="translate(2 6)">
              <rect x="0" y="0" width="318" height="5" fill="#8a7565" />
              <rect x="0" y="0" width="318" height="1.5" fill="#b8a28a" />
              <g stroke="#3a2a1a" strokeWidth="0.5" opacity="0.7">
                {Array.from({ length: 32 }).map((_, i) => (
                  <line key={i} x1={i * 10 + 3} y1="0" x2={i * 10 + 6} y2="5" />
                ))}
              </g>
            </g>
            <g transform="translate(-2 12)">
              <rect x="0" y="0" width="322" height="5" fill="#6a5545" />
              <rect x="0" y="0" width="322" height="1.5" fill="#988270" />
              <g stroke="#3a2a1a" strokeWidth="0.5" opacity="0.7">
                {Array.from({ length: 32 }).map((_, i) => (
                  <line key={i} x1={i * 10 + 1} y1="0" x2={i * 10 + 4} y2="5" />
                ))}
              </g>
            </g>
            <path d="M 140 -3 Q 145 22 138 22" stroke="#3a3530" strokeWidth="1.2" fill="none" />
          </g>

          {/* trowel */}
          <g transform="translate(-30 320) rotate(-25)">
            <ellipse cx="60" cy="14" rx="60" ry="4" fill="#1a1a1a" opacity="0.3" />
            <path d="M 0 0 L 110 -8 L 110 16 L 0 8 Z" fill="#c8c0b0" />
            <path d="M 0 0 L 110 -8 L 110 16 L 0 8 Z" fill="url(#trowel-shine)" opacity="0.5" />
            <path d="M 0 0 L 110 -8" stroke="#a8a090" strokeWidth="0.6" />
            <path d="M 0 8 L 110 16" stroke="#888070" strokeWidth="0.6" />
            <path d="M 30 2 Q 50 -4 80 0 Q 90 6 70 10 Q 50 12 35 8 Z" fill="#d6cdbb" opacity="0.85" />
            <path d="M -2 2 L -14 -4 L -18 4 L -10 10 Z" fill="#3a3530" />
            <rect x="-58" y="-2" width="44" height="10" rx="4" fill="#6e4a2c" />
            <rect x="-58" y="-2" width="44" height="3" fill="#8a5e36" />
            <rect x="-60" y="-3" width="6" height="12" rx="2" fill="#3a2510" />
          </g>

          {/* mound of mortar / sand on a board */}
          <g transform="translate(160 470)">
            <ellipse cx="50" cy="14" rx="60" ry="6" fill="#1a1a1a" opacity="0.35" />
            <rect x="-10" y="6" width="120" height="6" fill="#3a2510" />
            <path d="M 6 6 Q 30 -16 60 -10 Q 88 -6 100 6 Z" fill="#c8baa0" />
            <circle cx="20" cy="0" r="0.6" fill="#8a7a5a" />
            <circle cx="40" cy="-6" r="0.5" fill="#8a7a5a" />
            <circle cx="56" cy="-2" r="0.7" fill="#8a7a5a" />
            <circle cx="78" cy="2" r="0.5" fill="#8a7a5a" />
          </g>

          {/* bolt + washer */}
          <g transform="translate(380 360) rotate(15)">
            <circle r="9" fill="#5a5550" />
            <circle r="6" fill="#3a3530" />
            <polygon points="-7,-4 7,-4 9,0 7,4 -7,4 -9,0" fill="#6a6560" opacity="0.5" />
          </g>

          {/* small wood block */}
          <g transform="translate(370 80) rotate(8)">
            <rect width="60" height="28" fill="#6e4a2c" />
            <rect width="60" height="4" fill="#8a5e36" />
            <line x1="0" y1="14" x2="60" y2="13" stroke="#3a2510" strokeWidth="0.4" opacity="0.6" />
            <line x1="0" y1="22" x2="60" y2="21" stroke="#3a2510" strokeWidth="0.4" opacity="0.6" />
          </g>

          <defs>
            <linearGradient id="trowel-shine" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="sky-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#9ec3d8" />
              <stop offset="60%" stopColor="#d8b890" />
              <stop offset="100%" stopColor="#7a6238" />
            </linearGradient>
          </defs>
        </svg>

        {/* vignette */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.55) 100%)",
          }}
        />
      </div>
    </div>
  );
}
