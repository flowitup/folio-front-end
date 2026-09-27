"use client";

/**
 * ImageUrlField — paste a supplier image link for the server to fetch.
 *
 * Shared by the chiffrage article image dialog and the library product
 * dialogs. Every string comes from the caller, so each feature keeps its own
 * i18n namespace.
 *
 * With `onFetch` the field shows a fetch button, and Enter fetches too (it
 * never submits a surrounding form). Without it the value is plain form state
 * the caller applies later, e.g. once the product it belongs to exists.
 */

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ImageUrlFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Muted help line under the field. */
  note?: string;
  /** Inline error under the field; also marks the input invalid. */
  error?: string | null;
  disabled?: boolean;
  /** Fetch button label — required with `onFetch`. */
  fetchLabel?: string;
  onFetch?: () => void | Promise<void>;
  /** A fetch is in flight: spinner on the button, field locked. */
  fetching?: boolean;
}

export function ImageUrlField({
  id,
  label,
  value,
  onChange,
  placeholder,
  note,
  error,
  disabled = false,
  fetchLabel,
  onFetch,
  fetching = false,
}: ImageUrlFieldProps) {
  const locked = disabled || fetching;
  const canFetch = !!onFetch && !locked && value.trim().length > 0;
  const errorId = `${id}-error`;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          type="url"
          inputMode="url"
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          disabled={locked}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter" || !onFetch) return;
            e.preventDefault();
            if (canFetch) void onFetch();
          }}
        />
        {onFetch ? (
          <Button type="button" disabled={!canFetch} onClick={() => void onFetch()}>
            {fetching ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {fetchLabel}
          </Button>
        ) : null}
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}
