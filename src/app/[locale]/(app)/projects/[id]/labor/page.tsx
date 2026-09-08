/**
 * Labor page — thin server component.
 *
 * The page itself is almost entirely client-driven (tabs, attendance,
 * summary, roster — see labor-page-client.tsx), but the roster tab's
 * initial date must be computed server-side and handed down as a plain
 * string: a client component's `useState(() => new Date())` initializer
 * runs during BOTH the server render pass and the browser hydration pass,
 * and those two clocks can disagree (container UTC vs. a browser in a
 * different timezone), producing a React #418 hydration mismatch right
 * around midnight. Computing it once here and passing it as a prop makes
 * the server-rendered HTML and the hydrated client agree by construction.
 */

import { LaborPageClient } from "./labor-page-client";

export default function LaborPage() {
  const initialDate = new Date().toISOString().slice(0, 10);
  return <LaborPageClient initialDate={initialDate} />;
}
