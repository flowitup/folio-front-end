"use client";

/**
 * PersonTypeahead — search the global Person directory with debounced
 * server-side queries. The dropdown also exposes a "Create new" affordance
 * when the typed text doesn't match any existing person, so a Worker can
 * be associated with a fresh Person inline without leaving the dialog.
 *
 * Plan reference: 260512-2341-labor-calendar-and-bulk-log → phase-01 (1d-i).
 *
 * "Create" never saves a person by itself: it hands back a draft that the
 * caller saves together with what it creates (a worker), so a cancelled or
 * failed form leaves no orphan person.
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
import { fetchPersons } from "@/lib/api/persons";
import type { PersonSummary } from "@/types/person";

/**
 * A pick from the typeahead. `draft` = a new person typed in the search, not
 * saved yet (id ""): the caller creates it together with what it is for (the
 * worker), so cancelling or a failed save leaves no orphan person behind.
 * A draft typed as a phone number carries it as `phone` and an empty name.
 */
export type PersonChoice = PersonSummary & { draft?: boolean };

/** "06 20 30 00 04", "0620300004", "+33 6 20…": a phone number, not a name. */
export function looksLikePhone(text: string): boolean {
  const trimmed = text.trim();
  return /^\+?[\d\s.\-()/]+$/.test(trimmed) && trimmed.replace(/\D/g, "").length >= 9;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PersonTypeaheadProps {
  /** Currently selected Person (controlled). null = no selection yet. */
  value: PersonChoice | null;
  /** Fires when the user picks an existing Person or a new one (draft). */
  onChange: (person: PersonChoice) => void;
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
  /** Offer "Create …" for an unmatched name. Off where a new Person makes no
   * sense (the merge tool picks existing rows only). Default true. */
  allowCreate?: boolean;
  /** People who cannot be picked here (e.g. already workers on the project):
   * listed but disabled, with an "Already on this project" note. */
  excludeIds?: string[];
  /** Search only this company's directory (sent as company_id). */
  companyId?: string;
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
  debounceMs = 200,
  limit = 20,
  allowCreate = true,
  excludeIds,
  companyId,
}: PersonTypeaheadProps) {
  const t = useTranslations("labor.typeahead");
  const listId = React.useId();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [fetchedResults, setResults] = React.useState<PersonSummary[]>([]);
  const [fetching, setLoading] = React.useState(false);
  // The query the current results answer: "Create" for a phone waits for it.
  const [searchedQuery, setSearchedQuery] = React.useState<string | null>(null);

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
        const rows = await fetchPersons(companyId ? { q, limit, companyId } : { q, limit });
        if (seq === requestSeqRef.current) {
          setResults(rows);
          setSearchedQuery(q);
        }
      } catch {
        // Keep previous results visible — searching shouldn't blow up the UI.
        if (seq === requestSeqRef.current) {
          setResults([]);
          setSearchedQuery(q);
        }
      } finally {
        if (seq === requestSeqRef.current) setLoading(false);
      }
    }, debounceMs);
    return () => window.clearTimeout(handle);
  }, [query, open, debounceMs, limit, companyId]);

  // Show "Create new" only when (a) there's a trimmed query, and (b) no
  // existing person has that exact normalized name.
  const trimmed = query.trim();
  // Below the minimum the last search's rows are stale: show none.
  const searchable = trimmed.length >= MIN_QUERY_LENGTH;
  const results = searchable ? fetchedResults : [];
  const loading = searchable && fetching;
  const exactMatch =
    trimmed.length > 0 &&
    results.some((p) => p.name.trim().toLowerCase() === trimmed.toLowerCase());
  // A number typed in another format ("06 20 30 00 04" vs "+33620300004") is
  // the same person: never offer to create one before the search has answered,
  // nor next to a person it found.
  const isPhone = looksLikePhone(trimmed);
  const phoneSettled = !isPhone || (!loading && searchedQuery === trimmed && results.length === 0);
  const showCreate = allowCreate && trimmed.length > 0 && !exactMatch && phoneSettled;
  const excluded = React.useMemo(() => new Set(excludeIds ?? []), [excludeIds]);

  function handleSelect(person: PersonSummary) {
    onChange(person);
    setOpen(false);
    setQuery("");
  }

  function handleCreateNew() {
    if (!trimmed) return;
    // Nothing is saved here: the parent creates the person with the worker.
    onChange(
      isPhone
        ? { id: "", name: "", phone: trimmed, draft: true }
        : { id: "", name: trimmed, phone: null, draft: true },
    );
    setOpen(false);
    setQuery("");
  }

  const displayLabel = value ? value.name || value.phone || "" : "";

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
            onValueChange={setQuery}
            data-testid="person-typeahead-input"
          />
          <CommandList id={listId}>
            {results.length === 0 && !showCreate && !loading && (
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
                    <UserPlus className="h-3.5 w-3.5" />
                    {isPhone ? t("createWithPhone", { phone: trimmed }) : t("create", { name: trimmed })}
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
