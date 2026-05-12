/**
 * /persons-merge — admin tool to consolidate duplicate Person rows.
 *
 * Hosts <PersonMergeForm>. Backed by POST /api/v1/persons/<id>/merge
 * (cook 1c). Phase 1d-iii. The page itself is a thin wrapper so the
 * form component remains reusable in a future admin settings panel.
 *
 * No role gate yet — the API only requires a valid JWT. A subsequent
 * release will add an admin role check both client- and server-side
 * once we decide which permission to scope it to.
 */

import { PersonMergeForm } from "@/components/persons/person-merge-form";

export default function PersonsMergePage() {
  return (
    <div className="mx-auto max-w-3xl px-8 py-10 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Merge persons
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Consolidate two Person rows that represent the same physical
          human. All of the source&apos;s Worker assignments will be
          reassigned to the target, and the source row will be deleted.
          Use this when the backfill script flags ambiguous duplicates
          or when two admins accidentally created the same person.
        </p>
      </header>

      <PersonMergeForm />
    </div>
  );
}
