/**
 * Merges Settings › Company's two people sources into one row per person for
 * `CompanyMembersTable`.
 *
 * Attached-users rows (`GET .../attached-users`) carry role, identity, the
 * caller-scoped `companies` list and the assigned projects; directory rows
 * (`GET .../persons`) carry name, phone, pending state, and assignments for
 * the people who hold a directory profile. Assignments come from the attached
 * user first: an account with no directory profile has no entry there, and
 * sourcing them from the directory alone would show it as unassigned. They line up on
 * `linked_user_id` (directory) === `user_id` (attached).
 *
 * A directory row with no attached-user counterpart is either a genuine
 * pending profile (no account yet) or — defensively — a stale/orphaned link;
 * either way this table cannot edit their role, company or projects, so it
 * renders as `pending`. An attached user missing a directory profile (legacy
 * accounts predating the directory) still gets a row, built from their own
 * fields alone.
 */

import type { AttachedUser, CompanyRole } from "@/types/companies";
import type { CompanyDirectoryEntry } from "@/lib/api/companies-members";

export interface MemberRow {
  /** React key — unique across both sources. */
  key: string;
  /** Null for a pending row (no user account exists yet). */
  userId: string | null;
  /** Present exactly when userId is present — backs the D8 grants editor. */
  attachedUser: AttachedUser | null;
  name: string;
  phone: string | null;
  /** Null for a pending row — there is no company role to show or edit. */
  role: CompanyRole | null;
  /** Companies (among the ones the caller administers) this person belongs to. */
  companies: { id: string; legal_name: string }[];
  assignedProjectIds: string[];
  /** True when there is no attached-user record to back Role/Company/Projects edits. */
  pending: boolean;
}

export function mergeMemberRows(
  attachedUsers: AttachedUser[],
  directory: CompanyDirectoryEntry[]
): MemberRow[] {
  const directoryByUserId = new Map<string, CompanyDirectoryEntry>();
  for (const entry of directory) {
    if (entry.linked_user_id) directoryByUserId.set(entry.linked_user_id, entry);
  }

  const consumedPersonIds = new Set<string>();
  const attachedRows: MemberRow[] = attachedUsers.map((u) => {
    const entry = directoryByUserId.get(u.user_id);
    if (entry) consumedPersonIds.add(entry.person_id);
    return {
      key: u.user_id,
      userId: u.user_id,
      attachedUser: u,
      name: entry?.name ?? u.display_name ?? u.phone ?? u.email,
      phone: entry?.phone ?? u.phone,
      role: u.role,
      companies: u.companies ?? [],
      assignedProjectIds: u.assigned_project_ids ?? entry?.assigned_project_ids ?? [],
      pending: false,
    };
  });

  // Anyone left in the directory has no attached-user counterpart in THIS
  // company — either a real pending profile (no account) or an edge case
  // (e.g. a stale link left over from a boot). Either way Role/Company/
  // Projects can't be edited without an attached-user record, so every
  // leftover row renders as pending rather than silently disappearing.
  const pendingRows: MemberRow[] = directory
    .filter((entry) => !consumedPersonIds.has(entry.person_id))
    .map((entry) => ({
      key: `person:${entry.person_id}`,
      userId: null,
      attachedUser: null,
      name: entry.name,
      phone: entry.phone,
      role: null,
      companies: [],
      assignedProjectIds: entry.assigned_project_ids,
      pending: true,
    }));

  return [...attachedRows, ...pendingRows];
}
