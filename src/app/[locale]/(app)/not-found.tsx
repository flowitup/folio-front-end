import { NotFoundView } from "@/components/layout/not-found-view";

// Renders inside the app shell (sidebar, topbar) when a page calls notFound().
export default function AppNotFound() {
  return <NotFoundView />;
}
