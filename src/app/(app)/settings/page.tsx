export default function SettingsPage() {
    return (
        <div>
            <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
            <p className="mt-2 text-gray-600">
                {/* TODO: Add settings UI */}
                Configure your application settings here.
            </p>

            {/* TODO: Add settings sections */}
            <div className="mt-6 space-y-6">
                <div className="rounded-lg border border-gray-200 bg-white p-6">
                    <h3 className="font-semibold text-gray-900">Profile Settings</h3>
                    <p className="mt-2 text-gray-500">
                        TODO: Implement user profile settings form.
                    </p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-6">
                    <h3 className="font-semibold text-gray-900">Notification Preferences</h3>
                    <p className="mt-2 text-gray-500">
                        TODO: Implement notification preferences.
                    </p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-6">
                    <h3 className="font-semibold text-gray-900">Organization Settings</h3>
                    <p className="mt-2 text-gray-500">
                        TODO: Implement organization-level settings.
                    </p>
                </div>
            </div>
        </div>
    );
}
