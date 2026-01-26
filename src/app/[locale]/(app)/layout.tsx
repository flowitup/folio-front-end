import { cookies } from "next/headers";
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
    // Clear invalid cookie to prevent redirect loop
    const cookieStore = await cookies();
    const hasToken = cookieStore.get("access_token_cookie");
    if (hasToken) {
      // Cookie exists but session invalid - clear it via response
      cookieStore.delete("access_token_cookie");
      cookieStore.delete("refresh_token_cookie");
    }
    redirect(`/${locale}/login`);
  }

  return (
    <ProjectProvider>
      <div
        className="flex h-screen"
        style={{ background: 'var(--bg-primary)' }}
      >
        {/* Sidebar */}
        <Sidebar />

        {/* Main content area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Topbar */}
          <Topbar />

          {/* Page content - Generous padding for Scandinavian breathing room */}
          <main
            className="flex-1 overflow-y-auto p-8 lg:p-10"
            style={{ background: 'var(--bg-primary)' }}
          >
            <div className="mx-auto max-w-7xl">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ProjectProvider>
  );
}
