"use client";

import { useAuth } from "@/context/AuthContext";
import { ProjectSelector } from "@/components/project/ProjectSelector";

export function Topbar() {
  const { user, logout, isLoading } = useAuth();

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      {/* Left side - Project selector + Page title */}
      <div className="flex items-center gap-4">
        <ProjectSelector />
        <div className="h-6 w-px bg-gray-200" />
        <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>
      </div>

      {/* Right side - user menu */}
      <div className="flex items-center gap-4">
        {/* Notifications */}
        <button
          className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
          aria-label="View notifications"
        >
          <span aria-hidden="true">🔔</span>
        </button>

        {/* User info and logout */}
        {user && (
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center">
              <span className="text-sm font-medium text-white">
                {user.email.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="text-sm font-medium text-gray-700">
              {user.email}
            </span>
            <button
              onClick={() => logout()}
              disabled={isLoading}
              className="rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "..." : "Sign out"}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
