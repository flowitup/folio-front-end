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
      toast.success(
        `Merged "${source.name}" into "${target.name}".`,
        {
          description: `${result.workers_reassigned} worker${
            result.workers_reassigned === 1 ? "" : "s"
          } reassigned. Source Person deleted.`,
        },
      );
      setSource(null);
      setTarget(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error";
      toast.error("Merge failed", { description: message });
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
                Source <span className="text-muted-foreground">(deleted)</span>
              </label>
              <PersonTypeahead
                value={source}
                onChange={setSource}
                placeholder="Pick the duplicate to remove…"
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
                Target <span className="text-muted-foreground">(kept)</span>
              </label>
              <PersonTypeahead
                value={target}
                onChange={setTarget}
                placeholder="Pick the row to keep…"
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
              Source and target must be different rows.
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
              Clear
            </Button>
            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={!canMerge}
            >
              {merging && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Merge
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Merge persons?</AlertDialogTitle>
            <AlertDialogDescription>
              All Worker rows currently pointing at{" "}
              <strong>{source?.name}</strong> will be reassigned to{" "}
              <strong>{target?.name}</strong>, and the source Person row
              will be permanently deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={merging}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={merging}>
              {merging && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Merge
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
