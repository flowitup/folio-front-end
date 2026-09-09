import { getLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
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
    // Route Handlers may mutate cookies). The /login page is outside this
    // (app) route group, so there's no redirect loop — the stale cookie just
    // gets overwritten on the next successful login (BE sets a fresh
    // access_token_cookie in its login response). If we ever need explicit
    // server-side cookie clearing we can add a Route Handler the layout
    // redirects through.
    redirect(`/${locale}/login`);
  }

  // Onboarding gate: a signed-in user with no company (fresh sign-up, or a
  // company they detached from) must create or join one before using the app.
  // Enforced in dashboard/layout.tsx rather than here — this shared layout
  // also wraps /onboarding itself, and Server Component layouts have no
  // pathname API to avoid a self-redirect loop without one (login always
  // lands on /dashboard, so gating there covers "after sign-up/login"
  // without touching the existing proxy.ts auth/locale middleware).

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
