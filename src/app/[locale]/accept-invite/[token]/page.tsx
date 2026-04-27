import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import { verifyInvite } from "@/lib/api/invitations";
import { AcceptInviteForm } from "./accept-invite-form";
import { InviteError } from "./invite-error";
import { LoggedInOther } from "./logged-in-other";

interface AcceptInvitePageProps {
  params: Promise<{ token: string; locale: string }>;
}

/**
 * Suppress referrer header so the token in the URL is not forwarded
 * when the user navigates away (e.g. clicks "Back to login").
 */
export async function generateMetadata(): Promise<Metadata> {
  return {
    other: { referrer: "no-referrer" },
  };
}

export default async function AcceptInvitePage({ params }: AcceptInvitePageProps) {
  const { token, locale } = await params;

  // Gate: if the user is already authenticated, ask them to sign out first
  const session = await getSession();
  if (session) {
    return <LoggedInOther currentEmail={session.user.email} />;
  }

  // Verify the token before rendering the form
  const result = await verifyInvite(token);

  if ("error" in result) {
    return <InviteError reason={result.error} locale={locale} />;
  }

  return (
    <AcceptInviteForm
      token={token}
      locale={locale}
      verified={result}
    />
  );
}
