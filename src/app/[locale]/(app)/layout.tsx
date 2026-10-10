import { getLocale } from "next-intl/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { loginPathFor } from "@/lib/auth/callback-url";
import { REQUEST_PATH_HEADER } from "@/lib/auth/middleware";
import { hasBillingAccess } from "@/lib/auth/billing-access";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { ProjectProvider } from "@/context/ProjectContext";
import { ChatProvider } from "@/context/ChatContext";
import { ChatFab } from "@/components/chat/chat-fab";
import { ChatDrawer } from "@/components/chat/chat-drawer";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const locale = await getLocale();

  if (!session) {
    // Stale cookie cleanup is deliberately NOT done here: Next.js 16 forbids
    // cookies().delete/set in Server Components (only Server Actions and
    // Route Handlers may mutate cookies). There's no redirect loop: the proxy
    // never sends /login back here on a cookie alone, and the login page only
    // redirects once the API accepts the session. The stale cookie just gets
    // overwritten on the next successful login. An expired access token has
    // already been renewed by the proxy from the refresh cookie by now.
    // The token got past the proxy (unexpired but revoked), so this is the only
    // redirect: keep the requested page, as the proxy's own redirect does.
    redirect(loginPathFor((await headers()).get(REQUEST_PATH_HEADER), locale));
  }

  // Onboarding gate: a signed-in user with no company (fresh sign-up, or a
  // company they detached from) must create or join one before using the app.
  // Enforced in the dashboard and projects layouts and the bibliotheque and
  // inventory pages rather than here — this shared layout also wraps /onboarding
  // itself, and Next does not re-render it on a client navigation, so a
  // sidebar link followed from /onboarding would skip a gate placed here.
  // See redirectToOnboardingIfNeeded.

  // Per-company admin gate: only show the billing nav to users who can access
  // billing (superadmin or admin of at least one company).
  const canViewBilling = await hasBillingAccess();

  return (
    <ProjectProvider>
      {/* One channel poll per tab feeds the floating chat button badge and the /chat page. */}
      <ChatProvider>
      <div className="flex h-screen overflow-hidden" style={{ background: "var(--paper)" }}>
        <Sidebar canViewBilling={canViewBilling} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar />
          {/* Content scaled down so less scrolling is needed; zoom reflows
              layout (shrinks scroll height) unlike transform: scale. Sidebar
              and Topbar stay at 100%. The zoom div is h-full so pages can
              opt into filling the visible scroll area with their own h-full
              (percentages resolve across the zoom boundary; taller pages
              simply overflow and scroll as before). */}
          <main className="scroll-area flex-1 pb-16 lg:pb-0">
            <div style={{ zoom: 0.8 }} className="h-full">
              {children}
              {/* main's pb-16 only pads the h-full box, not a long page that
                  overflows it; this spacer keeps a long page's end (e.g. a
                  pager) above the fixed mobile bottom nav. Its 80px × 0.8 zoom
                  equals pb-16, so an h-full page still fits without scrolling. */}
              <div aria-hidden className="h-20 lg:hidden" />
            </div>
          </main>
        </div>
        <MobileBottomNav />
        {/* Floating chat button + right-side drawer — outside the zoomed <main> so their
            fixed offsets stay true. */}
        <ChatFab />
        <ChatDrawer />
      </div>
      </ChatProvider>
    </ProjectProvider>
  );
}
