"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useAuth } from "@/context/AuthContext";
import { Plus, Loader2, Trash2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Invoice, InvoiceType } from "@/types/invoice";
import { fetchInvoices, deleteInvoice } from "@/lib/api/invoice-api";

type TabType = "all" | InvoiceType;

const TYPE_BADGE_CLASS: Record<InvoiceType, string> = {
  client: "bg-blue-100 text-blue-700",
  labor: "bg-orange-100 text-orange-700",
  supplier: "bg-green-100 text-green-700",
};

export default function InvoicesPage() {
  const t = useTranslations("invoices");
  const params = useParams();
  const router = useRouter();
  const locale = useLocale();
  const projectId = params.id as string;
  const { user } = useAuth();

  const canManageInvoices =
    user?.permissions?.some(
      (p) => p === "project:manage_invoices" || p === "*:*" || p === "project:*"
    ) ?? false;

  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadInvoices = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchInvoices(
        projectId,
        activeTab !== "all" ? activeTab : undefined
      );
      setInvoices(data);
    } catch {
      setError("Failed to load invoices");
    } finally {
      setIsLoading(false);
    }
  }, [projectId, activeTab]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const handleDelete = async (invoice: Invoice) => {
    if (!confirm(t("deleteConfirm"))) return;
    try {
      await deleteInvoice(projectId, invoice.id);
      await loadInvoices();
    } catch {
      setError("Failed to delete invoice");
    }
  };

  const tabs: TabType[] = ["all", "client", "labor", "supplier"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold tracking-tight">{t("title")}</h2>
        {canManageInvoices && (
          <Button
            onClick={() =>
              router.push(`/${locale}/projects/${projectId}/invoices/new`)
            }
            size="sm"
          >
            <Plus className="h-4 w-4 mr-1" />
            {t("newInvoice")}
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "all" ? t("all") : t(`types.${tab}`)}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Loading */}
      {isLoading && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      )}

      {/* Table */}
      {!isLoading && (
        <Card>
          <CardContent className="p-0">
            {invoices.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                {t("noInvoices")}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        {t("invoiceNumber")}
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        {t("type")}
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        {t("issueDate")}
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        {t("recipient")}
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                        {t("totalAmount")}
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice) => (
                      <tr
                        key={invoice.id}
                        className="border-b last:border-0 hover:bg-muted/20 transition-colors"
                      >
                        <td className="px-4 py-3 font-mono text-xs">
                          {invoice.invoice_number}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              TYPE_BADGE_CLASS[invoice.type]
                            }`}
                          >
                            {t(`types.${invoice.type}`)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {invoice.issue_date}
                        </td>
                        <td className="px-4 py-3">{invoice.recipient_name}</td>
                        <td className="px-4 py-3 text-right font-medium">
                          {invoice.total_amount.toFixed(2)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() =>
                                router.push(
                                  `/${locale}/projects/${projectId}/invoices/${invoice.id}`
                                )
                              }
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            {canManageInvoices && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDelete(invoice)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
