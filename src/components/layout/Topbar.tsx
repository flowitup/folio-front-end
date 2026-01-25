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
          className="cursor-pointer rounded-full p-2 text-gray-500 transition-colors duration-200 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          aria-label="View notifications"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
            />
          </svg>
        </button>

        {/* User info and logout */}
        {user && (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600">
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
              className="cursor-pointer rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 transition-colors duration-200 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "..." : "Sign out"}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
