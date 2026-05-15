import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Fraunces } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getLocale } from "next-intl/server";
import dynamic from "next/dynamic";
import "../globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { AuthErrorBoundary } from "@/context/AuthErrorBoundary";
import { ThemeProvider } from "@/context/ThemeContext";
import { getCurrentUser } from "@/lib/auth/session";
import { Toaster } from "@/components/ui/sonner";

// Dev-only visual feedback toolbar. Gated behind dynamic() so the prod
// bundle never includes the package — keeps the runtime surface lean and
// avoids shipping a dev-tooling package to end users.
const Agentation =
  process.env.NODE_ENV === "development"
    ? dynamic(() => import("agentation").then((m) => m.Agentation), { ssr: false })
    : null;

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

export const metadata: Metadata = {
  title: "Folio · Build Journal",
  description: "A warm, human-feeling app for managing the construction of your own house.",
};

export default async function LocaleLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className={`${inter.variable} ${jetbrainsMono.variable} ${fraunces.variable}`}>
      <body className="antialiased">
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider>
            <AuthErrorBoundary>
              <AuthProvider initialUser={user}>{children}</AuthProvider>
            </AuthErrorBoundary>
          </ThemeProvider>
        </NextIntlClientProvider>
        {process.env.NODE_ENV === "development" && Agentation && <Agentation />}
        <Toaster />
      </body>
    </html>
  );
}
