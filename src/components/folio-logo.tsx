/**
 * Folio mark — house formed from the letter F.
 * Pitched roof + vertical wall + two horizontal arms; terracotta hearth roof.
 * Wrapped in an ink-tile (--ink) by default. Pass `bare` to render the SVG only.
 */

interface FolioLogoProps {
  size?: number;
  tileSize?: number;
  className?: string;
  bare?: boolean;
}

export function FolioLogo({ size = 22, tileSize = 36, className, bare = false }: FolioLogoProps) {
  const svg = (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" aria-hidden="true">
      <path
        d="M 8 36 L 40 12 L 72 36"
        stroke="var(--accent)"
        strokeWidth="6"
        strokeLinejoin="miter"
        strokeLinecap="round"
      />
      <line x1="20" y1="28" x2="20" y2="64" stroke="var(--paper)" strokeWidth="6" strokeLinecap="round" />
      <line x1="20" y1="40" x2="60" y2="40" stroke="var(--paper)" strokeWidth="6" strokeLinecap="round" />
      <line x1="20" y1="54" x2="50" y2="54" stroke="var(--paper)" strokeWidth="6" strokeLinecap="round" />
    </svg>
  );

  if (bare) return svg;

  return (
    <div
      className={className}
      style={{
        width: tileSize,
        height: tileSize,
        background: "var(--ink)",
        borderRadius: 9,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {svg}
    </div>
  );
}
