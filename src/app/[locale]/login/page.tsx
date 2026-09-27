import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getSession } from "@/lib/auth/session";
import { LoginStage } from "@/components/auth/LoginStage";
import { postLoginPath } from "@/lib/auth/callback-url";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string | string[] }>;
}) {
  const session = await getSession();
  const locale = await getLocale();

  if (session) {
    const { callbackUrl } = await searchParams;
    redirect(postLoginPath(typeof callbackUrl === "string" ? callbackUrl : null, locale));
  }

  return <LoginStage />;
}
