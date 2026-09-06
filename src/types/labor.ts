// Labor management types

export type ShiftType = 'full' | 'half' | 'overtime';

export interface Worker {
  id: string;
  project_id: string;
  name: string;
  phone: string | null;
  daily_rate: number;
  is_active: boolean;
  created_at: string;
  // Joined Person identity (cook 1d-ii-a). Optional during the Phase 1c
  // backfill rollout — older workers may not yet have a linked Person.
  // The legacy ``name`` and ``phone`` fields above remain populated for
  // back-compat; FE consumers should prefer person_name / person_phone
  // when present and fall back to the legacy fields otherwise.
  person_id?: string | null;
  person_name?: string | null;
  person_phone?: string | null;
  // Labor role assignment. role_color drives the avatar chip color when set;
  // falls back to the deterministic personColor hash otherwise.
  role_id?: string | null;
  role_name?: string | null;
  role_color?: string | null;
  // Rate in effect today: latest rate_change with effective_date <= today,
  // else the base daily_rate. Optional for back-compat with older API responses.
  current_daily_rate?: number;
}

export interface WorkerListResponse {
  workers: Worker[];
  total: number;
}

export interface CreateWorkerPayload {
  name: string;
  daily_rate: number;
  phone?: string;
  // When set, link the new Worker to an existing Person picked via the
  // PersonTypeahead (cook 1d-ii-b). Server skips inline Person creation
  // and uses this id instead. When omitted, the BE creates a Person
  // from name+phone (legacy behavior).
  person_id?: string;
  role_id?: string;
}

export interface UpdateWorkerPayload {
  name?: string;
  phone?: string;
  role_id?: string | null;
}

/** Worker-submitted rows stay `pending` (unpriced) until a manager validates them. */
export type AttendanceStatus = "pending" | "validated";

export interface LaborEntry {
  id: string;
  worker_id: string;
  worker_name: string;
  date: string;
  amount_override: number | null;
  effective_cost: number;
  note: string | null;
  shift_type: ShiftType | null;
  supplement_hours: number;
  created_at: string;
  role_color?: string | null;
  tag_id?: string | null;
  // Validation workflow — absent on older API responses means validated.
  status?: AttendanceStatus;
  submitted_by_user_id?: string | null;
  validated_by_user_id?: string | null;
  validated_at?: string | null;
}

/** True for a worker-submitted day a manager has not validated yet. */
export function isPendingEntry(entry: Pick<LaborEntry, "status">): boolean {
  return entry.status === "pending";
}

export interface LaborEntryListResponse {
  entries: LaborEntry[];
  total: number;
}

export interface LogAttendancePayload {
  worker_id: string;
  date: string;
  amount_override?: number;
  note?: string;
  shift_type?: ShiftType | null;
  supplement_hours?: number;
}

export interface UpdateAttendancePayload {
  /** null = clear the override (revert to the worker's daily rate).
   *  Omit the field to leave it unchanged. */
  amount_override?: number | null;
  /** null = clear the note. Omit to leave unchanged. */
  note?: string | null;
  shift_type?: ShiftType | null;
  supplement_hours?: number;
}

// ─── Bulk log (Phase 3) ──────────────────────────────────────────────────────

export interface BulkLogEntry {
  worker_id: string;
  shift_type: ShiftType | null;
  supplement_hours?: number;
  amount_override?: number;
  note?: string;
}

export interface BulkLogPayload {
  /** ISO YYYY-MM-DD */
  date: string;
  entries: BulkLogEntry[];
  /** Phase 4: when true, the user has seen the cross-project conflict
   * modal and chooses to proceed. The server still re-runs the check
   * inside the transaction; a stale-dialog race still surfaces 409. */
  acknowledge_conflicts?: boolean;
}

export interface BulkLogResponse {
  /** IDs of newly-created labor entries. */
  created: string[];
  /** Workers silently skipped because they already have an entry on `date`. */
  skipped_worker_ids: string[];
}

// ─── Phase 4: cross-project conflict warn ────────────────────────────────────

interface ConflictEntry {
  project_id: string;
  project_name: string;
  shift_type: ShiftType | null;
  supplement_hours: number;
}

/** Conflict group: one Person logged in N other projects on the date. */
export interface ConflictGroup {
  person_id: string;
  person_name: string;
  entries: ConflictEntry[];
}

export interface ConflictsResponse {
  conflicts: ConflictGroup[];
}

/** Server payload on 409 from bulk endpoint. */
export interface BulkConflictError {
  error: "Conflict";
  message: string;
  conflicts: ConflictGroup[];
}

