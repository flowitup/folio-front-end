"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: "📊" },
    { name: "Projects", href: "/projects", icon: "📁" },
    { name: "Settings", href: "/settings", icon: "⚙️" },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="flex w-64 flex-col bg-slate-900 text-white">
            {/* Logo */}
            <div className="flex h-16 items-center justify-center border-b border-slate-700">
                <span className="text-xl font-bold">Construction</span>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-1 px-3 py-4">
                {navigation.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive
                                    ? "bg-slate-800 text-white"
                                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                                }`}
                        >
                            <span>{item.icon}</span>
                            {item.name}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer placeholder */}
            <div className="border-t border-slate-700 p-4">
                <p className="text-xs text-slate-400">© 2026 Construction App</p>
            </div>
        </aside>
    );
}
