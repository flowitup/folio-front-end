/**
 * chat-assistant-kind-i18n-parity.test.ts
 *
 * The chat channel picker labels each channel by `chat.kind.<kind>`; the backend now lists
 * a third kind, `assistant`. The generic parity suite only compares the three files with
 * each other, so it would stay green if the key vanished everywhere — pin it explicitly.
 */

import { describe, it, expect } from "vitest";

import en from "../en.json";
import fr from "../fr.json";
import vi from "../vi.json";

type Messages = { chat: { kind: Record<string, string> } };

const locales: Record<string, Messages> = {
  en: en as unknown as Messages,
  fr: fr as unknown as Messages,
  vi: vi as unknown as Messages,
};

describe("chat.kind.assistant", () => {
  it.each(Object.keys(locales))("exists and is non-blank in %s", (locale) => {
    const value = locales[locale].chat.kind.assistant;
    expect(typeof value).toBe("string");
    expect(value.trim().length).toBeGreaterThan(0);
  });

  it("is translated for the Vietnamese audience", () => {
    expect(locales.vi.chat.kind.assistant).not.toBe(locales.en.chat.kind.assistant);
  });
});
