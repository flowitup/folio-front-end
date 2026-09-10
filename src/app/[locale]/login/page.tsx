import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getSession } from "@/lib/auth/session";
import { getAuthConfig } from "@/lib/api/auth-config";
import { LoginStage } from "@/components/auth/LoginStage";

export default async function LoginPage() {
  const session = await getSession();
  const locale = await getLocale();

  if (session) {
    redirect(`/${locale}/dashboard`);
  }

  const config = await getAuthConfig();

  return <LoginStage loginMode={config.login_mode} />;
}
