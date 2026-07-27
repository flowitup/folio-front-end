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
  /**
   * Total credit available for this project, in EUR. Null when none has been set.
   * Displayed as "Credit total"; the API field keeps the older `budget` name.
   */
  budget?: number | null;
  /** Human-readable funding source (e.g. "Prêt bancaire BNP"). Null when not set. */
  budget_source?: string | null;
  /** Total money spent on this project (labor + materials; excludes released_funds). Always present, defaults to 0. */
  spent?: number;
  /**
   * Portion of `spent` paid with company money — the credit line. Always present, defaults to 0.
   */
  spent_by_credits?: number;
  /** Portion paid out of pocket. credits + personal + labor_unpaid === spent. */
  spent_personal?: number;
  /** Labor accrued from attendance entries. */
  labor_accrued?: number;
  /** Labor settled by labor-type invoices. */
  labor_paid?: number;
  /** Accrued but unsettled labor — owed to workers, not spent by anyone yet. */
  labor_unpaid?: number;
  /** Personal spend per invoice type; values sum to spent_personal. */
  personal_by_type?: Record<string, number>;
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
