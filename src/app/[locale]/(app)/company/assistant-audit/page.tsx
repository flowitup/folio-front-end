/**
 * Assistant audit page — company-admin supervision log.
 *
 * One row per `@folio` mention the assistant handled in this company's chat channels
 * (company/project/admin), backed by `GET /api/v1/assistant/audit` (admins of the
 * company only — the backend rejects everyone else with 403; the `adminCompanies`
 * check below is defense-in-depth so a non-admin never even fires the request, the
 * same shape as `TemplatesPage` / `BillingTemplatesCompanyScope`).
 *
 * Filtering is a plain `<form method="GET">`: date range, company (only shown when the
 * caller admins more than one) and user — no client JS required, every filter change is
 * just a new request for this same server component with a different query string.
 *
 * Dates are rendered in Europe/Paris explicitly (`timeZone` pinned below) rather than
 * relying on the container's local time, which is not guaranteed to be Paris — same
 * landmine as the client-side chat hydration date formatting, just on the server side
 * of it: if this ran with the container's local zone, French-audience dates would drift
 * off by hours depending on where it happens to be deployed.
 */

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { fetchMyCompanies, fetchAttachedUsers } from "@/lib/api/companies";
import { listAssistantAudit } from "@/lib/api/assistant-audit";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MyCompany, AttachedUser } from "@/types/companies";
import type { AssistantAuditEntry } from "@/types/assistant-audit";

const PARIS_TZ = "Europe/Paris";
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const KNOWN_CHANNEL_KINDS = new Set(["company", "project", "admin"]);
const KNOWN_OUTCOMES = new Set(["answered", "refused", "error"]);
const OUTCOME_VARIANT: Record<string, "default" | "outline" | "destructive"> = {
  answered: "default",
  refused: "outline",
  error: "destructive",
};

function parisDateString(d: Date): string {
  // en-CA formats as YYYY-MM-DD, exactly the wire/query shape the backend expects.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PARIS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function formatAuditTimestamp(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: PARIS_TZ,
  }).format(new Date(iso));
}