interface WorkerSummaryRow {
  worker_id: string;
  worker_name: string;
  days_worked: number;
  total_cost: number;
  banked_hours: number;
  bonus_full_days: number;
  bonus_half_days: number;
  bonus_cost: number;
}

export interface LaborSummaryResponse {
  rows: WorkerSummaryRow[];
  total_days: number;
  total_cost: number;
  total_banked_hours: number;
  total_bonus_days: number;
  total_bonus_cost: number;
}

interface MonthlyWorkerSubRow {
  worker_id: string;
  worker_name: string;
  /** Priced shifts (supplement-only excluded) */
  days_worked: number;
  /** EUR */
  total_cost: number;
}

export interface MonthlySummaryRow {
  /** 4-digit calendar year (e.g. 2026) */
  year: number;
  /** 1-12 month-of-year */
  month: number;
  /** Priced shifts in this month (supplement-only rows excluded) */
  total_days: number;
  /** Total cost in EUR for this month */
  total_cost: number;
  /** Per-worker breakdown for this month, sorted ASC by name. */
  workers: MonthlyWorkerSubRow[];
}

export interface LaborMonthlySummaryResponse {
  /** Ordered most-recent first (year DESC, month DESC) */
  rows: MonthlySummaryRow[];
}

export interface LaborEntryParams {
  from?: string;
  to?: string;
  worker_id?: string;
}

export interface SummaryParams {
  from?: string;
  to?: string;
}

// ─── Export types ────────────────────────────────────────────────────────────

export type LaborExportFormat = 'xlsx' | 'pdf';

export interface LaborExportRange {
  /** YYYY-MM */
  from: string;
  /** YYYY-MM */
  to: string;
}

// ─── Labor activities (project-level daily log) ─────────────────────────────

export interface LaborActivity {
  id: string;
  project_id: string;
  /** ISO YYYY-MM-DD */
  date: string;
  title: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface LaborActivityListResponse {
  activities: LaborActivity[];
  total: number;
}

export interface CreateLaborActivityPayload {
  /** ISO YYYY-MM-DD */
  date: string;
  title: string;
}

export interface UpdateLaborActivityPayload {
  title?: string;
}

// ─── Labor day descriptions (one per project+date) ──────────────────────────

export interface LaborDayDescription {
  id: string;
  project_id: string;
  /** ISO YYYY-MM-DD */
  date: string;
  description: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface LaborDayDescriptionListResponse {
  day_descriptions: LaborDayDescription[];
}

// ─── Worker rate changes ─────────────────────────────────────────────────────

export interface WorkerRateChange {
  id: string;
  worker_id: string;
  /** ISO YYYY-MM-DD */
  effective_date: string;
  daily_rate: number;
  created_at: string;
}

export interface WorkerRateChangeListResponse {
  rate_changes: WorkerRateChange[];
}

export interface CreateRateChangePayload {
  /** ISO YYYY-MM-DD */
  effective_date: string;
  daily_rate: number;
}

// ─── Labor payments summary ──────────────────────────────────────────────────

/** Per-worker paid total within a single month bucket. */
export interface LaborPaymentsWorkerBucket {
  worker_id: string;
  worker_name: string;
  /** Sum of labor invoice totals for this worker within the bucket's month. */
  paid: number;
  /** Count of labor invoices contributing to `paid`. */
  invoice_count: number;
}

/**
 * One month's aggregate of recorded labor payments (invoices of type=labor).
 * `year`/`month` are both null for the special "no service_month" bucket,
 * which holds labor invoices that were never assigned a payment month.
 */
export interface LaborPaymentsMonthBucket {
  year: number | null;
  month: number | null;
  total_paid: number;
  workers: LaborPaymentsWorkerBucket[];
  /** Sum of this bucket's labor invoices that have no worker_id. */
  unassigned_paid: number;
  /** Count of this bucket's labor invoices that have no worker_id. */
  unassigned_count: number;
  /**
   * Flagged-method split of the bucket's paid total (company/personal
   * payment-method flags, worker-linked + unassigned alike). Invoices with
   * no method or an unflagged one count in neither figure, so
   * company_paid + personal_paid <= total_paid. Optional: a not-yet-redeployed
   * BE omits them (FE and BE deploys are not ordered) — treat missing as 0.
   */
  company_paid?: number;
  personal_paid?: number;
}

export interface LaborPaymentsSummaryResponse {
  /**
   * Sorted most-recent first (year DESC, month DESC). A bucket with
   * year=null and month=null (if present) holds labor invoices without a
   * service_month.
   */
  months: LaborPaymentsMonthBucket[];
}
