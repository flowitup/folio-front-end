import { getLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { ProjectProvider } from "@/context/ProjectContext";

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

  return (
    <ProjectProvider>
      <div className="flex h-screen overflow-hidden" style={{ background: "var(--paper)" }}>
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar />
          {/* Content scaled down so less scrolling is needed; zoom reflows
              layout (shrinks scroll height) unlike transform: scale. Sidebar
              and Topbar stay at 100%. */}
          <main className="scroll-area flex-1 pb-16 lg:pb-0">
            <div style={{ zoom: 0.8 }}>{children}</div>
          </main>
        </div>
        <MobileBottomNav />
      </div>
    </ProjectProvider>
  );
}
