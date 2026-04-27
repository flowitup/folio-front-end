"use server";

import { revalidatePath } from "next/cache";
import { createInvitation, revokeInvitation } from "@/lib/api/invitations";
import type { CreateInvitationResult } from "@/lib/api/invitations";

/**
 * Server action: invite a member (or directly add existing user) to a project.
 * Returns discriminated result kind for client-side toast selection.
 * Re-throws errors with `status` property so client can map 409/429.
 */
export async function inviteMemberAction(
  projectId: string,
  email: string,
  roleId: string
): Promise<CreateInvitationResult> {
  const result = await createInvitation({ project_id: projectId, email, role_id: roleId });
  revalidatePath(`/[locale]/(app)/projects/${projectId}/members`, "page");
  return result;
}

/**
 * Server action: revoke a pending invitation.
 */
export async function revokeInviteAction(
  invitationId: string,
  projectId: string
): Promise<void> {
  await revokeInvitation(invitationId);
  revalidatePath(`/[locale]/(app)/projects/${projectId}/members`, "page");
}
