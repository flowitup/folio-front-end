import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import type { ReactNode } from "react";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredPermissions?: string[];
  requiredRoles?: string[];
  fallbackUrl?: string;
}

/**
 * Server Component wrapper for protected routes.
 * Verifies authentication and optionally permissions/roles.
 */
export async function ProtectedRoute({
  children,
  requiredPermissions = [],
  requiredRoles = [],
  fallbackUrl = "/login",
}: ProtectedRouteProps) {
  const session = await getSession();

  // Not authenticated
  if (!session) {
    redirect(fallbackUrl);
  }

  // Check required permissions
  if (requiredPermissions.length > 0) {
    const hasAllPermissions = requiredPermissions.every((perm) =>
      session.user.permissions.includes(perm)
    );
    if (!hasAllPermissions) {
      redirect("/unauthorized");
    }
  }

  // Check required roles
  if (requiredRoles.length > 0) {
    const hasAnyRole = requiredRoles.some((role) =>
      session.user.roles.includes(role)
    );
    if (!hasAnyRole) {
      redirect("/unauthorized");
    }
  }

  return <>{children}</>;
}
