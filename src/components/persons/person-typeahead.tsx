"use client";

/**
 * PersonTypeahead — search the global Person directory with debounced
 * server-side queries. The dropdown also exposes a "Create new" affordance
 * when the typed text doesn't match any existing person, so a Worker can
 * be associated with a fresh Person inline without leaving the dialog.
 *
 * Plan reference: 260512-2341-labor-calendar-and-bulk-log → phase-01 (1d-i).
 *
 * This component is intentionally NOT yet wired into AddWorkerDialog —
 * that integration lands in cook 1d-ii along with the WorkerResponse
 * serializer change that exposes person_name/person_phone joined fields.
 */

import * as React from "react";
import { ChevronsUpDown, Loader2, Plus, UserPlus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { createPerson, fetchPersons } from "@/lib/api/persons";
import type { PersonSummary } from "@/types/person";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PersonTypeaheadProps {
  /** Currently selected Person (controlled). null = no selection yet. */
  value: PersonSummary | null;
  /** Fires when the user picks an existing or just-created Person. */
  onChange: (person: PersonSummary) => void;
  /** Visible placeholder when no Person is selected. */
  placeholder?: string;
  /** Disable the typeahead trigger. */
  disabled?: boolean;
  /** Optional className passed through to the trigger button. */
  className?: string;
  /** Debounce delay in ms for server-side search. Default 200. */
  debounceMs?: number;
  /** Result page size (max 100 per backend cap). Default 20. */
  limit?: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PersonTypeahead({
  value,
  onChange,
  placeholder = "Search workers…",
  disabled = false,
  className,
  debounceMs = 200,
  limit = 20,
}: PersonTypeaheadProps) {
  const listId = React.useId();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<PersonSummary[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [creating, setCreating] = React.useState(false);

  // Debounced server search. We track the latest request ID to discard
  // out-of-order responses (slow networks + fast typing).
  const requestSeqRef = React.useRef(0);

  React.useEffect(() => {
    if (!open) return;
    const seq = ++requestSeqRef.current;
    const handle = window.setTimeout(async () => {
      setLoading(true);
      try {
        const rows = await fetchPersons({ q: query, limit });
        if (seq === requestSeqRef.current) {
          setResults(rows);
        }
      } catch {
        // Keep previous results visible — searching shouldn't blow up the UI.
        if (seq === requestSeqRef.current) setResults([]);
      } finally {
        if (seq === requestSeqRef.current) setLoading(false);
      }
    }, debounceMs);
    return () => window.clearTimeout(handle);
  }, [query, open, debounceMs, limit]);

  // Show "Create new" only when (a) there's a trimmed query, and (b) no
  // existing person has that exact normalized name.
  const trimmed = query.trim();
  const exactMatch =
    trimmed.length > 0 &&
    results.some((p) => p.name.trim().toLowerCase() === trimmed.toLowerCase());
  const showCreate = trimmed.length > 0 && !exactMatch && !creating;

  async function handleSelect(person: PersonSummary) {
    onChange(person);
    setOpen(false);
    setQuery("");
  }

  async function handleCreateNew() {
    if (!trimmed) return;
    setCreating(true);
    try {
      const created = await createPerson({ name: trimmed });
      // Created Person has full fields — narrow to the summary shape the
      // parent expects.
      const summary: PersonSummary = {
        id: created.id,
        name: created.name,
        phone: created.phone,
      };
      onChange(summary);
      setOpen(false);
      setQuery("");
    } catch {
      // Surface failure subtly — leave the typeahead open so user can retry.
      // A toast at the parent level would be ideal once we adopt Sonner here.
    } finally {
      setCreating(false);
    }
  }

  const displayLabel = value ? value.name : "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          disabled={disabled}
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-1 text-left text-sm shadow-sm",
            "focus:outline-none focus:ring-2 focus:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
        >
          <span className={cn("truncate", !displayLabel && "text-muted-foreground")}>
            {displayLabel || placeholder}
          </span>
          {loading ? (
            <Loader2 className="h-3 w-3 shrink-0 animate-spin opacity-50" />
          ) : (
            <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-40" />
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[260px] p-0"
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={placeholder}
            value={query}
            onValueChange={setQuery}
            data-testid="person-typeahead-input"
          />
          <CommandList id={listId}>
            {results.length === 0 && !showCreate && !loading && (
              <CommandEmpty>
                {trimmed ? "No matches" : "Type to search"}
              </CommandEmpty>
            )}
            {results.length > 0 && (
              <CommandGroup heading="Existing">
                {results.map((person) => (
                  <CommandItem
                    key={person.id}
                    value={person.id}
                    onSelect={() => handleSelect(person)}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="truncate">{person.name}</span>
                    {person.phone && (
                      <span className="text-muted-foreground ml-2 shrink-0 font-mono text-xs">
                        {person.phone}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {showCreate && (
              <>
                {results.length > 0 && <CommandSeparator />}
                <CommandGroup>
                  <CommandItem
                    onSelect={handleCreateNew}
                    className="text-primary flex items-center gap-2"
                  >
                    {creating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <UserPlus className="h-3.5 w-3.5" />
                    )}
                    Create &quot;{trimmed}&quot;
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
