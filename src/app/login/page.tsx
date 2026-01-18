import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { LoginForm } from "@/components/auth/LoginForm";

interface LoginPageProps {
  searchParams: Promise<{ callbackUrl?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  // Redirect if already authenticated
  const session = await getSession();
  if (session) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const callbackUrl = params.callbackUrl || "/dashboard";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Construction Management
          </h1>
          <h2 className="mt-2 text-lg text-gray-600">Sign in to your account</h2>
        </div>

        {/* Login Form */}
        <LoginForm callbackUrl={callbackUrl} />

        {/* Footer */}
        <p className="mt-4 text-center text-sm text-gray-500">
          Contact your administrator if you need access.
        </p>
      </div>
    </div>
  );
}
