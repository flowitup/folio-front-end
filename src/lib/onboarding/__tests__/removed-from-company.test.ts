import { describe, it, expect } from "vitest";
import type { ActivityEvent } from "@/lib/api/notifications";
import { removedFromCompanyName } from "../removed-from-company";

function event(kind: string, body: string, created_at: string): ActivityEvent {
  return { id: created_at, category: "membership", kind, title: "", body, data: {}, created_at, read: false };
}

describe("removedFromCompanyName", () => {
  it("names the company of the newest removal", () => {
    expect(
      removedFromCompanyName([
        event("company_member_removed", "Old Co", "2026-10-01T08:00:00Z"),
        event("chat_message", "hello", "2026-10-15T08:00:00Z"),
        event("company_member_removed", "QA3 Perms Co A", "2026-10-14T08:00:00Z"),
      ])
    ).toBe("QA3 Perms Co A");
  });

  it("is null without a removal event", () => {
    expect(removedFromCompanyName(undefined)).toBeNull();
    expect(removedFromCompanyName([event("project_member_removed", "Site", "2026-10-14T08:00:00Z")])).toBeNull();
  });
});
