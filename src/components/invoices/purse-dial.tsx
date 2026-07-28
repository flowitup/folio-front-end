"use client";

/**
 * 104px SVG progress dial for a spending purse (design "Two purses" 1b).
 * The ring fills with the spent share of released funds; the center shows the
 * remaining amount. Purely presentational — figures are passed in formatted.
 */
interface PurseDialProps {
  /** Spent share of released funds, 0–100 (already clamped by caller). */
  percent: number;
  /** Ring stroke color (CSS color, e.g. "var(--ink)" / "var(--accent)"). */
  color: string;
  /** Formatted amount shown in the dial center (remaining €, may be negative). */
  centerValue: string;
  /** Small caption under the center value (e.g. "left"). */
  centerLabel: string;
  /** Center value color override (e.g. negative/overspent state). */
  centerValueColor?: string;
  /** Tooltip payload, "label|value|meta" (see useDataTip). */
  dataTip?: string;
}

const SIZE = 104;
const RADIUS = 44;
const STROKE = 11;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function PurseDial({
  percent,
  color,
  centerValue,
  centerLabel,
  centerValueColor,
  dataTip,
}: PurseDialProps) {
  const filled = (CIRCUMFERENCE * Math.min(100, Math.max(0, percent))) / 100;
  return (
    <div className="relative flex-none" style={{ width: SIZE, height: SIZE }} data-tip={dataTip}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--paper-2)"
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${CIRCUMFERENCE}`}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-[1px]">
        <div
          className="num text-[14.5px] font-medium"
          style={{ letterSpacing: "-.02em", color: centerValueColor }}
        >
          {centerValue}
        </div>
        <div className="label-cap" style={{ fontSize: 9.5 }}>
          {centerLabel}
        </div>
      </div>
    </div>
  );
}
