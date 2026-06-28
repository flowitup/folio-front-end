export interface Project {
  id: string;
  name: string;
  address: string | null;
  owner_id: string;
  user_count: number;
  created_at: string;
  /** UUID of the company this project belongs to. Null/undefined if no company is linked. */
  company_id?: string | null;
  /** Custom invoice number prefix (e.g. "ARC" → ARC-2026-0001). Null = default "INV". */
  invoice_prefix?: string | null;
  /**
   * Caller's EFFECTIVE permissions on this project: global-role perms UNION the
   * caller's membership-role perms for this project. Gate per-project UI on this
   * (not just the global JWT permissions) so project admins/managers see the
   * right controls even when their global role is the read-only default.
   */
  my_permissions?: string[];
  /** Project budget amount in EUR. Null when no budget has been set. */
  budget?: number | null;
  /** Human-readable funding source (e.g. "Prêt bancaire BNP"). Null when not set. */
  budget_source?: string | null;
  /** Total money spent on this project (labor + materials; excludes released_funds). Always present, defaults to 0. */
  spent?: number;
}

export interface ProjectListResponse {
  projects: Project[];
  total: number;
}

export interface ProjectUser {
  id: string;
  email: string;
}

export interface ProjectUsersResponse {
  users: ProjectUser[];
  total: number;
}
