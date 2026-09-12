/**
 * Company domain types — multi-company profiles feature.
 * Sensitive fields (siret, tva_number, iban, bic) are returned either in full
 * or masked (e.g. "····5678") depending on the caller's role; the type always
 * accepts both forms as a plain string (or null when unset).
 */

export interface Company {
  id: string;
  legal_name: string;
  address: string;
  /** Full value for admins/owners; masked for other attached users. Null when unset. */
  siret: string | null;
  tva_number: string | null;
  iban: string | null;
  bic: string | null;
  /** Never sensitive — always the full URL or null. */
  logo_url: string | null;
  default_payment_terms: string | null;
  prefix_override: string | null;
  /**
   * Reusable 8-character code members type on the mobile app to join the company.
   * Present only for superadmins (stripped for everyone else); null when none is active.
   */
  join_code?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/**
 * Per-company role (roles-permissions-redesign: company is the tenant).
 * admin governs billing + member management + implicit rights on every
 * company project; manager/member are per-project assigned (see
 * `src/lib/auth/permissions.ts`).
 */
export type CompanyRole = "admin" | "manager" | "member";

/** Company as seen from the current user's attachment (includes relationship fields). */
export interface MyCompany extends Company {
  is_primary: boolean;
  attached_at: string;
  /** Caller's role in this company. Only "admin" may see/manage its billing. */
  role: CompanyRole;
}

/** User attached to a company (returned by GET /companies/<id>/attached-users). */
export interface AttachedUser {
  user_id: string;
  email: string;
  display_name: string | null;
  /** Phone-only sign-in rollout: null until the user sets one. */
  phone: string | null;
  is_primary: boolean;
  attached_at: string;
  /** Per-company role; only "admin" can see/manage the company's billing. */
  role: CompanyRole;
  /**
   * Companies this user is attached to, scoped to the ones the CALLER
   * administers (never a cross-tenant leak of a company the caller cannot
   * see). Optional — callers of the platform-ops attached-users list that
   * predate this field never set it; treat a missing value as `[]`.
   */
  companies?: { id: string; legal_name: string }[];
  /**
   * This company's projects the user is assigned to. Authoritative for every
   * attached account: the directory only carries assignments for people who
   * also hold a `company_persons` profile, which pre-directory accounts do
   * not. Optional — treat a missing value as `[]`.
   */
  assigned_project_ids?: string[];
}
