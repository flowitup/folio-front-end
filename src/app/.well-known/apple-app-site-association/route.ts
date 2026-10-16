import { appleAppSiteAssociation } from "@/lib/config/app-links";

// Read per request: the team id is a deployment setting, not a build-time one.
export const dynamic = "force-dynamic";

/** iOS universal links: served as JSON without an extension, as Apple requires. */
export function GET() {
  return Response.json(appleAppSiteAssociation());
}
