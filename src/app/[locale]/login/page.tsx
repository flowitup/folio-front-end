import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getSession } from "@/lib/auth/session";
import { LoginStage } from "@/components/auth/LoginStage";
import { postLoginPath } from "@/lib/auth/callback-url";
import { pageTitle } from "@/lib/i18n/page-title";

export const generateMetadata = pageTitle("meta.signIn");

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string | string[]; reason?: string | string[] }>;
}) {
  const session = await getSession();
  const locale = await getLocale();
  const { callbackUrl, reason } = await searchParams;

  if (session) {
    redirect(postLoginPath(typeof callbackUrl === "string" ? callbackUrl : null, locale));
  }

  // The proxy dropped a doubled session cookie: tell the user why they are here.
  return <LoginStage sessionReset={reason === "session_reset"} />;
}
