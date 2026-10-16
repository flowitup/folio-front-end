import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { verifyInvite } from "@/lib/api/invitations";
import { AcceptInviteForm } from "./accept-invite-form";
import { InviteError } from "./invite-error";
import { JoinAsInvitee } from "./join-as-invitee";
import { userDisplayName } from "@/lib/auth/user-display";

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

function sameEmail(a: string | null | undefined, b: string | null | undefined): boolean {
  return !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
}

export default async function AcceptInvitePage({ params }: AcceptInvitePageProps) {
  const { token, locale } = await params;

  // A signed-in visitor joins straight from their session: the token is the
  // authorisation, as it is for a brand-new phone, so someone who signed up on
  // mobile (synthetic address) or under another e-mail can accept too. Only
  // when the invited address belongs to ANOTHER account does the API refuse,
  // and the screen then offers to switch account.
  const session = await getSession();
  if (session) {
    const current = await verifyInvite(token).catch(() => null);
    // The invitation is already accepted: this is the page re-rendering right
    // after a successful acceptance set the new session cookies.
    if (current && "error" in current && current.error === "accepted") {
      redirect(`/${locale}/dashboard`);
    }
    // A dead link (unknown, expired, revoked) says so at once.
    if (current && "error" in current) {
      return <InviteError reason={current.error} locale={locale} />;
    }
    if (current) {
      return (
        <JoinAsInvitee
          token={token}
          locale={locale}
          projectName={current.project_name}
          // Phone-only accounts carry a synthetic address: name them by name or phone.
          currentUser={userDisplayName(session.user)}
          isInvitee={sameEmail(session.user.email, current.email)}
          returnPath={`/${locale}/accept-invite/${encodeURIComponent(token)}`}
        />
      );
    }
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
