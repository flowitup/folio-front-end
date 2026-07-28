"use client";

/**
 * PaymentMethodSelect — wraps the generic Combobox for payment method selection.
 *
 * Behaviour:
 *  - Lazy-fetches the list on first open (not on mount) to avoid eager fetches.
 *  - Refetches on every open so the list stays fresh after Settings edits.
 *  - If `allowCreate` is true (default), a "+ Add …" footer item lets the user
 *    POST a new method inline, then auto-selects the new entry.
 *  - Selecting the "(None)" sentinel clears the value (calls onChange(null)).
 */

import * as React from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
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
import { ChevronsUpDown, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  listPaymentMethodsAction,
  createPaymentMethodAction,
} from "@/app/[locale]/(app)/settings/companies/[id]/_actions/payment-methods-actions";
import { localizeMethodLabel } from "@/lib/payment-methods/localize-method-label";
import type { PaymentMethod } from "@/lib/api/payment-methods-api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PaymentMethodSelectProps {
  companyId: string;
  value: string | null;
  onChange: (id: string | null) => void;
  /** Show the "+ Add new" inline-create affordance. Defaults to true. */
  allowCreate?: boolean;
  disabled?: boolean;
  className?: string;
  /**
   * Optional caller-provided label snapshot for `value`, shown as the trigger
   * label while the methods list hasn't been fetched yet (it lazy-loads on
   * first popover open). Without this, a pre-set `value` renders the muted
   * placeholder until the user opens the popover, making an already-attributed
   * row look unattributed. Once the list loads, the fetched label takes over.
   */
  fallbackSelectedLabel?: string | null;
}

// Sentinel value used to signal "clear the selection"
const NONE_VALUE = "__none__";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PaymentMethodSelect({
  companyId,
  value,
  onChange,
  allowCreate = true,
  disabled = false,
  className,
  fallbackSelectedLabel,
}: PaymentMethodSelectProps) {
  const t = useTranslations("invoices.paymentMethod");
  const tBuiltins = useTranslations("paymentMethods.builtins");

  const [open, setOpen] = React.useState(false);
  const [methods, setMethods] = React.useState<PaymentMethod[]>([]);
  const [loadState, setLoadState] = React.useState<"idle" | "loading" | "done" | "error">("idle");
  const [creating, setCreating] = React.useState(false);
  const [query, setQuery] = React.useState("");

  // Display label for the trigger button (localized for built-ins)
  const selectedLabel = React.useMemo(() => {
    if (!value) return null;
    const raw = methods.find((m) => m.id === value)?.label ?? null;
    if (raw) return localizeMethodLabel(raw, tBuiltins);
    // Methods list hasn't been fetched yet (lazy-loads on first open) — show the
    // caller-provided snapshot instead of falling through to the placeholder.
    if (loadState === "idle" && fallbackSelectedLabel) {
      return localizeMethodLabel(fallbackSelectedLabel, tBuiltins);
    }
    return null;
  }, [value, methods, tBuiltins, loadState, fallbackSelectedLabel]);

  // -------------------------------------------------------------------------
  // Fetch on open
  // -------------------------------------------------------------------------

  const fetchMethods = React.useCallback(async () => {
    setLoadState("loading");
    try {
      const result = await listPaymentMethodsAction(companyId);
      if (result.ok) {
        setMethods(result.data);
        setLoadState("done");
      } else {
        setLoadState("error");
        toast.error(t("failedToLoad"));
      }
    } catch {
      setLoadState("error");
      toast.error(t("failedToLoad"));
    }
  }, [companyId, t]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      // Refetch every open so the list is fresh after Settings edits
      setQuery("");
      fetchMethods();
    }
  }

  // -------------------------------------------------------------------------
  // Inline create
  // -------------------------------------------------------------------------

  async function handleCreate(label: string) {
    if (!label.trim()) return;
    setCreating(true);
    try {
      const result = await createPaymentMethodAction(companyId, label.trim());
      if (result.ok) {
        setMethods(result.data);
        // Find the newly created method (matches label, pick last created)
        const created = result.data.find(
          (m) => m.label.toLowerCase() === label.trim().toLowerCase()
        );
        if (created) {
          onChange(created.id);
          toast.success(created.label);
        }
      } else {
        const msg =
          result.error.code === "duplicate_label"
            ? t("failedToLoad")
            : result.error.message;
        toast.error(msg);
      }
    } catch {
      toast.error(t("failedToCreate"));
    } finally {
      setCreating(false);
      setOpen(false);
    }
  }

  // -------------------------------------------------------------------------
  // Filtered options
  // -------------------------------------------------------------------------

  // Filter against BOTH the raw label (canonical, e.g. "Cash") and the
  // localized version (e.g. "Espèces" in fr) so users can type in either.
  const filteredMethods = React.useMemo(() => {
    if (!query.trim()) return methods;
    const q = query.toLowerCase();
    return methods.filter((m) => {
      const raw = m.label.toLowerCase();
      const localized = localizeMethodLabel(m.label, tBuiltins).toLowerCase();
      return raw.includes(q) || localized.includes(q);
    });
  }, [methods, query, tBuiltins]);

  // Whether the typed query exactly matches an existing option (raw or localized)
  const exactMatch = methods.some((m) => {
    const q = query.trim().toLowerCase();
    return (
      m.label.toLowerCase() === q ||
      localizeMethodLabel(m.label, tBuiltins).toLowerCase() === q
    );
  });

  const showCreateOption =
    allowCreate && query.trim().length > 0 && !exactMatch && !creating;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const isLoading = loadState === "loading";

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls="payment-method-listbox"
          disabled={disabled}
          className={cn(
            "flex h-9 w-full items-center justify-between gap-1 truncate rounded-md border bg-background px-3 py-2 text-left text-sm shadow-sm",
            "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            !selectedLabel && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">
            {selectedLabel ?? t("placeholder")}
          </span>
          {isLoading || creating ? (
            <Loader2 className="ml-auto h-4 w-4 shrink-0 animate-spin opacity-50" />
          ) : (
            <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-40" />
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[200px] p-0"
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t("placeholder")}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {isLoading && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}

            {!isLoading && loadState === "error" && (
              <CommandEmpty>{t("failedToLoadRetry")}</CommandEmpty>
            )}

            {!isLoading && loadState !== "error" && (
              <>
                {/* (None) option to clear selection */}
                <CommandGroup>
                  <CommandItem
                    value={NONE_VALUE}
                    onSelect={() => {
                      onChange(null);
                      setOpen(false);
                    }}
                    className="text-muted-foreground"
                  >
                    {t("none")}
                  </CommandItem>
                </CommandGroup>

                <CommandSeparator />

                <CommandGroup heading={t("label")}>
                  {filteredMethods.length === 0 && !showCreateOption && (
                    <CommandEmpty>{t("noMethodsFound")}</CommandEmpty>
                  )}
                  {filteredMethods.map((m) => (
                    <CommandItem
                      key={m.id}
                      value={m.id}
                      onSelect={() => {
                        onChange(m.id);
                        setOpen(false);
                      }}
                    >
                      {localizeMethodLabel(m.label, tBuiltins)}
                    </CommandItem>
                  ))}
                </CommandGroup>

                {showCreateOption && (
                  <>
                    <CommandSeparator />
                    <CommandGroup>
                      <CommandItem
                        value={`__create__${query}`}
                        onSelect={() => handleCreate(query)}
                        className="text-primary font-medium"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        {t("addInline", { name: query.trim() })}
                      </CommandItem>
                    </CommandGroup>
                  </>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
