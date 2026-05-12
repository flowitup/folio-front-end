// Person identity types — global identity entity for the labor module.
// A single Person can have Worker rows in projects belonging to different
// companies (multi-company support). See plan 260512-2341-labor-calendar-
// and-bulk-log → phase-01.

export interface Person {
  id: string;
  name: string;
  phone: string | null;
  normalized_name: string;
  created_by_user_id: string;
  created_at: string;
}

export interface PersonSummary {
  id: string;
  name: string;
  phone: string | null;
}

export interface PersonListResponse {
  persons: PersonSummary[];
  total: number;
}

export interface CreatePersonPayload {
  name: string;
  phone?: string;
}

export interface MergePersonsPayload {
  target_person_id: string;
}

export interface MergePersonsResponse {
  target_person_id: string;
  workers_reassigned: number;
}

export interface PersonSearchParams {
  q?: string;
  limit?: number;
}
