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
import { ChevronsUpDown, Loader2, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";

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
import { rateLimitErrorMessage } from "@/lib/api/rate-limit";
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
  /** Debounce delay in ms for server-side search. Default 350. */
  debounceMs?: number;
  /** Result page size (max 100 per backend cap). Default 20. */
  limit?: number;
  /** Offer "Create …" for an unmatched name. Off where a new Person makes no
   * sense (the merge tool picks existing rows only). Default true. */
  allowCreate?: boolean;
  /** People who cannot be picked here (e.g. already workers on the project):
   * listed but disabled, with an "Already on this project" note. */
  excludeIds?: string[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Shortest search the persons API accepts (anti-enumeration). */
const MIN_QUERY_LENGTH = 2;

export function PersonTypeahead({
  value,
  onChange,
  placeholder,
  disabled = false,
  className,
  debounceMs = 350,
  limit = 20,
  allowCreate = true,
  excludeIds,
}: PersonTypeaheadProps) {
  const t = useTranslations("labor.typeahead");
  const tCommon = useTranslations("common");
  const listId = React.useId();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [fetchedResults, setResults] = React.useState<PersonSummary[]>([]);
  const [fetching, setLoading] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  // The query the shown results answer, and why the last search or create
  // failed: "Create …" is only offered once a search has answered for
  // exactly the typed text, so a refused search (429) can no longer lead to
  // a duplicate person.
  const [answeredQuery, setAnsweredQuery] = React.useState<string | null>(null);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [retryNonce, setRetryNonce] = React.useState(0);

  // Debounced server search. We track the latest request ID to discard
  // out-of-order responses (slow networks + fast typing).
  const requestSeqRef = React.useRef(0);

  React.useEffect(() => {
    if (!open) return;
    const seq = ++requestSeqRef.current;
    const q = query.trim();
    // The API refuses a search shorter than MIN_QUERY_LENGTH (400): don't ask.
    if (q.length < MIN_QUERY_LENGTH) return;
    const handle = window.setTimeout(async () => {
      setLoading(true);
      try {
        const rows = await fetchPersons({ q, limit });
        if (seq === requestSeqRef.current) {
          setResults(rows);
          setAnsweredQuery(q);
          setSearchError(null);
        }
      } catch (err) {
        if (seq === requestSeqRef.current) {
          setResults([]);
          setAnsweredQuery(null);
          setSearchError(rateLimitErrorMessage(err, tCommon) ?? t("searchFailed"));
        }
      } finally {
        if (seq === requestSeqRef.current) setLoading(false);
      }
    }, debounceMs);
    return () => window.clearTimeout(handle);
  }, [query, open, debounceMs, limit, retryNonce, t, tCommon]);

  // Show "Create new" only when (a) there's a trimmed query, and (b) no
  // existing person has that exact normalized name.
  const trimmed = query.trim();
  // Below the minimum the last search's rows are stale: show none.
  const searchable = trimmed.length >= MIN_QUERY_LENGTH;
  const results = searchable ? fetchedResults : [];
  const loading = searchable && fetching;
  const answered = !searchable || (answeredQuery === trimmed && !loading);
  const failed = searchable && !!searchError && !loading;
  const exactMatch =
    trimmed.length > 0 &&
    results.some((p) => p.name.trim().toLowerCase() === trimmed.toLowerCase());
  const showCreate = allowCreate && trimmed.length > 0 && !exactMatch && !creating && answered && !failed;
  const excluded = React.useMemo(() => new Set(excludeIds ?? []), [excludeIds]);

  async function handleSelect(person: PersonSummary) {
    onChange(person);
    setOpen(false);
    setQuery("");
  }

  async function handleCreateNew() {
    if (!trimmed) return;
    setCreating(true);
    setCreateError(null);
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
    } catch (err) {
      // Leave the typeahead open so the user can retry, and say why.
      setCreateError(rateLimitErrorMessage(err, tCommon) ?? t("createFailed"));
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
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={placeholder ?? t("placeholder")}
            value={query}
            onValueChange={(next) => {
              setQuery(next);
              setCreateError(null);
            }}
            data-testid="person-typeahead-input"
          />
          <CommandList id={listId}>
            {failed && (
              <div role="alert" className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="text-destructive">{searchError}</span>
                <button
                  type="button"
                  className="text-primary shrink-0 text-xs font-medium underline-offset-2 hover:underline"
                  onClick={() => setRetryNonce((n) => n + 1)}
                >
                  {t("retrySearch")}
                </button>
              </div>
            )}
            {createError && (
              <div role="alert" className="text-destructive px-3 py-2 text-sm">
                {createError}
              </div>
            )}
            {results.length === 0 && !showCreate && !loading && !failed && answered && (
              <CommandEmpty>
                {searchable ? t("noMatches") : t("typeToSearch")}
              </CommandEmpty>
            )}
            {results.length > 0 && (
              <CommandGroup heading={t("existing")}>
                {results.map((person) => (
                  <CommandItem
                    key={person.id}
                    value={person.id}
                    disabled={excluded.has(person.id)}
                    onSelect={() => handleSelect(person)}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="truncate">{person.name}</span>
                    {excluded.has(person.id) ? (
                      <span className="text-muted-foreground ml-2 shrink-0 text-xs">
                        {t("alreadyOnProject")}
                      </span>
                    ) : (
                      person.phone && (
                        <span className="text-muted-foreground ml-2 shrink-0 font-mono text-xs">
                          {person.phone}
                        </span>
                      )
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
                    {t("create", { name: trimmed })}
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
