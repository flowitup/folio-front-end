import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getSession } from "@/lib/auth/session";

export default async function LocaleRootPage() {
  const session = await getSession();
  const locale = await getLocale();

  if (session) {
    redirect(`/${locale}/dashboard`);
  }
  redirect(`/${locale}/login`);
}
