import { describe, expect, it } from "vitest";
import { seenByMessage } from "@/lib/chat/seen-by";

const msg = (id: string, created_at: string, sender_id: string) => ({ id, created_at, sender_id });

describe("seenByMessage", () => {
  const messages = [
    msg("m1", "2026-09-08T10:00:00Z", "alice"),
    msg("m2", "2026-09-08T10:05:00Z", "me"),
    msg("m3", "2026-09-08T10:10:00Z", "alice"),
  ];

  it("places each member under the newest message at or before their read marker", () => {
    const members = [
      { id: "alice", name: "Alice", last_read_at: "2026-09-08T10:06:00Z" },
      { id: "bob", name: "Bob", last_read_at: "2026-09-08T10:20:00Z" },
    ];
    const seen = seenByMessage(messages, members, "me");
    expect(seen.get("m2")?.map((m) => m.id)).toEqual(["alice"]);
    expect(seen.get("m3")?.map((m) => m.id)).toEqual(["bob"]);
  });

  it("skips the viewer, members without a marker, and a member's own message", () => {
    const members = [
      { id: "me", name: "Me", last_read_at: "2026-09-08T11:00:00Z" },
      { id: "carol", name: "Carol", last_read_at: null },
      { id: "alice", name: "Alice", last_read_at: "2026-09-08T10:10:00Z" }, // lands on her own m3
    ];
    const seen = seenByMessage(messages, members, "me");
    expect(seen.size).toBe(0);
  });

  it("returns an empty map for an empty thread", () => {
    expect(seenByMessage([], [{ id: "a", name: "A", last_read_at: "2026-09-08T10:00:00Z" }], "me").size).toBe(0);
  });
});
