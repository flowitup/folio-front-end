import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getSession } from "@/lib/auth/session";
import { safeCallbackPath } from "@/lib/auth/callback-url";
import { LoginStage } from "@/components/auth/LoginStage";

interface LoginPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await getSession();
  const locale = await getLocale();

  if (session) {
    const { callbackUrl } = await searchParams;
    redirect(
      safeCallbackPath(typeof callbackUrl === "string" ? callbackUrl : null) ??
        `/${locale}/dashboard`
    );
  }

  return <LoginStage />;
}
