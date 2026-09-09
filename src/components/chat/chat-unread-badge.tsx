"use client";

/** Accent pill with the unread count ("9+" past nine); renders nothing at zero. */
export function ChatUnreadBadge({
  count,
  className,
  testId = "chat-unread-badge",
}: {
  count: number;
  className?: string;
  testId?: string;
}) {
  if (count <= 0) return null;
  return (
    <span
      data-testid={testId}
      className={`num inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10.5px] font-bold text-white ${className ?? ""}`}
      style={{ background: "var(--accent)" }}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}
