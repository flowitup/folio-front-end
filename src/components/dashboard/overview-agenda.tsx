"use client";

import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Task } from "@/types/task";
import { AGENDA_GROUP_ORDER, type AgendaGroup, type AgendaGroupKey } from "@/lib/dashboard/overview-agenda";

const GROUP_LABEL_KEY: Record<AgendaGroupKey, string> = {
  overdue: "agenda.overdue",
  today: "agenda.today",
  thisWeek: "agenda.thisWeek",
};

/** Local-date parse of a "YYYY-MM-DD" due date — avoids the UTC-midnight
 * day-shift `new Date(string)` would introduce in negative-UTC timezones. */
function parseDateOnly(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

interface OverviewAgendaProps {
  groups: AgendaGroup[];
  planningHref: string | null;
}

/** "This week" agenda — non-done tasks grouped by due date, Overdue tasks
 * flagged with a stamp (design Canvas 3a). Display-only checkboxes: this is
 * a read-at-a-glance list, not the board — clicking a row hands off to
 * Planning. */
export function OverviewAgenda({ groups, planningHref }: OverviewAgendaProps) {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const dueFmt = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short" });

  const row = (task: Task, isOverdue: boolean) => {
    const meta = task.due_date ? dueFmt.format(parseDateOnly(task.due_date)) : "";
    const content = (
      <div className="flex items-center gap-2.5 py-[7px]">
        <span
          className="h-[15px] w-[15px] flex-none rounded-[5px]"
          style={{ border: "1.5px solid var(--line-2)" }}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium leading-tight">{task.title}</div>
          <div className="text-[11px]" style={{ color: "var(--muted)" }}>
            {meta}
          </div>
        </div>
        {isOverdue && <span className="stamp negative flex-none">{t("agenda.overdue")}</span>}
      </div>
    );
    return planningHref ? (
      <Link key={task.id} href={planningHref} className="block hover:opacity-80">
        {content}
      </Link>
    ) : (
      <div key={task.id}>{content}</div>
    );
  };

  return (
    <div className="folio-card p-5">
      <div className="mb-1.5 flex items-baseline justify-between">
        <h2 className="font-display text-[18px] font-semibold tracking-tight">{t("agenda.title")}</h2>
        {planningHref && (
          <Link href={planningHref} className="flex items-center gap-1 text-[12.5px] font-medium">
            {t("agenda.viewAll")} <ArrowRight size={12} />
          </Link>
        )}
      </div>

      {groups.length === 0 ? (
        <p className="py-3 text-[13px]" style={{ color: "var(--muted)" }}>
          {t("agenda.empty")}
        </p>
      ) : (
        AGENDA_GROUP_ORDER.filter((key) => groups.some((g) => g.key === key)).map((key) => {
          const group = groups.find((g) => g.key === key)!;
          return (
            <div key={key}>
              <div
                className="mt-3 text-[10.5px] font-semibold uppercase tracking-[0.1em]"
                style={{ color: key === "overdue" ? "var(--negative)" : "var(--muted)" }}
              >
                {t(GROUP_LABEL_KEY[key])}
              </div>
              {group.tasks.map((task) => row(task, key === "overdue"))}
            </div>
          );
        })
      )}
    </div>
  );
}
