"use client";

import { cn } from "@/lib/utils";

interface RoleColorPickerProps {
  palette: string[];
  value: string;
  onChange: (color: string) => void;
}

/**
 * RoleColorPicker — grid of color circles for selecting a role color.
 * Selected circle shows a white check mark and a ring indicator. Hex case is
 * not significant: "#e11d48" selects the "#E11D48" swatch.
 */
export function RoleColorPicker({ palette, value, onChange }: RoleColorPickerProps) {
  const selected = value.toLowerCase();
  return (
    <div className="flex flex-wrap gap-2">
      {palette.map((color) => {
        const isSelected = color.toLowerCase() === selected;
        return (
          <button
            key={color}
            type="button"
            aria-label={color}
            aria-pressed={isSelected}
            onClick={() => onChange(color)}
            className={cn(
              "h-8 w-8 rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isSelected && "ring-2 ring-offset-2 ring-primary",
            )}
            style={{ backgroundColor: color }}
          >
            {isSelected && (
              <span className="flex h-full w-full items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
