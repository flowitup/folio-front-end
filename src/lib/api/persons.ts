// Persons API client.
//
// Wraps the /api/v1/persons surface introduced in plan 260512-2341-labor-
// calendar-and-bulk-log → phase-01 (cook 1b-ii + 1c). All calls require a
// valid auth token (handled by `api` helper).

import type {
  CreatePersonPayload,
  MergePersonsPayload,
  MergePersonsResponse,
  Person,
  PersonListResponse,
  PersonSearchParams,
  PersonSummary,
} from "@/types/person";
import { api } from "@/lib/api/http";

// Build a URLSearchParams string, dropping undefined/null/empty values.
function buildQuery(params?: Record<string, string | number | undefined>): string {
  if (!params) return "";
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/**
 * Typeahead search. Empty `q` returns the first `limit` persons alphabetically.
 * Server caps limit at 100; default 20.
 */
export async function fetchPersons(
  params?: PersonSearchParams,
): Promise<PersonSummary[]> {
  const qs = buildQuery({ q: params?.q, limit: params?.limit });
  const data = await api.get<PersonListResponse>(`/persons${qs}`);
  return data.persons;
}

export async function createPerson(payload: CreatePersonPayload): Promise<Person> {
  return api.post<Person>("/persons", payload);
}

export async function mergePersons(
  sourcePersonId: string,
  payload: MergePersonsPayload,
): Promise<MergePersonsResponse> {
  return api.post<MergePersonsResponse>(
    `/persons/${sourcePersonId}/merge`,
    payload,
  );
}
