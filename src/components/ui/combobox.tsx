"use client";

/**
 * Combobox — generic typeahead with async loading and free-text support.
 *
 * Props:
 *   value / onChange — controlled string value
 *   options          — list of { value, label, meta? } to display
 *   onQueryChange    — called on every keystroke for async data loading; when
 *                      omitted, options are filtered locally by the typed text
 *   placeholder      — input placeholder
 *   emptyText        — text shown when options list is empty (no match)
 *   allowFreeText    — default true; the typed string becomes the value on Enter
 *                      (unless an option was picked with the arrow keys), on
 *                      blur and when the popover closes; Escape reverts it, and
 *                      an empty string clears the value
 *   loading          — shows a subtle spinner hint while fetching
 *   disabled         — passthrough to trigger button
 *   className        — added to the trigger button
 *
 * Opening the popover moves focus into its search input, and typing a
 * character on the focused (closed) trigger opens it with that character, so
 * the field works from the keyboard and no typed text is lost.
 */

import * as React from "react";
import { ChevronsUpDown, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ComboboxOption {
  value: string;
  label: string;
  /** Optional right-side metadata rendered in muted text. */
  meta?: React.ReactNode;
}

export interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  onQueryChange?: (q: string) => void;
  placeholder?: string;
  emptyText?: string;
  allowFreeText?: boolean;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  /** Optional heading rendered above the options group. */
  groupHeading?: string;
}

const TABBABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]';

