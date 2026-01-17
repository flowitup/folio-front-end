"use client";

export function Topbar() {
    return (
        <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
            {/* Page title area */}
            <div>
                <h1 className="text-lg font-semibold text-gray-900">
                    {/* TODO: Dynamic page title based on current route */}
                    Dashboard
                </h1>
            </div>

            {/* Right side - user menu placeholder */}
            <div className="flex items-center gap-4">
                {/* Notifications placeholder */}
                <button className="rounded-full p-2 text-gray-500 hover:bg-gray-100">
                    🔔
                </button>

                {/* User menu placeholder */}
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-slate-300" />
                    <span className="text-sm font-medium text-gray-700">
                        {/* TODO: Display user name */}
                        User
                    </span>
                </div>
            </div>
        </header>
    );
}
