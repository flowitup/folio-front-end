export default function SettingsPage() {
    return (
        <div className="space-y-8">
            {/* Page Header */}
            <div>
                <h2
                    className="text-2xl font-semibold tracking-tight font-outfit"
                    style={{ color: 'var(--text-primary)' }}
                >
                    Settings
                </h2>
                <p
                    className="mt-2 text-base"
                    style={{ color: 'var(--text-secondary)' }}
                >
                    Configure your application settings here.
                </p>
            </div>

            {/* Settings Sections - Scandinavian minimal cards */}
            <div className="space-y-6">
                {/* Profile Settings */}
                <div
                    className="rounded-2xl overflow-hidden"
                    style={{
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-subtle)',
                        boxShadow: 'var(--shadow-sm)',
                    }}
                >
                    <div
                        className="px-6 py-5"
                        style={{ borderBottom: '1px solid var(--border-subtle)' }}
                    >
                        <div className="flex items-center gap-3">
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
                                        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                                    />
                                </svg>
                            </div>
                            <div>
                                <h3
                                    className="font-medium font-outfit"
                                    style={{ color: 'var(--text-primary)' }}
                                >
                                    Profile Settings
                                </h3>
                                <p
                                    className="text-sm"
                                    style={{ color: 'var(--text-secondary)' }}
                                >
                                    Manage your personal information
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="px-6 py-8">
                        <div
                            className="flex items-center justify-center py-8 rounded-xl"
                            style={{ background: 'var(--bg-muted)' }}
                        >
                            <p
                                className="text-sm"
                                style={{ color: 'var(--text-tertiary)' }}
                            >
                                Profile settings will be available soon
                            </p>
                        </div>
                    </div>
                </div>

                {/* Notification Preferences */}
                <div
                    className="rounded-2xl overflow-hidden"
                    style={{
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-subtle)',
                        boxShadow: 'var(--shadow-sm)',
                    }}
                >
                    <div
                        className="px-6 py-5"
                        style={{ borderBottom: '1px solid var(--border-subtle)' }}
                    >
                        <div className="flex items-center gap-3">
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
                                        d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                                    />
                                </svg>
                            </div>
                            <div>
                                <h3
                                    className="font-medium font-outfit"
                                    style={{ color: 'var(--text-primary)' }}
                                >
                                    Notification Preferences
                                </h3>
                                <p
                                    className="text-sm"
                                    style={{ color: 'var(--text-secondary)' }}
                                >
                                    Control how you receive notifications
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="px-6 py-8">
                        <div
                            className="flex items-center justify-center py-8 rounded-xl"
                            style={{ background: 'var(--bg-muted)' }}
                        >
                            <p
                                className="text-sm"
                                style={{ color: 'var(--text-tertiary)' }}
                            >
                                Notification preferences will be available soon
                            </p>
                        </div>
                    </div>
                </div>

                {/* Organization Settings */}
                <div
                    className="rounded-2xl overflow-hidden"
                    style={{
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-subtle)',
                        boxShadow: 'var(--shadow-sm)',
                    }}
                >
                    <div
                        className="px-6 py-5"
                        style={{ borderBottom: '1px solid var(--border-subtle)' }}
                    >
                        <div className="flex items-center gap-3">
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
                                        d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"
                                    />
                                </svg>
                            </div>
                            <div>
                                <h3
                                    className="font-medium font-outfit"
                                    style={{ color: 'var(--text-primary)' }}
                                >
                                    Organization Settings
                                </h3>
                                <p
                                    className="text-sm"
                                    style={{ color: 'var(--text-secondary)' }}
                                >
                                    Manage organization-level settings
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="px-6 py-8">
                        <div
                            className="flex items-center justify-center py-8 rounded-xl"
                            style={{ background: 'var(--bg-muted)' }}
                        >
                            <p
                                className="text-sm"
                                style={{ color: 'var(--text-tertiary)' }}
                            >
                                Organization settings will be available soon
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
