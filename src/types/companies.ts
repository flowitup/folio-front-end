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
  created_by: string;
  created_at: string;
  updated_at: string;
}

/** Company as seen from the current user's attachment (includes relationship fields). */
export interface MyCompany extends Company {
  is_primary: boolean;
  attached_at: string;
}

/**
 * Response from POST /companies/<id>/invite-tokens.
 * The plaintext `token` is exposed ONLY at generation time — surface it once
 * via a dialog and do NOT log or store it.
 */
export interface CompanyInviteTokenGenerated {
  token: string;
  token_id: string;
  expires_at: string;
}

/** User attached to a company (returned by GET /companies/<id>/attached-users). */
export interface AttachedUser {
  user_id: string;
  email: string;
  display_name: string | null;
  is_primary: boolean;
  attached_at: string;
}
