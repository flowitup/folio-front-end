import React from "react";

interface BadgeSuccessProps {
  content?: string;
}

export function BadgeSuccess({ content = "complete" }: BadgeSuccessProps) {
  return (
    <div className="flex items-center rounded-[6px] bg-[var(--accent-light)] px-[10px] py-[4px]">
      <span className="font-outfit text-[11px] font-semibold text-[var(--accent-green)]">
        {content}
      </span>
    </div>
  );
}
