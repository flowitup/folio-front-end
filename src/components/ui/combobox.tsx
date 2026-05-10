"use client";

/**
 * Combobox — generic typeahead with async loading and free-text support.
 *
 * Props:
 *   value / onChange — controlled string value
 *   options          — list of { value, label, meta? } to display
 *   onQueryChange    — called on every keystroke for async data loading
 *   placeholder      — input placeholder
 *   emptyText        — text shown when options list is empty (no match)
 *   allowFreeText    — default true; typed string becomes value on Enter / blur
 *   loading          — shows a subtle spinner hint while fetching
 *   disabled         — passthrough to trigger button
 *   className        — added to the trigger button
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

  // Sync inputQuery whenever the controlled value changes from the outside
  // (e.g., when parent prefills after suggestion selection).
  React.useEffect(() => {
    if (!open) {
      setInputQuery(value);
    }
  }, [value, open]);

  // On open — pre-populate the input with the current committed value so the
  // user can refine from where they left off.
  function handleOpenChange(next: boolean) {
    if (next) {
      setInputQuery(value);
      onQueryChange?.(value);
    }
    setOpen(next);
  }

  function handleQueryChange(q: string) {
    setInputQuery(q);
    onQueryChange?.(q);
  }

  function handleSelect(selectedValue: string) {
    onChange(selectedValue);
    setInputQuery(selectedValue);
    setOpen(false);
  }

  /** Commit free-text when user presses Enter with no option highlighted. */
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && allowFreeText) {
      // cmdk calls onSelect on the highlighted item first; we only reach here
      // if nothing was selected (empty list or no highlight). Confirm raw text.
      const trimmed = inputQuery.trim();
      if (trimmed) {
        onChange(trimmed);
        setOpen(false);
      }
    }
    if (e.key === "Escape") {
      // Revert input to last committed value.
      setInputQuery(value);
      setOpen(false);
    }
  }

  /** Commit free-text on blur (tabbing away). */
  function handleBlur() {
    if (allowFreeText) {
      const trimmed = inputQuery.trim();
      // Only commit if it changed from the current value.
      if (trimmed && trimmed !== value) {
        onChange(trimmed);
      } else if (!trimmed) {
        // Blank → revert to last committed value.
        setInputQuery(value);
      }
    }
    // Slight delay so popover item clicks aren't cancelled by blur.
    setTimeout(() => setOpen(false), 120);
  }

  const displayLabel =
    value
      ? (options.find((o) => o.value === value)?.label ?? value)
      : "";

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          disabled={disabled}
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
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={placeholder}
            value={inputQuery}
            onValueChange={handleQueryChange}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
          />
          <CommandList id={listId}>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup heading={groupHeading}>
              {options.map((option) => (
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
