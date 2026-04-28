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
}

export interface WorkerListResponse {
  workers: Worker[];
  total: number;
}

export interface CreateWorkerPayload {
  name: string;
  daily_rate: number;
  phone?: string;
}

export interface UpdateWorkerPayload {
  name?: string;
  daily_rate?: number;
  phone?: string;
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
