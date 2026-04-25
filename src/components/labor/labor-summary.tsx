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
  month: string;
  onMonthChange: (value: string) => void;
}

export function LaborSummary({
  summary,
  isLoading,
  month,
  onMonthChange,
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
      <div className="max-w-xs space-y-1">
        <Label>{t("filterMonth")}</Label>
        <Input
          type="month"
          value={month}
          onChange={(e) => onMonthChange(e.target.value)}
        />
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
