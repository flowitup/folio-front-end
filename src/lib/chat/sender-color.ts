/** Stable avatar colour per user id, cycling the Folio earth palette (same idea as the mobile app). */
const SENDER_PALETTE = ["#b8845f", "#5a7a4a", "#8a5836", "#6b7b8c", "#9a7bb0", "#c47a3c"];

export function senderColor(userId: string): string {
  let hash = 0;
  for (const char of userId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return SENDER_PALETTE[hash % SENDER_PALETTE.length];
}

/** Up to two initials from a display name ("Nguyễn Văn A" → "NA"). Code-point safe. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = Array.from(parts[0])[0] ?? "";
  const last = parts.length > 1 ? (Array.from(parts[parts.length - 1])[0] ?? "") : "";
  return (first + last).toUpperCase();
}
