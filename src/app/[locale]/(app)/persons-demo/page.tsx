"use client";

/**
 * /persons-demo — isolated PersonTypeahead demo.
 *
 * Standalone page that hosts the typeahead in isolation so we can verify
 * search, debounce, ordering, and inline-create UX without wiring it into
 * the AddWorkerDialog (that integration lands in cook 1d-ii).
 *
 * This is a development-only surface — once 1d-ii ships and the typeahead
 * is wired into the real worker creation flow, this page becomes redundant
 * and should be deleted.
 *
 * Plan: 260512-2341-labor-calendar-and-bulk-log → phase-01 / 1d-i.
 */

import { useState } from "react";

import { PersonTypeahead } from "@/components/persons/person-typeahead";
import { Card, CardContent } from "@/components/ui/card";
import type { PersonSummary } from "@/types/person";

export default function PersonsDemoPage() {
  const [selected, setSelected] = useState<PersonSummary | null>(null);
  const [history, setHistory] = useState<PersonSummary[]>([]);

  function handleChange(person: PersonSummary) {
    setSelected(person);
    setHistory((prev) => {
      // Move to top, de-duplicate by id, keep last 5.
      const filtered = prev.filter((p) => p.id !== person.id);
      return [person, ...filtered].slice(0, 5);
    });
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-10 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          PersonTypeahead — demo
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Standalone harness for the Person identity typeahead introduced in
          plan 260512-2341 cook 1d-i. Backend endpoints:{" "}
          <code className="bg-muted rounded px-1.5 py-0.5 text-xs">
            GET /api/v1/persons
          </code>{" "}
          and{" "}
          <code className="bg-muted rounded px-1.5 py-0.5 text-xs">
            POST /api/v1/persons
          </code>
          .
        </p>
      </header>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-1.5">
            <label
              htmlFor="person-typeahead-trigger"
              className="text-sm font-medium"
            >
              Pick or create a Person
            </label>
            <PersonTypeahead
              value={selected}
              onChange={handleChange}
              placeholder="Search by name or phone…"
            />
            <p className="text-muted-foreground text-xs">
              Try: <kbd className="bg-muted rounded px-1">hug</kbd> (matches
              Hugo Martin),{" "}
              <kbd className="bg-muted rounded px-1">dupont</kbd> (matches Jean
              + Léo), or type a new name and hit{" "}
              <kbd className="bg-muted rounded px-1">Create</kbd>.
            </p>
          </div>

          <div className="border-t pt-4">
            <h2 className="text-sm font-medium">Current selection</h2>
            {selected ? (
              <pre className="bg-muted mt-2 overflow-x-auto rounded-md p-3 text-xs">
                {JSON.stringify(selected, null, 2)}
              </pre>
            ) : (
              <p className="text-muted-foreground mt-2 text-sm">
                (none — pick or create above)
              </p>
            )}
          </div>

          {history.length > 0 && (
            <div className="border-t pt-4">
              <h2 className="text-sm font-medium">Recent picks (this session)</h2>
              <ul className="mt-2 space-y-1 text-sm">
                {history.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between rounded-md border px-3 py-1.5"
                  >
                    <span>{p.name}</span>
                    <span className="text-muted-foreground font-mono text-xs">
                      {p.phone ?? "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
