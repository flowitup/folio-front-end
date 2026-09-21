/**
 * chat-assistant-kind-i18n-parity.test.ts
 *
 * The chat channel picker labels each channel by `chat.kind.<kind>`. The backend originally
 * listed a third kind, `assistant` (a per-user assistant channel); the assistant-per-channel
 * plan retired it in favour of `admin` (the company-admins-only channel that also carries the
 * confidential finance/payroll answers). `ChatChannelKind` no longer accepts `"assistant"`, so
 * only `admin` is pinned going forward — the generic parity suite only compares the three
 * files with each other, so it would stay green if the key vanished everywhere.
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

describe("chat.kind.admin", () => {
  it.each(Object.keys(locales))("exists and is non-blank in %s", (locale) => {
    const value = locales[locale].chat.kind.admin;
    expect(typeof value).toBe("string");
    expect(value.trim().length).toBeGreaterThan(0);
  });

  it("is translated for the Vietnamese audience", () => {
    expect(locales.vi.chat.kind.admin).not.toBe(locales.en.chat.kind.admin);
  });
});
