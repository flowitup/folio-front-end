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
  BulkLogPayload,
  BulkLogResponse,
  ConflictsResponse,
  LaborSummaryResponse,
  LaborMonthlySummaryResponse,
  LaborEntryParams,
  SummaryParams,
  LaborExportFormat,
  LaborExportRange,
} from "@/types/labor";
import { api, ApiError } from "@/lib/api/http";
import { env } from "@/lib/config/env";
import { parseFilenameFromContentDisposition } from "@/lib/api/_helpers/content-disposition";

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

/**
 * Bulk-log attendance for N workers on a single date (Phase 3).
 *
 * Atomic on the server: all entries persisted in one transaction.
 * Workers already logged on `date` for this project are silently
 * skipped and reported back via `skipped_worker_ids`. The caller is
 * responsible for showing a toast summarising created + skipped counts.
 */
export async function bulkLogAttendance(
  projectId: string,
  payload: BulkLogPayload,
): Promise<BulkLogResponse> {
  return api.post<BulkLogResponse>(
    `/projects/${projectId}/labor-entries/bulk`,
    payload,
  );
}

/**
 * Fetch cross-project conflicts for a date (Phase 4).
 *
 * Returns conflict groups (one per Person) describing other-project
 * entries the same Person is logged against on the requested date.
 * Pass `personIds` to narrow the scan; otherwise the server checks
 * every active worker on the target project.
 */
export async function fetchCrossProjectConflicts(
  projectId: string,
  date: string,
  personIds?: string[],
): Promise<ConflictsResponse> {
  const params: Record<string, string> = { date };
  if (personIds && personIds.length > 0) {
    params.person_ids = personIds.join(",");
  }
  const url = buildUrl(
    `/projects/${projectId}/labor-entries/conflicts`,
    params,
  );
  return api.get<ConflictsResponse>(url);
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

/**
 * Per-month rollup of labor totals across the whole project.
 *
 * Used by the Summary tab when no specific month filter is active —
 * displays one row per (year, month) ordered most-recent first.
 */
export async function fetchLaborMonthlySummary(
  projectId: string,
): Promise<LaborMonthlySummaryResponse> {
  return api.get<LaborMonthlySummaryResponse>(
    `/projects/${projectId}/labor-monthly-summary`,
  );
}

// EUR formatter for French locale
export function formatEUR(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

// ─── Export ───────────────────────────────────────────────────────────────────

const YEAR_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const VALID_FORMATS: readonly LaborExportFormat[] = ['xlsx', 'pdf'];

function assertValidExportArgs(range: LaborExportRange, format: LaborExportFormat): void {
  if (!YEAR_MONTH_RE.test(range.from)) {
    throw new Error("Invalid 'from' month format (expected YYYY-MM)");
  }
  if (!YEAR_MONTH_RE.test(range.to)) {
    throw new Error("Invalid 'to' month format (expected YYYY-MM)");
  }
  if (range.from > range.to) {
    throw new Error("'from' must be <= 'to'");
  }
  const [fy, fm] = range.from.split('-').map(Number);
  const [ty, tm] = range.to.split('-').map(Number);
  const span = (ty - fy) * 12 + (tm - fm) + 1;
  if (span > 24) {
    throw new Error('Range must be <= 24 months');
  }
  if (!VALID_FORMATS.includes(format)) {
    throw new Error(`Invalid format '${format}' — must be xlsx or pdf`);
  }
}


async function fetchExportFile(
  url: string,
  range: LaborExportRange,
  format: LaborExportFormat,
): Promise<{ blob: Blob; filename: string }> {
  assertValidExportArgs(range, format);
  const response = await fetch(url, {
    credentials: 'include',
  });

  if (!response.ok) {
    let body: unknown;
    try { body = await response.json(); } catch { body = await response.text().catch(() => response.statusText); }
    throw new ApiError(`Export failed: ${response.status}`, response.status, body);
  }

  const cd = response.headers.get('Content-Disposition');
  const filename = parseFilenameFromContentDisposition(
    cd,
    `labor-export-${range.from}-to-${range.to}.${format}`,
  );

  const blob = await response.blob();
  return { blob, filename };
}

export async function fetchLaborExport(
  projectId: string,
  range: LaborExportRange,
  format: LaborExportFormat,
): Promise<{ blob: Blob; filename: string }> {
  const url =
    `${env.apiBaseUrl}/projects/${encodeURIComponent(projectId)}/labor-export` +
    `?from=${range.from}&to=${range.to}&format=${format}`;
  return fetchExportFile(url, range, format);
}

export async function fetchWorkerLaborExport(
  projectId: string,
  workerId: string,
  range: LaborExportRange,
  format: LaborExportFormat,
): Promise<{ blob: Blob; filename: string }> {
  const url =
    `${env.apiBaseUrl}/projects/${encodeURIComponent(projectId)}` +
    `/workers/${encodeURIComponent(workerId)}/labor-export` +
    `?from=${range.from}&to=${range.to}&format=${format}`;
  return fetchExportFile(url, range, format);
}
