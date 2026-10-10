import { notFound } from "next/navigation";

// An unknown path under a locale ("/fr/nonexistent") matches no route, so it
// would get Next's built-in English 404. Catching it here sends it to the
// localized src/app/[locale]/not-found.tsx instead; real routes still win.
export default function CatchAllNotFound() {
  notFound();
}