/** Focus the tabbable element after (1) or before (-1) *from* in document order. */
function focusTabbableFrom(from: HTMLElement, direction: 1 | -1) {
  const tabbables = Array.from(document.querySelectorAll<HTMLElement>(TABBABLE)).filter(
    (el) => el.tabIndex >= 0 && (el.checkVisibility?.() ?? true)
  );
  const index = tabbables.indexOf(from);
  (tabbables[index + direction] ?? from).focus();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Combobox({
  value,
  onChange,
  options,
  onQueryChange,
  placeholder = "",
  emptyText = "No matches",
  allowFreeText = true,
  loading = false,
  disabled = false,
  className,
  groupHeading,
}: ComboboxProps) {
  const listId = React.useId();
  const [open, setOpen] = React.useState(false);
  // inputQuery tracks what's visible in the CommandInput (may differ from
  // committed value while the popover is open).
  const [inputQuery, setInputQuery] = React.useState(value);
  // Set when an option is selected; consulted by handleBlur to skip the
  // free-text overwrite that would otherwise race with the click.
  const justSelectedRef = React.useRef(false);
  // Set when the user moves the highlight with the keyboard: Enter then picks
  // the highlighted option instead of committing the typed text.
  const navigatedRef = React.useRef(false);
  // Set by Escape so the close that follows does not commit the typed text.
  const cancelledRef = React.useRef(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  // Set by Tab / Shift+Tab in the input: where focus goes once the popover closes.
  const tabDirectionRef = React.useRef<0 | 1 | -1>(0);

  // Sync inputQuery whenever the controlled value changes from the outside
  // (e.g., when parent prefills after suggestion selection).
  React.useEffect(() => {
    if (!open) {
      setInputQuery(value);
    }
  }, [value, open]);

  /** Reset the per-opening flags and show *query* in the input. */
  function startQuery(query: string) {
    justSelectedRef.current = false;
    navigatedRef.current = false;
    cancelledRef.current = false;
    setInputQuery(query);
    onQueryChange?.(query);
  }

  // On open — pre-populate the input with the current committed value so the
  // user can refine from where they left off.
  function handleOpenChange(next: boolean) {
    if (next) {
      startQuery(value);
    } else if (!cancelledRef.current && !justSelectedRef.current) {
      // Closed by a click outside or by tabbing away. The input can be
      // unmounted before its blur fires, so commit the typed text here.
      commitFreeText();
    }
    setOpen(next);
  }

  /**
   * A character typed on the closed trigger opens the popover and starts the
   * search with it. Space and Enter keep their button role (open the list).
   */
  function handleTriggerKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (open || e.key.length !== 1 || e.key === " " || e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
    startQuery(e.key);
    setOpen(true);
  }

  function handleQueryChange(q: string) {
    navigatedRef.current = false;
    setInputQuery(q);
    onQueryChange?.(q);
  }

  /**
   * Commit the typed text as the value. Text matching an option (ignoring
   * case) takes that option's value; an empty input clears the value.
   */
  function commitFreeText() {
    if (!allowFreeText) return;
    const trimmed = inputQuery.trim();
    const lower = trimmed.toLowerCase();
    const match = options.find(
      (o) => o.value.toLowerCase() === lower || o.label.toLowerCase() === lower
    );
    const next = trimmed ? (match?.value ?? trimmed) : "";
    if (next !== value) onChange(next);
    setInputQuery(next);
  }

  function handleSelect(selectedValue: string) {
    justSelectedRef.current = true;
    onChange(selectedValue);
    setInputQuery(selectedValue);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
      navigatedRef.current = true;
    }
    if (e.key === "Enter" && allowFreeText && !navigatedRef.current) {
      // cmdk always highlights the first option and selects it on Enter from
      // its root handler, after this one. Unless the user moved the highlight,
      // commit what they typed and stop cmdk from picking the first option.
      e.preventDefault();
      commitFreeText();
      justSelectedRef.current = true;
      setOpen(false);
    }
    if (e.key === "Tab" && !e.altKey && !e.ctrlKey && !e.metaKey) {
      // Radix loops focus inside the popover, so Tab would never leave the
      // input: commit, close, and move on from the trigger like a plain field.
      e.preventDefault();
      commitFreeText();
      justSelectedRef.current = true;
      tabDirectionRef.current = e.shiftKey ? -1 : 1;
      setOpen(false);
    }
    if (e.key === "Escape") {
      // Revert input to last committed value.
      cancelledRef.current = true;
      setInputQuery(value);
      setOpen(false);
    }
  }

  /** Commit free-text on blur (tabbing away). */
  function handleBlur() {
    // If a suggestion was just clicked, handleSelect already committed it.
    // Skip the free-text overwrite to avoid clobbering the prefill.
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      setTimeout(() => setOpen(false), 120);
      return;
    }
    if (cancelledRef.current) {
      setTimeout(() => setOpen(false), 120);
      return;
    }
    commitFreeText();
    // Slight delay so popover item clicks aren't cancelled by blur.
    setTimeout(() => setOpen(false), 120);
  }

  // Without an onQueryChange the caller has no way to filter, so filter here.
  const query = inputQuery.trim().toLowerCase();
  const visibleOptions =
    onQueryChange || !query
      ? options
      : options.filter((o) => o.label.toLowerCase().includes(query));

  const displayLabel =
    value
      ? (options.find((o) => o.value === value)?.label ?? value)
      : "";

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          disabled={disabled}
          onKeyDown={handleTriggerKeyDown}
          className={cn(
            "flex h-7 w-full items-center justify-between gap-1 truncate border-0 bg-transparent px-0 text-left text-sm shadow-none",
            "focus:outline-none focus-visible:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
        >
          <span className={cn("truncate", !displayLabel && "text-muted-foreground")}>
            {displayLabel || placeholder}
          </span>
          {loading ? (
            <Loader2 className="ml-auto h-3 w-3 shrink-0 animate-spin opacity-50" />
          ) : (
            <ChevronsUpDown className="ml-auto h-3 w-3 shrink-0 opacity-40" />
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[180px] p-0"
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => {
          // Focus the search input (Radix would also select its text, so a
          // character typed on the trigger would be overwritten by the next one).
          e.preventDefault();
          inputRef.current?.focus({ preventScroll: true });
        }}
        onCloseAutoFocus={(e) => {
          const direction = tabDirectionRef.current;
          tabDirectionRef.current = 0;
          if (direction === 0 || !triggerRef.current) return;
          e.preventDefault();
          focusTabbableFrom(triggerRef.current, direction);
        }}
        onEscapeKeyDown={() => {
          // Radix closes on Escape before the input sees the key.
          cancelledRef.current = true;
          setInputQuery(value);
        }}
      >
        <Command shouldFilter={false}>
          <CommandInput
            ref={inputRef}
            placeholder={placeholder}
            value={inputQuery}
            onValueChange={handleQueryChange}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
          />
          <CommandList id={listId}>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup heading={groupHeading}>
              {visibleOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={handleSelect}
                  className="flex items-center justify-between"
                >
                  <span>{option.label}</span>
                  {option.meta !== undefined && (
                    <span className="text-muted-foreground ml-2 shrink-0 text-xs">
                      {option.meta}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
