import { assetLinks } from "@/lib/config/app-links";

export const dynamic = "force-dynamic";

/** Android App Links verification. */
export function GET() {
  return Response.json(assetLinks());
}
