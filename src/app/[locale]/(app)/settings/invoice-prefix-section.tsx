"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Settings, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useProject } from "@/context/ProjectContext";
import { projectDisplayName } from "@/lib/projects/project-display-name";
import { fetchProjectById } from "@/lib/api/projects";
import type { Project } from "@/types/project";
import { updateInvoicePrefix } from "./_actions/invoice-prefix-actions";

const PREFIX_RE = /^[A-Z0-9]{0,8}$/;

export function InvoicePrefixSection() {
  const { selectedProject, refetch } = useProject();
  if (!selectedProject) return null;
  // Keyed on the project so switching projects starts from that project's
  // prefix instead of keeping the previous one's.
  return (
    <InvoicePrefixForm key={selectedProject.id} project={selectedProject} refetch={refetch} />
  );
}

function InvoicePrefixForm({
  project: selectedProject,
  refetch,
}: {
  project: Project;
  refetch: () => Promise<void> | void;
}) {
  const t = useTranslations("projects");
  // The saved prefix. The project list the context holds does not carry
  // invoice_prefix, so read it from the project itself.
  const [savedPrefix, setSavedPrefix] = useState(selectedProject.invoice_prefix ?? "");
  const [prefix, setPrefix] = useState(savedPrefix);
  const [saving, setSaving] = useState(false);
  const currentYear = new Date().getFullYear();
  const preview = prefix || "INV";

  useEffect(() => {
    let cancelled = false;
    fetchProjectById(selectedProject.id)
      .then((project) => {
        if (cancelled) return;
        const saved = project.invoice_prefix ?? "";
        setSavedPrefix(saved);
        // Only replace what the field shows if the user has not typed yet.
        setPrefix((current) =>
          current === (selectedProject.invoice_prefix ?? "") ? saved : current
        );
      })
      .catch(() => {
        // Keep the list value; saving still works.
      });
    return () => {
      cancelled = true;
    };
  }, [selectedProject.id, selectedProject.invoice_prefix]);

  const handlePrefixChange = (value: string) => {
    const upper = value.toUpperCase();
    if (PREFIX_RE.test(upper)) {
      setPrefix(upper);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const result = await updateInvoicePrefix(selectedProject.id, prefix);
    setSaving(false);
    if (result.ok) {
      setSavedPrefix(prefix);
      toast.success(t("settingsSaved"));
      await refetch();
    } else if (result.error === "validation") {
      toast.error(t("invoicePrefixInvalid"));
    } else if (result.error === "forbidden") {
      toast.error(t("settingsForbidden"));
    } else {
      toast.error(t("settingsSaveError"));
    }
  };

  const isDirty = prefix !== savedPrefix;

  return (
    <section className="folio-card p-7">
      <div className="flex items-center gap-3">
        <Settings size={18} style={{ color: "var(--accent)" }} />
        <div>
          <h3 className="font-display text-[22px] font-medium tracking-tight">
            {t("settingsTitle")}
          </h3>
          <p className="mt-0.5 text-[13px]" style={{ color: "var(--muted)" }}>
            {projectDisplayName(selectedProject)}
          </p>
        </div>
      </div>

      <div className="ink-divider my-5" />

      <div className="space-y-4">
        <div>
          <Label htmlFor="invoice-prefix" className="label-cap">
            {t("invoicePrefix")}
          </Label>
          <Input
            id="invoice-prefix"
            className="folio-input mt-1.5 max-w-[200px] font-mono uppercase"
            value={prefix}
            onChange={(e) => handlePrefixChange(e.target.value)}
            placeholder={t("invoicePrefixPlaceholder")}
            maxLength={8}
          />
          <p
            className="mt-2 text-[12px]"
            style={{ color: "var(--muted)" }}
          >
            {t("invoicePrefixHint")}
          </p>
        </div>

        <div
          className="rounded-lg border px-4 py-3"
          style={{
            borderColor: "var(--line)",
            background: "var(--paper-2)",
          }}
        >
          <span
            className="text-[11px] uppercase tracking-wide"
            style={{ color: "var(--muted)" }}
          >
            {t("invoicePrefixExample", {
              prefix: preview,
              year: String(currentYear),
            }).split(":")[0]}:
          </span>
          <span className="ml-2 font-mono text-[14px] font-medium">
            {preview}-{currentYear}-0001
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={handleSave}
            disabled={!isDirty || saving}
            size="sm"
          >
            {saving && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            {saving ? t("saving") : t("save")}
          </Button>
        </div>
      </div>
    </section>
  );
}
