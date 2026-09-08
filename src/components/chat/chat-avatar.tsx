"use client";

import { initialsOf, senderColor } from "@/lib/chat/sender-color";

/** Initials disc coloured by user id; `size` in px. */
export function ChatAvatar({
  userId,
  name,
  size = 28,
  className,
}: {
  userId: string;
  name: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex flex-shrink-0 select-none items-center justify-center rounded-full font-semibold text-white ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, Math.round(size * 0.4)),
        background: senderColor(userId),
      }}
      title={name}
      aria-hidden="true"
    >
      {initialsOf(name)}
    </span>
  );
}
