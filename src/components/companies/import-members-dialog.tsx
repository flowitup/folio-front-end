"use client";

/**
 * ImportMembersDialog — copy member profiles from another company the admin
 * also admins into the current company (only rendered when the caller admins
 * ≥2 companies). Already-linked user accounts are attached as "member";
 * profiles without a linked account become new pending profiles here too.
 */

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fetchCompanyDirectoryAction,
  importMembersAction,
} from "@/app/[locale]/(app)/settings/_actions/company-settings-actions";
import type { CompanyDirectoryEntry } from "@/lib/api/companies-members";
import type { MyCompany } from "@/types/companies";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  sourceCompanies: MyCompany[];
  onImported: () => void;
}

export function ImportMembersDialog({ open, onOpenChange, companyId, sourceCompanies, onImported }: Props) {
  const t = useTranslations("companySettings.import");
  const [sourceId, setSourceId] = useState<string>(sourceCompanies[0]?.id ?? "");
  const [entries, setEntries] = useState<CompanyDirectoryEntry[]>([]);
  const [isLoadingEntries, setIsLoadingEntries] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadEntries = useCallback(async (id: string) => {
    if (!id) return;
    setIsLoadingEntries(true);
    setEntries([]);
    setSelected(new Set());
    try {
      const result = await fetchCompanyDirectoryAction(id);
      if (result.ok) {
        setEntries(result.data);
      } else {
        // Surface the failure — an empty list otherwise reads as "no one
        // to import", not "couldn't load the source company's directory".
        toast.error(result.error.message);
      }
    } finally {
      setIsLoadingEntries(false);
    }
  }, []);

  useEffect(() => {
    if (open && sourceId) void loadEntries(sourceId);
  }, [open, sourceId, loadEntries]);

  function toggle(personId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(personId)) next.delete(personId);
      else next.add(personId);
      return next;
    });
  }

  async function handleSubmit() {
    if (selected.size === 0 || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const result = await importMembersAction(companyId, sourceId, [...selected]);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success(t("importedToast", { count: result.data.items.length }));
      onOpenChange(false);
      onImported();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("dialogTitle")}</DialogTitle>
          <DialogDescription>{t("dialogDescription")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Select value={sourceId} onValueChange={setSourceId} disabled={isSubmitting}>
            <SelectTrigger>
              <SelectValue placeholder={t("sourcePlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {sourceCompanies.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.legal_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isLoadingEntries ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={18} className="animate-spin" style={{ color: "var(--muted)" }} />
            </div>
          ) : entries.length === 0 ? (
            <p className="py-8 text-center text-[13px]" style={{ color: "var(--muted)" }}>
              {t("empty")}
            </p>
          ) : (
            <div className="max-h-72 overflow-y-auto rounded-lg border" style={{ borderColor: "var(--line)" }}>
              {entries.map((entry) => (
                <label
                  key={entry.person_id}
                  className="flex cursor-pointer items-center gap-2.5 border-b px-3 py-2.5 text-[13px] last:border-b-0"
                  style={{ borderColor: "var(--line)" }}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(entry.person_id)}
                    onChange={() => toggle(entry.person_id)}
                    disabled={isSubmitting}
                  />
                  <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                  <span className="text-[12px]" style={{ color: "var(--muted)" }}>
                    {entry.phone}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            {t("cancel")}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isSubmitting || selected.size === 0} className="gap-1.5">
            {isSubmitting && <Loader2 aria-hidden="true" className="animate-spin" size={14} />}
            {t("submit", { count: selected.size })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
