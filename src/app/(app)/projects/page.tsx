"use client";

export default function ProjectsPage() {
    return (
        <div className="space-y-8">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2
                        className="text-2xl font-semibold tracking-tight font-outfit"
                        style={{ color: 'var(--text-primary)' }}
                    >
                        Projects
                    </h2>
                    <p
                        className="mt-2 text-base"
                        style={{ color: 'var(--text-secondary)' }}
                    >
                        Manage your construction projects here.
                    </p>
                </div>

                {/* Add Project Button */}
                <button
                    className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-medium transition-all duration-200 cursor-pointer"
                    style={{
                        background: 'var(--accent-primary)',
                        color: 'var(--text-inverse)',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--accent-primary-hover)';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--accent-primary)';
                        e.currentTarget.style.transform = 'translateY(0)';
                    }}
                >
                    <svg
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 4.5v15m7.5-7.5h-15"
                        />
                    </svg>
                    New Project
                </button>
            </div>

            {/* Empty State - Scandinavian minimal */}
            <div
                className="rounded-2xl p-8"
                style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    boxShadow: 'var(--shadow-sm)',
                }}
            >
                <div className="flex flex-col items-center justify-center py-16">
                    {/* Illustration */}
                    <div
                        className="rounded-2xl p-6 mb-6"
                        style={{ background: 'var(--bg-muted)' }}
                    >
                        <svg
                            className="h-16 w-16"
                            style={{ color: 'var(--text-tertiary)' }}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1}
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z"
                            />
                        </svg>
                    </div>

                    <h3
                        className="text-lg font-medium font-outfit"
                        style={{ color: 'var(--text-primary)' }}
                    >
                        No projects yet
                    </h3>
                    <p
                        className="mt-2 text-sm text-center max-w-sm"
                        style={{ color: 'var(--text-secondary)' }}
                    >
                        Get started by creating your first construction project. You can add details, track progress, and manage your team.
                    </p>

                    <button
                        className="mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-medium transition-all duration-200 cursor-pointer"
                        style={{
                            background: 'var(--bg-muted)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-default)',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--bg-hover)';
                            e.currentTarget.style.borderColor = 'var(--border-strong)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'var(--bg-muted)';
                            e.currentTarget.style.borderColor = 'var(--border-default)';
                        }}
                    >
                        <svg
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.5}
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M12 4.5v15m7.5-7.5h-15"
                            />
                        </svg>
                        Create your first project
                    </button>
                </div>
            </div>
        </div>
    );
}
