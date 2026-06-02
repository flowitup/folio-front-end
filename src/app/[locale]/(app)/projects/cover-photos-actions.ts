"use server";

import { listProjectPhotos } from "@/lib/api/project-photos";
import type { ProjectPhoto } from "@/lib/api/project-photos";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type LatestPhotosResult =
  | { ok: true; photos: ProjectPhoto[] }
  | { ok: false };

/**
 * Return up to `count` most-recent photos for a project, used to render the
 * montage cover on project cards. The BE lists photos captured_at DESC, so
 * page 1 already yields the latest. Failures (no access, no photos, network)
 * resolve to ok:false so the card silently falls back to its gradient cover.
 */
export async function loadLatestProjectPhotosAction(
  projectId: string,
  count = 4,
): Promise<LatestPhotosResult> {
  if (!projectId || !UUID_RE.test(projectId)) {
    return { ok: false };
  }
  const perPage = Math.min(Math.max(count, 1), 4);
  try {
    const data = await listProjectPhotos(projectId, { page: 1, perPage });
    return { ok: true, photos: data.items };
  } catch {
    return { ok: false };
  }
}
