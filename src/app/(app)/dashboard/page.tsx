export default function DashboardPage() {
    return (
        <div>
            <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
            <p className="mt-2 text-gray-600">
                {/* TODO: Add dashboard widgets and metrics */}
                Welcome to the Construction Management Dashboard.
            </p>

            {/* TODO: Add dashboard content */}
            <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                    <h3 className="font-semibold text-gray-900">Active Projects</h3>
                    <p className="mt-2 text-3xl font-bold text-slate-900">--</p>
                    <p className="text-sm text-gray-500">TODO: Fetch from API</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                    <h3 className="font-semibold text-gray-900">Pending Tasks</h3>
                    <p className="mt-2 text-3xl font-bold text-slate-900">--</p>
                    <p className="text-sm text-gray-500">TODO: Fetch from API</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                    <h3 className="font-semibold text-gray-900">Team Members</h3>
                    <p className="mt-2 text-3xl font-bold text-slate-900">--</p>
                    <p className="text-sm text-gray-500">TODO: Fetch from API</p>
                </div>
            </div>
        </div>
    );
}
