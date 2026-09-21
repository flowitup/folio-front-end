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
  user_id: string;
  user_name: string;
  intent: string;
  feature: string;
  outcome: string;
  refused_reason: string | null;
  cost_usd: number | null;
  trace_id: string | null;
}

export interface AssistantAuditListResult {
  items: AssistantAuditEntry[];
}

export interface ListAssistantAuditParams {
  companyId: string;
  /** Inclusive, `YYYY-MM-DD`. */
  from: string;
  /** Inclusive, `YYYY-MM-DD`. */
  to: string;
  userId?: string;
  /** Backend default/cap: 200. */
  limit?: number;
}
