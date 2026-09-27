"use client";

/**
 * PersonMergeForm — admin tool to consolidate two duplicate Person rows
 * into one. Calls POST /api/v1/persons/<source>/merge from cook 1c.
 *
 * UX: two PersonTypeaheads (source + target) + a confirmation dialog
 * that surfaces the destructive nature of the operation (source row is
 * deleted, its workers move to target). Toast on success/failure.
 *
 * Plan: 260512-2341-labor-calendar-and-bulk-log → phase-01 / 1d-iii.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PersonTypeahead } from "@/components/persons/person-typeahead";
import { mergePersons } from "@/lib/api/persons";
import type { PersonSummary } from "@/types/person";

export function PersonMergeForm() {
  const t = useTranslations("personsMerge");
  const [source, setSource] = useState<PersonSummary | null>(null);
  const [target, setTarget] = useState<PersonSummary | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [merging, setMerging] = useState(false);

  const sameId = source && target && source.id === target.id;
  const canMerge = !!source && !!target && !sameId && !merging;

  async function handleConfirm() {
    if (!source || !target) return;
    setMerging(true);
    try {
      const result = await mergePersons(source.id, {
        target_person_id: target.id,
      });
      toast.success(t("success", { source: source.name, target: target.name }), {
        description: t("successDetail", { count: result.workers_reassigned }),
      });
      setSource(null);
      setTarget(null);
    } catch (err) {
      // The API's own message ("Platform ops required.") beats "HTTP 403".
      const data = (err as { data?: { message?: unknown } } | null)?.data;
      const message =
        typeof data?.message === "string"
          ? data.message
          : err instanceof Error
            ? err.message
            : undefined;
      toast.error(t("failed"), message ? { description: message } : undefined);
    } finally {
      setMerging(false);
      setConfirmOpen(false);
    }
  }

  return (
    <>
      <Card>
        <CardContent className="space-y-6 pt-6">
          <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-[1fr_auto_1fr]">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {t("source")} <span className="text-muted-foreground">{t("sourceHint")}</span>
              </label>
              <PersonTypeahead
                value={source}
                onChange={setSource}
                placeholder={t("sourcePlaceholder")}
              />
              {source?.phone && (
                <p className="text-muted-foreground font-mono text-xs">
                  {source.phone}
                </p>
              )}
            </div>

            <div className="hidden md:flex md:items-center md:justify-center md:pb-2">
              <ArrowRight className="text-muted-foreground h-5 w-5" />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {t("target")} <span className="text-muted-foreground">{t("targetHint")}</span>
              </label>
              <PersonTypeahead
                value={target}
                onChange={setTarget}
                placeholder={t("targetPlaceholder")}
              />
              {target?.phone && (
                <p className="text-muted-foreground font-mono text-xs">
                  {target.phone}
                </p>
              )}
            </div>
          </div>

          {sameId && (
            <p className="text-destructive text-sm">
              {t("sameRow")}
            </p>
          )}

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setSource(null);
                setTarget(null);
              }}
              disabled={merging}
            >
              {t("clear")}
            </Button>
            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={!canMerge}
            >
              {merging && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("merge")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.rich("confirmBody", {
                source: source?.name ?? "",
                target: target?.name ?? "",
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={merging}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={merging}>
              {merging && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("merge")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
