/**
 * The uploader filter never shows a phone-only account's synthetic address or
 * an erased account's placeholder: the API sends a safe label, the phone is
 * formatted, and an erased account reads as a former member ("").
 */

import { describe, it, expect } from "vitest";
import { uploaderLabel } from "../uploader-label";

describe("uploaderLabel", () => {
  it("keeps a name or a real e-mail", () => {
    expect(uploaderLabel({ user_id: "u1", display_name: "Alice Martin", phone: "+33620159001" })).toBe("Alice Martin");
    expect(uploaderLabel({ user_id: "u2", display_name: "bob@example.com", phone: null })).toBe("bob@example.com");
  });

  it("formats the phone a phone-only account with no name is labelled by", () => {
    expect(uploaderLabel({ user_id: "u3", display_name: "+33620159009", phone: "+33620159009" })).toBe(
      "+336 20 15 90 09"
    );
  });

  it("is empty for an erased account", () => {
    expect(uploaderLabel({ user_id: "u4", display_name: "", phone: null, is_deleted: true })).toBe("");
  });
});
