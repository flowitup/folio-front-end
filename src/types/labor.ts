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
  daily_rate?: number;
  phone?: string;
  role_id?: string | null;
}

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
  amount_override?: number;
  note?: string;
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

export interface ConflictEntry {
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

export interface WorkerSummaryRow {
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

export interface MonthlyWorkerSubRow {
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
  description: string | null;
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
  description?: string;
}

export interface UpdateLaborActivityPayload {
  title?: string;
  description?: string;
}
