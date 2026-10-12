import { describe, expect, it } from "vitest";
import {
  aggregateReactions,
  isReactionEmoji,
  REACTION_EMOJIS,
  reactionOf,
  toggleReaction,
} from "@/lib/chat/reactions";

const r = (user_id: string, emoji: string) => ({ user_id, emoji, created_at: "2026-10-12T09:00:00Z" });

describe("REACTION_EMOJIS", () => {
  it("is the fixed set with the heart carrying its variation selector", () => {
    expect(REACTION_EMOJIS.map((e) => [...e].map((c) => c.codePointAt(0)!.toString(16)))).toEqual([
      ["1f44d"],
      ["2764", "fe0f"],
      ["1f602"],
      ["1f62e"],
      ["1f622"],
      ["1f64f"],
    ]);
    expect(isReactionEmoji("❤️")).toBe(true);
    expect(isReactionEmoji("❤")).toBe(false);
  });
});

describe("aggregateReactions", () => {
  const [thumbs, heart, laugh] = REACTION_EMOJIS;

  it("counts per emoji in display order and flags the viewer's own", () => {
    const counts = aggregateReactions([r("a", laugh), r("me", thumbs), r("b", laugh), r("c", heart)], "me");
    expect(counts).toEqual([
      { emoji: thumbs, count: 1, mine: true },
      { emoji: heart, count: 1, mine: false },
      { emoji: laugh, count: 2, mine: false },
    ]);
  });

  it("returns nothing for no reactions and never flags without a viewer", () => {
    expect(aggregateReactions([], "me")).toEqual([]);
    expect(aggregateReactions([r("me", thumbs)], null)[0].mine).toBe(false);
  });

  it("puts an unknown emoji after the fixed set", () => {
    expect(aggregateReactions([r("a", "🔥"), r("b", heart)], "me").map((c) => c.emoji)).toEqual([heart, "🔥"]);
  });
});

describe("toggleReaction", () => {
  const [thumbs, heart] = REACTION_EMOJIS;
  const now = new Date("2026-10-12T10:00:00Z");

  it("adds the viewer's reaction when they have none", () => {
    const next = toggleReaction([r("a", heart)], "me", thumbs, now);
    expect(next.remove).toBe(false);
    expect(next.reactions).toEqual([r("a", heart), { user_id: "me", emoji: thumbs, created_at: now.toISOString() }]);
  });

  it("replaces the viewer's reaction with another emoji (one per member)", () => {
    const next = toggleReaction([r("me", thumbs), r("a", heart)], "me", heart, now);
    expect(next.remove).toBe(false);
    expect(next.reactions.filter((x) => x.user_id === "me").map((x) => x.emoji)).toEqual([heart]);
    expect(next.reactions).toHaveLength(2);
  });

  it("removes the viewer's reaction when tapping the same emoji", () => {
    const next = toggleReaction([r("me", thumbs), r("a", thumbs)], "me", thumbs, now);
    expect(next).toEqual({ reactions: [r("a", thumbs)], remove: true });
  });

  it("reads the viewer's reaction", () => {
    expect(reactionOf([r("a", heart), r("me", thumbs)], "me")).toBe(thumbs);
    expect(reactionOf([r("a", heart)], "me")).toBeNull();
    expect(reactionOf([r("a", heart)], undefined)).toBeNull();
  });
});
