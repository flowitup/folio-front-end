import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { verifyInvite } from "@/lib/api/invitations";
import { AcceptInviteForm } from "./accept-invite-form";
import { InviteError } from "./invite-error";
import { LoggedInOther } from "./logged-in-other";
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

  // Gate: if the user is already authenticated, ask them to sign out first —
  // unless the invitation is already accepted: that is this page re-rendering
  // right after a successful acceptance set the new session cookies, and the
  // "signed in as someone else" screen used to flash before the redirect —
  // or unless they ARE the invitee, who then joins from their session.
  const session = await getSession();
  if (session) {
    const current = await verifyInvite(token).catch(() => null);
    if (current && "error" in current && current.error === "accepted") {
      redirect(`/${locale}/dashboard`);
    }
    // A dead link (unknown, expired, revoked) says so at once: asking to sign
    // out first only led to the same error after signing out.
    if (current && "error" in current) {
      return <InviteError reason={current.error} locale={locale} />;
    }
    if (current && !("error" in current) && sameEmail(session.user.email, current.email)) {
      return (
        <JoinAsInvitee
          token={token}
          locale={locale}
          projectName={current.project_name}
          currentUser={userDisplayName(session.user)}
        />
      );
    }
    // Phone-only accounts carry a synthetic address: name them by name or phone.
    return (
      <LoggedInOther
        currentEmail={userDisplayName(session.user)}
        returnPath={`/${locale}/accept-invite/${encodeURIComponent(token)}`}
      />
    );
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
