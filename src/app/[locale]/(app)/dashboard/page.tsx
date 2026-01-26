"use client";

import { useTranslations } from "next-intl";

export default function DashboardPage() {
    const t = useTranslations("dashboard");

    return (
        <div className="space-y-8">
            {/* Page Header */}
            <div>
                <h2
                    className="text-2xl font-semibold tracking-tight font-outfit"
                    style={{ color: 'var(--text-primary)' }}
                >
                    {t("title")}
                </h2>
                <p
                    className="mt-2 text-base"
                    style={{ color: 'var(--text-secondary)' }}
                >
                    {t("welcome")}
                </p>
            </div>

            {/* Metrics Grid - Scandinavian card design */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {/* Active Projects Card */}
                <div
                    className="rounded-2xl p-6 transition-all duration-200 cursor-pointer"
                    style={{
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-subtle)',
                        boxShadow: 'var(--shadow-sm)',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                        e.currentTarget.style.borderColor = 'var(--border-default)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                        e.currentTarget.style.borderColor = 'var(--border-subtle)';
                    }}
                >
                    <div className="flex items-center justify-between">
                        <h3
                            className="font-medium text-sm"
                            style={{ color: 'var(--text-secondary)' }}
                        >
                            {t("activeProjects")}
                        </h3>
                        <div
                            className="rounded-lg p-2"
                            style={{ background: 'var(--accent-primary-light)' }}
                        >
                            <svg
                                className="h-5 w-5"
                                style={{ color: 'var(--accent-primary)' }}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={1.5}
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
                                />
                            </svg>
                        </div>
                    </div>
                    <p
                        className="mt-4 text-4xl font-semibold font-outfit tracking-tight"
                        style={{ color: 'var(--text-primary)' }}
                    >
                        --
                    </p>
                    <p
                        className="mt-2 text-sm"
                        style={{ color: 'var(--text-tertiary)' }}
                    >
                        {t("awaitingData")}
                    </p>
                </div>

                {/* Pending Tasks Card */}
                <div
                    className="rounded-2xl p-6 transition-all duration-200 cursor-pointer"
                    style={{
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-subtle)',
                        boxShadow: 'var(--shadow-sm)',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                        e.currentTarget.style.borderColor = 'var(--border-default)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                        e.currentTarget.style.borderColor = 'var(--border-subtle)';
                    }}
                >
                    <div className="flex items-center justify-between">
                        <h3
                            className="font-medium text-sm"
                            style={{ color: 'var(--text-secondary)' }}
                        >
                            {t("pendingTasks")}
                        </h3>
                        <div
                            className="rounded-lg p-2"
                            style={{ background: 'var(--status-warning-bg)' }}
                        >
                            <svg
                                className="h-5 w-5"
                                style={{ color: 'var(--status-warning)' }}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={1.5}
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
                                />
                            </svg>
                        </div>
                    </div>
                    <p
                        className="mt-4 text-4xl font-semibold font-outfit tracking-tight"
                        style={{ color: 'var(--text-primary)' }}
                    >
                        --
                    </p>
                    <p
                        className="mt-2 text-sm"
                        style={{ color: 'var(--text-tertiary)' }}
                    >
                        {t("awaitingData")}
                    </p>
                </div>

                {/* Team Members Card */}
                <div
                    className="rounded-2xl p-6 transition-all duration-200 cursor-pointer"
                    style={{
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-subtle)',
                        boxShadow: 'var(--shadow-sm)',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                        e.currentTarget.style.borderColor = 'var(--border-default)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                        e.currentTarget.style.borderColor = 'var(--border-subtle)';
                    }}
                >
                    <div className="flex items-center justify-between">
                        <h3
                            className="font-medium text-sm"
                            style={{ color: 'var(--text-secondary)' }}
                        >
                            {t("teamMembers")}
                        </h3>
                        <div
                            className="rounded-lg p-2"
                            style={{ background: 'var(--status-info-bg)' }}
                        >
                            <svg
                                className="h-5 w-5"
                                style={{ color: 'var(--status-info)' }}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={1.5}
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
                                />
                            </svg>
                        </div>
                    </div>
                    <p
                        className="mt-4 text-4xl font-semibold font-outfit tracking-tight"
                        style={{ color: 'var(--text-primary)' }}
                    >
                        --
                    </p>
                    <p
                        className="mt-2 text-sm"
                        style={{ color: 'var(--text-tertiary)' }}
                    >
                        {t("awaitingData")}
                    </p>
                </div>
            </div>

            {/* Activity Section */}
            <div
                className="rounded-2xl p-6"
                style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    boxShadow: 'var(--shadow-sm)',
                }}
            >
                <h3
                    className="text-lg font-medium font-outfit"
                    style={{ color: 'var(--text-primary)' }}
                >
                    {t("recentActivity")}
                </h3>
                <div
                    className="mt-6 flex items-center justify-center py-12 rounded-xl"
                    style={{ background: 'var(--bg-muted)' }}
                >
                    <div className="text-center">
                        <svg
                            className="mx-auto h-12 w-12"
                            style={{ color: 'var(--text-tertiary)' }}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1}
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                        </svg>
                        <p
                            className="mt-4 text-sm"
                            style={{ color: 'var(--text-tertiary)' }}
                        >
                            {t("noActivity")}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
