import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Outfit } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getLocale } from "next-intl/server";
import "../globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { AuthErrorBoundary } from "@/context/AuthErrorBoundary";
import { getCurrentUser } from "@/lib/auth/session";
import { Agentation } from "agentation";

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

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Construction — Project Management",
  description: "Streamlined construction project management with Nordic-inspired simplicity",
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
    <html lang={locale} className={`${inter.variable} ${jetbrainsMono.variable} ${outfit.variable}`}>
      <body className="antialiased">
        <NextIntlClientProvider messages={messages}>
          <AuthErrorBoundary>
            <AuthProvider initialUser={user}>{children}</AuthProvider>
          </AuthErrorBoundary>
        </NextIntlClientProvider>
        {process.env.NODE_ENV === "development" && <Agentation />}
      </body>
    </html>
  );
}
