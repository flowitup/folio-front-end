import { getLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
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
          <main className="scroll-area flex-1">{children}</main>
        </div>
      </div>
    </ProjectProvider>
  );
}
