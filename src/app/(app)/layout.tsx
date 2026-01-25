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
  // Server-side auth check (primary protection)
  const session = await getSession();

  if (!session) {
    redirect("/login");
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
