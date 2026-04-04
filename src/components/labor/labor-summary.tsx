"use client";

import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LaborSummaryResponse } from "@/types/labor";
import { formatEUR } from "@/lib/api/labor";

interface LaborSummaryProps {
  summary: LaborSummaryResponse | null;
  isLoading: boolean;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
}

export function LaborSummary({
  summary,
  isLoading,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
}: LaborSummaryProps) {
  const t = useTranslations("labor");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>{t("filterFrom")}</Label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label>{t("filterTo")}</Label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
          />
        </div>
      </div>

      {/* Summary Table */}
      {!summary || summary.rows.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {t("noEntries")}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-sm font-medium">
                      {t("workerName")}
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium">
                      {t("daysWorked")}
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium">
                      {t("totalCost")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {summary.rows.map((row) => (
                    <tr key={row.worker_id} className="border-b">
                      <td className="px-4 py-3 text-sm">{row.worker_name}</td>
                      <td className="px-4 py-3 text-right text-sm">
                        {row.days_worked}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium">
                        {formatEUR(row.total_cost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/50 font-medium">
                    <td className="px-4 py-3 text-sm">{t("grandTotal")}</td>
                    <td className="px-4 py-3 text-right text-sm">
                      {summary.total_days}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-primary">
                      {formatEUR(summary.total_cost)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
