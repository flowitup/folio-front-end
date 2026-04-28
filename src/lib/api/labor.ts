// Labor API client functions

import type {
  Worker,
  WorkerListResponse,
  CreateWorkerPayload,
  UpdateWorkerPayload,
  LaborEntry,
  LaborEntryListResponse,
  LogAttendancePayload,
  UpdateAttendancePayload,
  LaborSummaryResponse,
  LaborEntryParams,
  SummaryParams,
} from "@/types/labor";
import { api } from "@/lib/api/http";

// Build URL with optional query params
function buildUrl(basePath: string, params?: Record<string, string | undefined>): string {
  if (!params) return basePath;
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) searchParams.set(key, value);
  });
  const query = searchParams.toString();
  return query ? `${basePath}?${query}` : basePath;
}

// Worker API
export async function fetchWorkers(projectId: string): Promise<Worker[]> {
  const data = await api.get<WorkerListResponse>(`/projects/${projectId}/workers`);
  return data.workers;
}

export async function createWorker(projectId: string, payload: CreateWorkerPayload): Promise<Worker> {
  return api.post<Worker>(`/projects/${projectId}/workers`, payload);
}

export async function updateWorker(projectId: string, workerId: string, payload: UpdateWorkerPayload): Promise<Worker> {
  return api.put<Worker>(`/projects/${projectId}/workers/${workerId}`, payload);
}

export async function deleteWorker(projectId: string, workerId: string): Promise<void> {
  await api.delete(`/projects/${projectId}/workers/${workerId}`);
}

// Labor Entry API
export async function fetchLaborEntries(projectId: string, params?: LaborEntryParams): Promise<LaborEntry[]> {
  const url = buildUrl(`/projects/${projectId}/labor-entries`, {
    from: params?.from,
    to: params?.to,
    worker_id: params?.worker_id,
  });
  const data = await api.get<LaborEntryListResponse>(url);
  return data.entries;
}

export async function logAttendance(projectId: string, payload: LogAttendancePayload): Promise<LaborEntry> {
  const hours = payload.supplement_hours ?? 0;
  if (!Number.isInteger(hours) || hours < 0 || hours > 12) {
    throw new Error('supplement_hours must be an integer in [0, 12]');
  }
  if ((payload.shift_type == null) && hours === 0) {
    throw new Error('Either shift_type or supplement_hours must be set');
  }
  if ((payload.shift_type == null) && payload.amount_override != null) {
    throw new Error('amount_override requires a shift_type');
  }
  return api.post<LaborEntry>(`/projects/${projectId}/labor-entries`, payload);
}

export async function updateAttendance(projectId: string, entryId: string, payload: UpdateAttendancePayload): Promise<LaborEntry> {
  const hours = payload.supplement_hours;
  if (hours !== undefined && (!Number.isInteger(hours) || hours < 0 || hours > 12)) {
    throw new Error('supplement_hours must be an integer in [0, 12]');
  }
  return api.put<LaborEntry>(`/projects/${projectId}/labor-entries/${entryId}`, payload);
}

export async function deleteAttendance(projectId: string, entryId: string): Promise<void> {
  await api.delete(`/projects/${projectId}/labor-entries/${entryId}`);
}

// Summary API
export async function fetchLaborSummary(projectId: string, params?: SummaryParams): Promise<LaborSummaryResponse> {
  const url = buildUrl(`/projects/${projectId}/labor-summary`, {
    from: params?.from,
    to: params?.to,
  });
  return api.get<LaborSummaryResponse>(url);
}

// EUR formatter for French locale
export function formatEUR(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}
