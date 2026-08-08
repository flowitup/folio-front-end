"use client";

/**
 * LaborInvoicesByWorker — worker-grouped accordion for labor expenses, shared
 * by the Expenses page's `labor` tab and the `all` tab's labor type group
 * (user-locked decision: one component, two call sites — see phase-09 spec).
 *
 * Grouping is entirely client-side over whatever `invoices` the caller
 * already fetched (so tag filters compose for free — group totals reflect
 * the filtered rows). Rendered once per responsive breakpoint via `variant`,
 * matching this codebase's dual-render convention (page.tsx mounts both a
 * mobile list and a desktop table; CSS, not JS, decides which is visible) —
 * testids are suffixed accordingly so tests can scope queries.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { updateInvoice } from "@/lib/api/invoice-api";
import { fetchWorkers } from "@/lib/api/labor";
import { groupLaborInvoicesByWorker } from "@/lib/invoices/group-labor-invoices-by-worker";
import { LaborWorkerGroupRow } from "@/components/invoices/labor-worker-group-row";
import type { Invoice } from "@/types/invoice";
import type { Worker } from "@/types/labor";

export interface LaborInvoicesByWorkerProps {
  invoices: Invoice[];
  projectId: string;
  variant: "desktop" | "mobile";
  canManage: boolean;
  companyName: string | null;
  selectedInvoiceId: string | null;
  onToggleInvoice: (id: string) => void;
  onCloseInvoice: () => void;
  /** Called after a successful quick-assign or an edit/delete inside the inline detail, so the parent list refetches. */
  onMutated: () => void;
}

export function LaborInvoicesByWorker({
  invoices,
  projectId,
  variant,
  canManage,
  companyName,
  selectedInvoiceId,
  onToggleInvoice,
  onCloseInvoice,
  onMutated,
}: LaborInvoicesByWorkerProps) {
  const tPayments = useTranslations("labor.payments");
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string | null>>(new Set());

  const groups = useMemo(() => groupLaborInvoicesByWorker(invoices), [invoices]);
  const hasUnassigned = groups.some((g) => g.workerId === null);

  // The worker list is only needed for the Unassigned group's quick-assign
  // picker — skip the fetch entirely when there's nothing to assign, or the
  // caller can't manage invoices anyway.
  useEffect(() => {
    if (!canManage || !hasUnassigned) {
      setWorkers([]);
      return;
    }
    let cancelled = false;
    fetchWorkers(projectId)
      .then((list) => {
        if (!cancelled) setWorkers(list);
      })
      .catch(() => {
        if (!cancelled) setWorkers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, canManage, hasUnassigned]);

  // A single group is the whole labor ledger (typically a legacy project where
  // every invoice is Unassigned) — collapsed-by-default would hide every labor
  // invoice behind one row. Expand it once; the ref keeps a user's later
  // collapse from being fought by re-renders.
  const didAutoExpandRef = useRef(false);
  useEffect(() => {
    if (didAutoExpandRef.current || groups.length !== 1) return;
    didAutoExpandRef.current = true;
    setExpandedGroups((prev) => (prev.size > 0 ? prev : new Set([groups[0].workerId])));
  }, [groups]);

  // Deep-link support: auto-expand whichever group holds the ?invoice=<id> row
  // so the inline detail from a shared link is actually reachable.
  useEffect(() => {
    if (!selectedInvoiceId) return;
    const owner = groups.find((g) => g.invoices.some((inv) => inv.id === selectedInvoiceId));
    if (owner && !expandedGroups.has(owner.workerId)) {
      setExpandedGroups((prev) => new Set(prev).add(owner.workerId));
    }
    // Only re-run when the selection or the grouped data changes; expandedGroups
    // is read, not depended on, to avoid re-collapsing user-toggled groups.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInvoiceId, groups]);

  const toggleGroup = (workerId: string | null) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(workerId)) next.delete(workerId);
      else next.add(workerId);
      return next;
    });
  };

  const handleAssignWorker = async (invoiceId: string, workerId: string) => {
    try {
      await updateInvoice(projectId, invoiceId, { worker_id: workerId });
      toast.success(tPayments("assignedToast"));
      onMutated();
    } catch {
      toast.error(tPayments("assignFailed"));
    }
  };

  if (groups.length === 0) return null;

  return (
    <div className="divide-y" style={{ borderColor: "var(--line)" }} data-testid={`labor-by-worker-${variant}`}>
      {groups.map((group) => (
        <LaborWorkerGroupRow
          key={group.workerId ?? "unassigned"}
          group={group}
          unassignedLabel={tPayments("unassignedTitle")}
          variant={variant}
          expanded={expandedGroups.has(group.workerId)}
          onToggle={() => toggleGroup(group.workerId)}
          projectId={projectId}
          canManage={canManage}
          workers={workers}
          companyName={companyName}
          selectedInvoiceId={selectedInvoiceId}
          onToggleInvoice={onToggleInvoice}
          onCloseInvoice={onCloseInvoice}
          onMutated={onMutated}
          onAssignWorker={handleAssignWorker}
        />
      ))}
    </div>
  );
}
