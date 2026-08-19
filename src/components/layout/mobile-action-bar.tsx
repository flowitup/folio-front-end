"use client";

import { Plus } from "lucide-react";

interface MobileActionBarProps {
  /** Visible label, already translated. */
  label: string;
  onAction: () => void;
}

/**
 * The page's primary verb, pinned above the bottom nav on mobile.
 *
 * On desktop the same action lives in the Topbar's top-right corner, which is
 * the hardest place to reach one-handed on a phone. This renders the identical
 * handler at the bottom of the viewport instead; the Topbar hides its own
 * button below `lg` so the action is never presented twice.
 *
 * Fixed rather than sticky so it never participates in page layout — the
 * `(app)` layout reserves the matching bottom padding on <main>.
 */
export function MobileActionBar({ label, onAction }: MobileActionBarProps) {
  return (
    <div className="mobile-action-bar lg:hidden" data-testid="mobile-action-bar">
      <button
        type="button"
        className="btn btn-accent"
        onClick={onAction}
        aria-label={label}
      >
        <Plus size={16} />
        {label}
      </button>
    </div>
  );
}
