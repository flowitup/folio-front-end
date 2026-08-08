"use client";

/**
 * LaborWorkerSelect — worker picker for labor-type invoices.
 *
 * Replaces the free-text recipient field when InvoiceForm's type is
 * "labor". Mirrors the return→M&S link selector's client-fetch pattern in
 * invoice-form.tsx: loads the project's workers on mount, cancels stale
 * requests on unmount/projectId change, and falls back to an empty list on
 * error. Active workers sort first; the empty option always reads
 * "Not linked" so legacy labor invoices without a worker — and new ones the
 * user hasn't linked yet — stay saveable.
 */

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { fetchWorkers } from "@/lib/api/labor";
import type { Worker } from "@/types/labor";

export interface LaborWorkerSelectProps {
  /** Project whose workers populate the picker. Omitted = no options load. */
  projectId?: string;
  /** Selected worker UUID, or null when unlinked ("Not linked"). */
  value: string | null;
  /**
   * Called with the new worker id (null = unlinked) and the matching Worker
   * record when available, so callers can sync a display-name snapshot
   * without holding their own copy of the fetched list.
   */
  onChange: (workerId: string | null, worker: Worker | null) => void;
  disabled?: boolean;
}

export function LaborWorkerSelect({ projectId, value, onChange, disabled }: LaborWorkerSelectProps) {
  const t = useTranslations("invoices");
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(false);

  // Load workers when projectId is available. Using an async IIFE so all
  // setState calls are inside async callbacks, satisfying the
  // react-hooks/set-state-in-effect rule (same pattern as the M&S link
  // selector's load effect above).
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!projectId) {
        if (!cancelled) {
          setWorkers([]);
          setLoading(false);
        }
        return;
      }
      if (!cancelled) setLoading(true);
      try {
        const list = await fetchWorkers(projectId);
        if (!cancelled) setWorkers(list);
      } catch {
        if (!cancelled) setWorkers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Active workers first, then inactive — both alphabetized by display name.
  const sortedWorkers = [...workers].sort((a, b) => {
    if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
    return (a.person_name ?? a.name).localeCompare(b.person_name ?? b.name);
  });

  return (
    <select
      value={value ?? ""}
      onChange={(e) => {
        const id = e.target.value === "" ? null : e.target.value;
        const worker = id ? sortedWorkers.find((w) => w.id === id) ?? null : null;
        onChange(id, worker);
      }}
      className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      disabled={disabled || loading}
      data-testid="labor-worker-select"
    >
      <option value="">{t("workerNotLinked")}</option>
      {sortedWorkers.map((w) => (
        <option key={w.id} value={w.id}>
          {w.person_name ?? w.name}
        </option>
      ))}
    </select>
  );
}
