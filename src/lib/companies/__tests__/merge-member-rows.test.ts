import { describe, it, expect } from "vitest";
import { mergeMemberRows } from "../merge-member-rows";
import type { AttachedUser } from "@/types/companies";
import type { CompanyDirectoryEntry } from "@/lib/api/companies-members";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeAttachedUser(overrides: Partial<AttachedUser> = {}): AttachedUser {
  return {
    user_id: "user-1",
    email: "alice@example.com",
    display_name: "Alice",
    phone: "+33612345678",
    is_primary: true,
    attached_at: "2026-01-01T00:00:00Z",
    role: "admin",
    companies: [{ id: "co-1", legal_name: "Maison Lavandou" }],
    ...overrides,
  };
}

function makeDirectoryEntry(overrides: Partial<CompanyDirectoryEntry> = {}): CompanyDirectoryEntry {
  return {
    person_id: "person-1",
    name: "Alice Dupont",
    phone: "+33612345678",
    linked_user_id: "user-1",
    assigned_project_ids: ["proj-1"],
    is_active: true,
    pending: false,
    labor_role_id: null,
    default_daily_rate: null,
    ...overrides,
  };
}

describe("mergeMemberRows", () => {
  it("merges an attached user with its matching directory entry: directory wins name/phone, attached wins role/companies/projects", () => {
    const rows = mergeMemberRows([makeAttachedUser()], [makeDirectoryEntry()]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      key: "user-1",
      userId: "user-1",
      name: "Alice Dupont", // from directory, not attached-user display_name
      phone: "+33612345678",
      role: "admin", // from attached user
      companies: [{ id: "co-1", legal_name: "Maison Lavandou" }],
      assignedProjectIds: ["proj-1"],
      pending: false,
    });
    expect(rows[0].attachedUser).not.toBeNull();
  });

  it("gives a legacy attached user (no directory profile) a fallback row instead of dropping them", () => {
    const rows = mergeMemberRows(
      [
        makeAttachedUser({
          user_id: "user-2",
          display_name: null,
          phone: null,
          email: "bob@example.com",
          assigned_project_ids: ["proj-9"],
        }),
      ],
      []
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: "user-2",
      name: "bob@example.com", // display_name ?? phone ?? email fallback
      phone: null,
      // Sourced from the attached user: an account with no directory profile
      // has no entry there, and reading the directory alone would render
      // someone who IS assigned as having no projects.
      assignedProjectIds: ["proj-9"],
      pending: false, // they DO have an account — not the same as "pending"
    });
  });

  it("treats a directory entry with no linked_user_id as a pending row with no role/companies/projects editing", () => {
    const rows = mergeMemberRows(
      [],
      [makeDirectoryEntry({ linked_user_id: null, pending: true, name: "Chantier Nord", phone: "+33698765432" })]
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      key: "person:person-1",
      userId: null,
      attachedUser: null,
      name: "Chantier Nord",
      phone: "+33698765432",
      role: null,
      companies: [],
      pending: true,
    });
  });

  it("still surfaces a directory entry whose linked_user_id points at no current attachment (stale link), instead of silently dropping it", () => {
    const rows = mergeMemberRows(
      [], // nobody currently attached
      [makeDirectoryEntry({ linked_user_id: "ghost-user", pending: false })]
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].pending).toBe(true);
    expect(rows[0].userId).toBeNull();
  });

  it("defaults an attached user's companies to [] when the field is absent (older callers of the endpoint)", () => {
    const { companies: _drop, ...withoutCompanies } = makeAttachedUser();
    const rows = mergeMemberRows([withoutCompanies as AttachedUser], []);

    expect(rows[0].companies).toEqual([]);
  });

  it("orders attached rows before leftover directory (pending) rows", () => {
    const rows = mergeMemberRows(
      [makeAttachedUser({ user_id: "user-1" })],
      [
        makeDirectoryEntry({ person_id: "person-1", linked_user_id: "user-1" }),
        makeDirectoryEntry({ person_id: "person-2", linked_user_id: null, name: "Pending Person" }),
      ]
    );

    expect(rows.map((r) => r.key)).toEqual(["user-1", "person:person-2"]);
  });

  it("prefers the attached user's assignments over the directory's for the same person", () => {
    const rows = mergeMemberRows(
      [makeAttachedUser({ assigned_project_ids: ["proj-1", "proj-2"] })],
      [makeDirectoryEntry({ assigned_project_ids: ["proj-1"] })]
    );

    expect(rows[0].assignedProjectIds).toEqual(["proj-1", "proj-2"]);
  });

  it("falls back to the directory's assignments when the attached user has no such field", () => {
    const user = makeAttachedUser();
    delete (user as { assigned_project_ids?: string[] }).assigned_project_ids;

    const rows = mergeMemberRows([user], [makeDirectoryEntry({ assigned_project_ids: ["proj-7"] })]);

    expect(rows[0].assignedProjectIds).toEqual(["proj-7"]);
  });

  it("returns an empty list for two empty sources", () => {
    expect(mergeMemberRows([], [])).toEqual([]);
  });
});
