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
