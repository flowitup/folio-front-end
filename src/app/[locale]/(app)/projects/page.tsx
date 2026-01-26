"use client";

import { useProject } from "@/context/ProjectContext";

export default function ProjectsPage() {
    const { projects, isLoading, error, selectedProjectId, selectProject } = useProject();

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

            {/* Loading State */}
            {isLoading && (
                <div
                    className="rounded-2xl p-8"
                    style={{
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-subtle)',
                        boxShadow: 'var(--shadow-sm)',
                    }}
                >
                    <div className="flex items-center justify-center py-16">
                        <div
                            className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
                            style={{ borderColor: 'var(--border-default)', borderTopColor: 'transparent' }}
                        />
                    </div>
                </div>
            )}

            {/* Error State */}
            {error && !isLoading && (
                <div
                    className="rounded-2xl p-8"
                    style={{
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--status-error)',
                        boxShadow: 'var(--shadow-sm)',
                    }}
                >
                    <div className="flex flex-col items-center justify-center py-8">
                        <p style={{ color: 'var(--status-error)' }}>{error}</p>
                    </div>
                </div>
            )}

            {/* Projects Grid */}
            {!isLoading && !error && projects.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projects.map((project) => (
                        <div
                            key={project.id}
                            onClick={() => selectProject(project.id)}
                            className="rounded-2xl p-6 cursor-pointer transition-all duration-200"
                            style={{
                                background: 'var(--bg-elevated)',
                                border: selectedProjectId === project.id
                                    ? '2px solid var(--accent-primary)'
                                    : '1px solid var(--border-subtle)',
                                boxShadow: 'var(--shadow-sm)',
                            }}
                            onMouseEnter={(e) => {
                                if (selectedProjectId !== project.id) {
                                    e.currentTarget.style.borderColor = 'var(--border-strong)';
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (selectedProjectId !== project.id) {
                                    e.currentTarget.style.borderColor = 'var(--border-subtle)';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                                }
                            }}
                        >
                            {/* Project Icon */}
                            <div
                                className="rounded-xl p-3 w-fit mb-4"
                                style={{ background: 'var(--bg-muted)' }}
                            >
                                <svg
                                    className="h-6 w-6"
                                    style={{ color: 'var(--accent-primary)' }}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={1.5}
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z"
                                    />
                                </svg>
                            </div>

                            {/* Project Name */}
                            <h3
                                className="text-lg font-medium font-outfit truncate"
                                style={{ color: 'var(--text-primary)' }}
                            >
                                {project.name}
                            </h3>

                            {/* Project Address */}
                            {project.address && (
                                <p
                                    className="mt-1 text-sm truncate"
                                    style={{ color: 'var(--text-secondary)' }}
                                >
                                    {project.address}
                                </p>
                            )}

                            {/* Project Meta */}
                            <div className="mt-4 flex items-center gap-4">
                                <div className="flex items-center gap-1.5">
                                    <svg
                                        className="h-4 w-4"
                                        style={{ color: 'var(--text-tertiary)' }}
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
                                    <span
                                        className="text-sm"
                                        style={{ color: 'var(--text-tertiary)' }}
                                    >
                                        {project.user_count} {project.user_count === 1 ? 'member' : 'members'}
                                    </span>
                                </div>
                            </div>

                            {/* Selected Badge */}
                            {selectedProjectId === project.id && (
                                <div
                                    className="mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
                                    style={{
                                        background: 'var(--accent-primary)',
                                        color: 'var(--text-inverse)',
                                    }}
                                >
                                    <svg
                                        className="h-3.5 w-3.5"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={2}
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M4.5 12.75l6 6 9-13.5"
                                        />
                                    </svg>
                                    Selected
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Empty State */}
            {!isLoading && !error && projects.length === 0 && (
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
            )}
        </div>
    );
}
