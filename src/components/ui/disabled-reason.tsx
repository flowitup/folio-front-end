"use client";

import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface DisabledReasonProps {
  /** Why the wrapped control is unavailable; when empty the child renders as is. */
  reason?: string | null;
  children: React.ReactNode;
}

/**
 * Explains a greyed-out button. A disabled Button ignores the pointer
 * (`disabled:pointer-events-none`), so its own `title` never showed, and touch
 * screens have no hover at all. This wrapper takes the hover (title), the
 * keyboard focus and the tap, and shows the reason in a small popover; screen
 * readers get it as the description.
 */
export function DisabledReason({ reason, children }: DisabledReasonProps) {
  const id = React.useId();
  if (!reason) return <>{children}</>;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <span
          tabIndex={0}
          title={reason}
          aria-describedby={id}
          className="inline-flex cursor-not-allowed rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]"
          data-testid="disabled-reason"
        >
          {children}
          <span id={id} className="sr-only">
            {reason}
          </span>
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-auto max-w-[280px] p-2.5 text-[12.5px] leading-snug" side="top">
        {reason}
      </PopoverContent>
    </Popover>
  );
}
