import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Fraunces } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getLocale, getTranslations } from "next-intl/server";
import "../globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { AuthErrorBoundary } from "@/context/AuthErrorBoundary";
import { getCurrentUser } from "@/lib/auth/session";
import { Toaster } from "@/components/ui/sonner";
import { FlashToast } from "@/components/flash-toast";
import { AgentationWrapper } from "@/components/dev/agentation-wrapper";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz"],
});

/**
 * Title and description in the URL's language. App pages and sections set
 * their own title with pageTitle (@/lib/i18n/page-title); a plain string title
 * (the legal pages) gets the app name from the template; a page with neither
 * shows the default.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  const appName = t("common.appName");
  return {
    title: { default: `${appName} · ${t("common.appTagline")}`, template: `%s · ${appName}` },
    description: t("meta.description"),
  };
}

export default async function LocaleLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${jetbrainsMono.variable} ${fraunces.variable}`}
    >
      <body className="antialiased">
        <NextIntlClientProvider messages={messages}>
          <AuthErrorBoundary>
            <AuthProvider initialUser={user}>{children}</AuthProvider>
          </AuthErrorBoundary>
          {/* Inside the provider: it names its landmark in the page's language. */}
          <Toaster />
          <FlashToast />
        </NextIntlClientProvider>
        <AgentationWrapper />
      </body>
    </html>
  );
}
