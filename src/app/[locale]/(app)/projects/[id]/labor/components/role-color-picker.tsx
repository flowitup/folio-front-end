"use client";

import { cn } from "@/lib/utils";

interface RoleColorPickerProps {
  palette: string[];
  value: string;
  onChange: (color: string) => void;
}

/**
 * RoleColorPicker — grid of color circles for selecting a role color.
 * Selected circle shows a white check mark and a ring indicator.
 */
export function RoleColorPicker({ palette, value, onChange }: RoleColorPickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {palette.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={color}
          aria-pressed={value === color}
          onClick={() => onChange(color)}
          className={cn(
            "h-8 w-8 rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            value === color && "ring-2 ring-offset-2 ring-primary",
          )}
          style={{ backgroundColor: color }}
        >
          {value === color && (
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
      ))}
    </div>
  );
}
