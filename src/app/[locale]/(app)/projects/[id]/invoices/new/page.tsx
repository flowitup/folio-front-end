"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import { createInvoice } from "@/lib/api/invoice-api";
import type { CreateInvoicePayload } from "@/types/invoice";

export default function NewInvoicePage() {
  const t = useTranslations("invoices");
  const params = useParams();
  const router = useRouter();
  const locale = useLocale();
  const projectId = params.id as string;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (payload: CreateInvoicePayload) => {
    setIsLoading(true);
    setError(null);
    try {
      const invoice = await createInvoice(projectId, payload);
      router.push(`/${locale}/projects/${projectId}/invoices/${invoice.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create invoice");
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/${locale}/projects/${projectId}/invoices`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-xl font-semibold tracking-tight">{t("newInvoice")}</h2>
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <InvoiceForm onSubmit={handleSubmit} isLoading={isLoading} />
    </div>
  );
}
