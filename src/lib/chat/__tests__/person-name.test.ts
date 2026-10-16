import { describe, expect, it } from "vitest";
import { chatPersonName, splitLinks } from "@/lib/chat/person-name";

const t = (key: string) => `chat.${key}`;

describe("chatPersonName", () => {
  it("shows the reader's own words for an erased or unnamed account", () => {
    expect(chatPersonName("Deleted account", "deleted", t)).toBe("chat.deletedAccount");
    expect(chatPersonName("Unnamed member", "unnamed", t)).toBe("chat.unnamedMember");
    expect(chatPersonName("Alice", null, t)).toBe("Alice");
    expect(chatPersonName("Alice", undefined, t)).toBe("Alice");
  });
});

describe("splitLinks", () => {
  it("cuts http(s) links out of text and leaves sentence punctuation outside", () => {
    expect(splitLinks("Plan: https://example.com/a?b=1. Merci")).toEqual([
      { text: "Plan: " },
      { text: "https://example.com/a?b=1", href: "https://example.com/a?b=1" },
      { text: ". Merci" },
    ]);
    expect(splitLinks("pas de lien")).toEqual([{ text: "pas de lien" }]);
    expect(splitLinks("javascript:alert(1)")).toEqual([{ text: "javascript:alert(1)" }]);
  });
});
