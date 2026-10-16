import { getLocale, getTranslations } from "next-intl/server";
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
import { SessionFreshness } from "@/components/layout/session-freshness";
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
  const tNav = await getTranslations("navigation");

  return (
    <ProjectProvider>
      {/* Re-reads the user and the project list on focus, navigation and 403s, so a change
          made by another admin or on another device shows without a reload. */}
      <SessionFreshness />
      {/* One channel poll per tab feeds the floating chat button badge and the /chat page. */}
      <ChatProvider>
      <div className="flex h-screen overflow-hidden" style={{ background: "var(--paper)" }}>
        {/* First Tab stop: jump past the logo, switcher and sidebar links. */}
        <a href="#main-content" className="skip-link">
          {tNav("skipToContent")}
        </a>
        <Sidebar canViewBilling={canViewBilling} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar />
          {/* On desktop (≥1024px) content is scaled down (--app-zoom, 0.8) so
              less scrolling is needed; zoom reflows layout (shrinks scroll
              height) unlike transform: scale. Sidebar and Topbar stay at 100%.
              Phones and tablets are NOT scaled: there the zoom made text 8-10px
              and inputs ~10px (which iOS zooms into on focus). The zoom div is
              h-full so pages can opt into filling the visible scroll area with
              their own h-full (percentages resolve across the zoom boundary;
              taller pages simply overflow and scroll as before). */}
          <main id="main-content" tabIndex={-1} className="scroll-area flex-1 pb-16 outline-none lg:pb-0">
            <div className="app-zoom h-full">
              {children}
              {/* main's pb-16 only pads the h-full box, not a long page that
                  overflows it; this spacer keeps a long page's end (e.g. a
                  pager) above the fixed mobile bottom nav. Below lg nothing is
                  zoomed, so its 64px equals pb-16 and an h-full page still fits. */}
              <div aria-hidden className="h-16 lg:hidden" />
            </div>

            {/* Desktop: the floating chat button (52px, 24px from the corner) covers the
                last 76px of the screen; this unzoomed spacer lets the end of a long page
                (the last row's delete button) scroll clear of it. */}
            <div aria-hidden className="hidden h-[88px] lg:block" />
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
