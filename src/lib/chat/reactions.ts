/**
 * Emoji reactions on chat messages: the fixed set the backend accepts, the per-emoji counts
 * shown under a bubble, and the one-reaction-per-member toggle used for optimistic updates.
 */

/**
 * The six reactions the backend accepts, in display order: 👍 ❤️ 😂 😮 😢 🙏.
 * Written as escapes so the heart keeps its U+FE0F variation selector.
 */
export const REACTION_EMOJIS = [
  "\u{1F44D}",
  "❤️",
  "\u{1F602}",
  "\u{1F62E}",
  "\u{1F622}",
  "\u{1F64F}",
] as const;

export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export interface Reaction {
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface ReactionCount {
  emoji: string;
  count: number;
  /** Whether the viewer's own reaction is this emoji. */
  mine: boolean;
}

export function isReactionEmoji(value: string): value is ReactionEmoji {
  return (REACTION_EMOJIS as readonly string[]).includes(value);
}

function orderOf(emoji: string): number {
  const index = (REACTION_EMOJIS as readonly string[]).indexOf(emoji);
  return index === -1 ? REACTION_EMOJIS.length : index;
}

/** Counts per emoji in `REACTION_EMOJIS` order (unknown emojis last), zero counts omitted. */
export function aggregateReactions(
  reactions: readonly Reaction[],
  viewerId: string | null | undefined
): ReactionCount[] {
  const byEmoji = new Map<string, ReactionCount>();
  for (const reaction of reactions) {
    const entry = byEmoji.get(reaction.emoji) ?? { emoji: reaction.emoji, count: 0, mine: false };
    entry.count += 1;
    if (viewerId && reaction.user_id === viewerId) entry.mine = true;
    byEmoji.set(reaction.emoji, entry);
  }
  return [...byEmoji.values()].sort((a, b) => orderOf(a.emoji) - orderOf(b.emoji));
}

/** The viewer's current reaction on a message, if any. */
export function reactionOf(
  reactions: readonly Reaction[],
  viewerId: string | null | undefined
): string | null {
  if (!viewerId) return null;
  return reactions.find((r) => r.user_id === viewerId)?.emoji ?? null;
}

/**
 * Apply the viewer tapping `emoji`: the same emoji removes their reaction, another one replaces
 * it. Returns the next reaction list and whether the server call is a removal.
 */
export function toggleReaction(
  reactions: readonly Reaction[],
  viewerId: string,
  emoji: string,
  now: Date = new Date()
): { reactions: Reaction[]; remove: boolean } {
  const others = reactions.filter((r) => r.user_id !== viewerId);
  if (reactionOf(reactions, viewerId) === emoji) return { reactions: others, remove: true };
  return {
    reactions: [...others, { user_id: viewerId, emoji, created_at: now.toISOString() }],
    remove: false,
  };
}
