/**
 * TruncatedStamp — a `.stamp` pill whose text is clipped with an ellipsis past
 * `className`'s max width, the full text showing on hover. `.stamp` is
 * inline-flex, so `truncate` on the pill itself clips hard without an ellipsis:
 * the text sits in an inner block that can shrink instead.
 */
export function TruncatedStamp({ label, className }: { label: string; className?: string }) {
  return (
    <span className={className ? `stamp ${className}` : "stamp"} title={label}>
      <span className="truncate min-w-0">{label}</span>
    </span>
  );
}
