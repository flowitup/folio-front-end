"use client";

/**
 * AssignWorkerSelect — compact worker picker for the Payments tab's
 * unassigned/no-month invoice rows.
 *
 * Unlike LaborWorkerSelect (invoices/labor-worker-select.tsx), this takes an
 * already-loaded `workers` list (the labor page's own state) instead of
 * fetching its own — the Payments tab already holds the project's workers,
 * and this control renders once per unassigned row, so a per-row fetch would
 * be wasteful. Selecting a worker fires `onChange` immediately (there is no
 * "not linked" option here — picking IS the assign action).
 */

import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Worker } from "@/types/labor";

export interface AssignWorkerSelectProps {
  workers: Worker[];
  /** Currently linked worker id, or null/undefined when unassigned. */
  value?: string | null;
  onChange: (workerId: string) => void;
  disabled?: boolean;
}

export function AssignWorkerSelect({
  workers,
  value,
  onChange,
  disabled,
}: AssignWorkerSelectProps) {
  const t = useTranslations("labor.payments");

  const sorted = [...workers].sort((a, b) =>
    (a.person_name ?? a.name).localeCompare(b.person_name ?? b.name),
  );

  return (
    <Select value={value ?? undefined} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="h-8 w-[180px] text-xs" data-testid="assign-worker-select">
        <SelectValue placeholder={t("assignWorker")} />
      </SelectTrigger>
      <SelectContent>
        {sorted.map((w) => (
          <SelectItem key={w.id} value={w.id}>
            {w.person_name ?? w.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
