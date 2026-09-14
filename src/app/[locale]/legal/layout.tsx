import type { ReactNode } from "react";

/**
 * Public legal pages (privacy policy, support). Linked from the App Store /
 * Play listings, so they must render without a session — see
 * PUBLIC_PATH_PREFIXES in src/lib/auth/middleware.ts.
 */
export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background text-foreground min-h-screen px-4 py-10">
      <article className="mx-auto max-w-2xl space-y-4 [&_h1]:font-display [&_h1]:text-3xl [&_h1]:font-semibold [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_a]:underline [&_ul]:list-disc [&_ul]:pl-6">
        {children}
      </article>
    </div>
  );
}