function formatCost(cost: number | null): string {
  if (cost === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(cost);
}

function parseChannelKey(key: string): { kind: string; id: string } {
  const idx = key.indexOf(":");
  return idx === -1 ? { kind: key, id: "" } : { kind: key.slice(0, idx), id: key.slice(idx + 1) };
}

function singleParam(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AssistantAuditPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;

  // Admin gate: exactly the TemplatesPage pattern — fetch the caller's companies,
  // keep only the ones they admin, and send anyone who admins none to the app home
  // (the app's standard forbidden treatment for an admin-only surface, see
  // BillingLayout). Missing/failed fetch reads the same as "admins nothing".
  let adminCompanies: MyCompany[] = [];
  try {
    const companies = await fetchMyCompanies();
    adminCompanies = companies.filter((c) => c.role === "admin");
  } catch (err) {
    console.error(
      "[AssistantAuditPage] Failed to fetch companies:",
      err instanceof Error ? err.message : "unknown"
    );
  }
  if (adminCompanies.length === 0) {
    redirect(`/${locale}`);
    return null;
  }

  const requestedCompanyId = singleParam(sp.company_id);
  const defaultCompany = adminCompanies.find((c) => c.is_primary) ?? adminCompanies[0];
  const selectedCompany =
    adminCompanies.find((c) => c.id === requestedCompanyId) ?? defaultCompany;

  const now = new Date();
  const defaultTo = parisDateString(now);
  const defaultFrom = parisDateString(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
  const fromParam = singleParam(sp.from);
  const toParam = singleParam(sp.to);
  const from = fromParam && DATE_ONLY_RE.test(fromParam) ? fromParam : defaultFrom;
  const to = toParam && DATE_ONLY_RE.test(toParam) ? toParam : defaultTo;

  const userIdParam = singleParam(sp.user_id)?.trim();
  const userId = userIdParam ? userIdParam : undefined;

  // Best-effort: powers the user filter as a select when it loads, falls back to a
  // free-text user id field otherwise (the audit endpoint accepts either).
  let attachedUsers: AttachedUser[] | null = null;
  try {
    attachedUsers = await fetchAttachedUsers(selectedCompany.id);
  } catch (err) {
    console.error(
      "[AssistantAuditPage] Failed to fetch attached users:",
      err instanceof Error ? err.message : "unknown"
    );
  }

  let entries: AssistantAuditEntry[] = [];
  let loadError = false;
  try {
    const result = await listAssistantAudit({
      companyId: selectedCompany.id,
      from,
      to,
      userId,
      limit: 200,
    });
    entries = result.items;
  } catch (err) {
    console.error(
      "[AssistantAuditPage] Failed to fetch assistant audit:",
      err instanceof Error ? err.message : "unknown"
    );
    loadError = true;
  }

  const t = await getTranslations({ locale, namespace: "assistantAudit" });
  const tChat = await getTranslations({ locale, namespace: "chat" });

  return (
    <div className="fade-up px-4 pb-12 pt-6 lg:px-8">
      <div className="mb-6">
        <h1 className="font-display text-[28px] font-medium tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-[13px]" style={{ color: "var(--muted)" }}>
          {t("description")}
        </p>
      </div>

      <form method="GET" className="folio-card mb-5 flex flex-wrap items-end gap-3 p-5">
        {adminCompanies.length > 1 && (
          <div className="flex flex-col gap-1">
            <label className="label-cap" htmlFor="assistant-audit-company">
              {t("filters.company")}
            </label>
            <select
              id="assistant-audit-company"
              name="company_id"
              defaultValue={selectedCompany.id}
              className="folio-input"
            >
              {adminCompanies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.legal_name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className="label-cap" htmlFor="assistant-audit-from">
            {t("filters.from")}
          </label>
          <input
            id="assistant-audit-from"
            type="date"
            name="from"
            defaultValue={from}
            max={to}
            className="folio-input"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="label-cap" htmlFor="assistant-audit-to">
            {t("filters.to")}
          </label>
          <input
            id="assistant-audit-to"
            type="date"
            name="to"
            defaultValue={to}
            min={from}
            className="folio-input"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="label-cap" htmlFor="assistant-audit-user">
            {t("filters.user")}
          </label>
          {attachedUsers && attachedUsers.length > 0 ? (
            <select
              id="assistant-audit-user"
              name="user_id"
              defaultValue={userId ?? ""}
              className="folio-input"
            >
              <option value="">{t("filters.userAll")}</option>
              {attachedUsers.map((u) => (
                <option key={u.user_id} value={u.user_id}>
                  {u.display_name ?? u.email}
                </option>
              ))}
            </select>
          ) : (
            <input
              id="assistant-audit-user"
              type="text"
              name="user_id"
              defaultValue={userId ?? ""}
              placeholder={t("filters.userIdPlaceholder")}
              className="folio-input"
              aria-label={t("filters.userIdLabel")}
            />
          )}
        </div>

        <Button type="submit" size="sm">
          {t("filters.apply")}
        </Button>
      </form>

      <div className="folio-card overflow-hidden">
        {loadError ? (
          <p className="p-8 text-center text-[13px]" style={{ color: "var(--muted)" }}>
            {t("loadError")}
          </p>
        ) : entries.length === 0 ? (
          <p className="p-8 text-center text-[13px]" style={{ color: "var(--muted)" }}>
            {t("empty")}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columns.date")}</TableHead>
                <TableHead>{t("columns.channel")}</TableHead>
                <TableHead>{t("columns.user")}</TableHead>
                <TableHead>{t("columns.intent")}</TableHead>
                <TableHead>{t("columns.feature")}</TableHead>
                <TableHead>{t("columns.outcome")}</TableHead>
                <TableHead>{t("columns.refusedReason")}</TableHead>
                <TableHead>{t("columns.cost")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => {
                const { kind, id } = parseChannelKey(entry.channel_key);
                const kindLabel = KNOWN_CHANNEL_KINDS.has(kind) ? tChat(`kind.${kind}`) : kind;
                const outcomeLabel = KNOWN_OUTCOMES.has(entry.outcome)
                  ? t(`outcomes.${entry.outcome}`)
                  : entry.outcome;
                const outcomeVariant = OUTCOME_VARIANT[entry.outcome] ?? "outline";
                return (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap text-[12px]">
                      {formatAuditTimestamp(entry.created_at, locale)}
                    </TableCell>
                    <TableCell>
                      <div className="text-[13px]">{kindLabel}</div>
                      <div
                        className="text-[11px]"
                        style={{ color: "var(--muted)", fontFamily: "monospace" }}
                        title={entry.channel_key}
                      >
                        {id.slice(0, 8)}
                      </div>
                    </TableCell>
                    <TableCell className="text-[13px]">{entry.user_name}</TableCell>
                    <TableCell className="text-[12px]" style={{ fontFamily: "monospace" }}>
                      {entry.intent}
                    </TableCell>
                    <TableCell className="text-[12px]" style={{ fontFamily: "monospace" }}>
                      {entry.feature}
                    </TableCell>
                    <TableCell>
                      <Badge variant={outcomeVariant}>{outcomeLabel}</Badge>
                    </TableCell>
                    <TableCell className="text-[12px]" style={{ color: "var(--muted)" }}>
                      {entry.refused_reason ?? "—"}
                    </TableCell>
                    <TableCell className="text-[12px]">{formatCost(entry.cost_usd)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
