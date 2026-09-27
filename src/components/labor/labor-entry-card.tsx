"use client";

/**
 * LaborEntryCard — single attendance row. Flat row layout (no wrapping
 * Card) so callers can group rows inside a shared container with divider
 * lines. Used by attendance-table.tsx (list view) and
 * attendance-day-detail-sheet.tsx (calendar day drawer).
 *
 * Plan: 260512-2341-labor-calendar-and-bulk-log → phase-02 (2a).
 */

import { Check, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatEUR } from "@/lib/api/labor";
import { changeRequestFromEntry, describeChangeRequest } from "@/lib/labor/change-requests";
import { personInitials, workerColor } from "@/lib/utils/person-color";
import {
  hasChangeRequest,
  isPendingEntry,
  type AttendanceChangeRequest,
  type LaborEntry,
  type ShiftType,
} from "@/types/labor";

/** Manager decisions on a worker's open change request (validated day). */
export interface ChangeRequestActions {
  onApprove: (request: AttendanceChangeRequest) => void;
  onRefuse: (request: AttendanceChangeRequest) => void;
  /** Entry ids with a decision in flight — their buttons are disabled. */
  busyIds: ReadonlySet<string>;
}

function EntryAvatar({
  initials,
  color,
}: {
  initials: string;
  color: string;
}) {
  return (
    <span
      className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-full text-[11px] font-semibold text-white"
      style={{ backgroundColor: color }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

interface LaborEntryCardProps {
  entry: LaborEntry;
  canManage: boolean;
  onDelete: (entry: LaborEntry) => void;
  /** Optional — tapping the row triggers edit. */
  onEdit?: (entry: LaborEntry) => void;
  /** Manager actions for a worker-submitted (pending) row. */
  onValidate?: (entry: LaborEntry) => void;
  onReject?: (entry: LaborEntry) => void;
  /** Manager actions for a worker's change request on a validated row. */
  changeRequestActions?: ChangeRequestActions;
}

export function LaborEntryCard({
  entry,
  canManage,
  onDelete,
  onEdit,
  onValidate,
  onReject,
  changeRequestActions,
}: LaborEntryCardProps) {
  const t = useTranslations("labor");
  const pending = isPendingEntry(entry);
  const changeRequest = hasChangeRequest(entry) ? changeRequestFromEntry(entry) : null;
  const changeBusy = changeRequestActions?.busyIds.has(entry.id) ?? false;

  const shiftLabel: Record<ShiftType, string> = {
    full: t("shiftFull"),
    half: t("shiftHalf"),
    overtime: t("shiftOvertime"),
  };

  const entryColor = workerColor({
    role_color: entry.role_color,
    id: entry.worker_id,
  });

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 transition",
        onEdit && "hover:bg-accent/40 cursor-pointer",
      )}
      onClick={onEdit ? () => onEdit(entry) : undefined}
      role={onEdit ? "button" : undefined}
      tabIndex={onEdit ? 0 : undefined}
      onKeyDown={
        onEdit
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onEdit(entry);
              }
            }
          : undefined
      }
    >
      {/* Avatar — colored initials matching calendar chips */}
      <EntryAvatar
        initials={personInitials(entry.worker_name)}
        color={entryColor}
      />

      {/* Name + badges */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium">{entry.worker_name}</span>

          {entry.shift_type !== null ? (
            <Badge variant="secondary" className="text-xs">
              {shiftLabel[entry.shift_type] ?? entry.shift_type}
            </Badge>
          ) : entry.supplement_hours > 0 ? (
            <span className="text-muted-foreground text-xs italic">
              {t("supplement.standaloneShiftLabel") || "(supplement only)"}
            </span>
          ) : null}

          {entry.supplement_hours > 0 && (
            <Badge
              variant="outline"
              className="text-xs"
              title={
                t("supplement.badgeTooltip") ||
                "Supplement hours (banked, not priced today)"
              }
            >
              +{entry.supplement_hours}h
            </Badge>
          )}

          {pending && (
            <Badge
              variant="outline"
              className="border-amber-500/60 bg-amber-500/10 text-xs text-amber-700 dark:text-amber-300"
              title={t("status.unpricedPending")}
              data-testid="entry-pending-badge"
            >
              {t("status.pending")}
            </Badge>
          )}

          {changeRequest && (
            <Badge
              variant="outline"
              className="border-amber-500/60 bg-amber-500/10 text-xs text-amber-700 dark:text-amber-300"
              title={t("changeRequest.badgeTooltip")}
              data-testid="entry-change-badge"
            >
              {t("changeRequest.badge")}
            </Badge>
          )}
        </div>

        {entry.note && (
          <p className="text-muted-foreground mt-0.5 truncate text-xs">
            {entry.note}
          </p>
        )}

        {changeRequest && (
          <p
            className="mt-0.5 truncate text-xs font-medium text-amber-700 dark:text-amber-300"
            data-testid="entry-change-proposed"
          >
            {t("changeRequest.proposedLine", {
              value: describeChangeRequest(t, changeRequest).proposed,
            })}
          </p>
        )}
      </div>

      {/* Amount + override marker — a pending day is unpriced until validated */}
      <div className="flex flex-none flex-col items-end">
        {pending ? (
          <span
            className="text-muted-foreground text-sm font-semibold tabular-nums"
            title={t("status.unpricedPending")}
          >
            —
          </span>
        ) : (
          <span className="text-primary text-sm font-semibold tabular-nums">
            {formatEUR(entry.effective_cost)}
          </span>
        )}
        {entry.amount_override !== null && (
          <span className="text-muted-foreground text-[10px] uppercase tracking-wide">
            {t("override")}
          </span>
        )}
      </div>

      {canManage && pending && (onValidate || onReject) ? (
        <div className="flex flex-none items-center">
          {onValidate && (
            <Button
              variant="ghost"
              size="icon"
              className="text-primary flex-none"
              onClick={(e) => {
                e.stopPropagation();
                onValidate(entry);
              }}
              aria-label={t("validate")}
              title={t("validate")}
            >
              <Check className="h-4 w-4" />
            </Button>
          )}
          {onReject && (
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive flex-none"
              onClick={(e) => {
                e.stopPropagation();
                onReject(entry);
              }}
              aria-label={t("reject")}
              title={t("reject")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      ) : canManage && changeRequest && changeRequestActions ? (
        <div className="flex flex-none items-center">
          <Button
            variant="ghost"
            size="icon"
            className="text-primary flex-none"
            disabled={changeBusy}
            onClick={(e) => {
              e.stopPropagation();
              changeRequestActions.onApprove(changeRequest);
            }}
            aria-label={t("changeRequest.apply")}
            title={t("changeRequest.apply")}
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive flex-none"
            disabled={changeBusy}
            onClick={(e) => {
              e.stopPropagation();
              changeRequestActions.onRefuse(changeRequest);
            }}
            aria-label={t("changeRequest.refuse")}
            title={t("changeRequest.refuse")}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : canManage ? (
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive flex-none"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(entry);
          }}
          aria-label={t("delete")}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
}
