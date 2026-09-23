/**
 * Assistant supervision-log types — `GET /api/v1/assistant/audit` (company admins only).
 *
 * One row per mention the assistant handled (answered, refused, or errored) in a company's
 * chat channels. `outcome` is an open string on the wire (the backend catalogue may grow),
 * so the UI treats known values specially and falls back to the raw string for anything else.
 */

export interface AssistantAuditEntry {
  id: string;
  created_at: string;
  /** `company:<uuid>`, `project:<uuid>` or `admin:<company_uuid>`. */
  channel_key: string;
  /** `null` when the sender could not be resolved to a user (backend schema: `Optional`). */
  user_id: string | null;
  user_name: string;
  /** `null` when the assistant did not classify an intent (backend schema: `Optional`). */
  intent: string | null;
  /** `null` when the assistant did not resolve a feature (backend schema: `Optional`). */
  feature: string | null;
  /** `null` when the row predates the outcome column (backend schema: `Optional`). */
  outcome: string | null;
  refused_reason: string | null;
  cost_usd: number | null;
  trace_id: string | null;
}

export interface AssistantAuditListResult {
  items: AssistantAuditEntry[];
}

export interface ListAssistantAuditParams {
  companyId: string;
  /**
   * ISO 8601 datetime with a UTC offset (inclusive lower bound), not a date-only string —
   * the backend compares `created_at` against exact instants, so a Paris calendar date must
   * already be converted to its Paris-midnight instant before reaching this wrapper.
   */
  from: string;
  /** ISO 8601 datetime with a UTC offset (inclusive upper bound), same caveat as `from`. */
  to: string;
  userId?: string;
  /** Backend default/cap: 200. */
  limit?: number;
}
