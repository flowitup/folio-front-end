// Labor management types

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
}

export interface UpdateAttendancePayload {
  amount_override?: number;
  note?: string;
}

export interface WorkerSummaryRow {
  worker_id: string;
  worker_name: string;
  days_worked: number;
  total_cost: number;
}

export interface LaborSummaryResponse {
  rows: WorkerSummaryRow[];
  total_days: number;
  total_cost: number;
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
