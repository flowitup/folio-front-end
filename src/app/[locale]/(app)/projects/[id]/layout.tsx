/**
 * Project section layout — one access gate for every /projects/<id>/... page.
 *
 * A project the caller cannot open (another company's, or one they are not on)
 * or that does not exist is refused by the API with 403/404. Every tab then
 * shows the same localized "not found" page inside the app shell, instead of
 * each page improvising: an empty notebook with a quick-add, an empty board
 * with "+" buttons, a full new-expense form, or a silent bounce to the list.
 * Any other failure (expired session, outage) is left to the page itself.
 */

import { notFound } from "next/navigation";
import { ApiError } from "@/lib/api/http";
import { getProjectById } from "@/lib/api/projects-server";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const noAccess = await getProjectById(id).then(
    () => false,
    (err: unknown) => err instanceof ApiError && (err.status === 403 || err.status === 404),
  );
  if (noAccess) notFound();

  return <>{children}</>;
}
