import { describe, it, expect } from "vitest";
import {
  isPlaceholderEmail,
  userContact,
  userDisplayName,
  userInitial,
} from "../user-display";

const phoneOnly = {
  email: "phone-33699271001@no-email.folio.flowitup.com",
  phone: "+33699271001",
  display_name: null,
};

describe("user display helpers", () => {
  it("recognises the synthetic phone-only address", () => {
    expect(isPlaceholderEmail(phoneOnly.email)).toBe(true);
    expect(isPlaceholderEmail("dave@example.com")).toBe(false);
  });

  it("never shows the synthetic address for a phone-only account", () => {
    expect(userContact(phoneOnly)).toBe("+336 99 27 10 01");
    expect(userDisplayName(phoneOnly)).toBe("+336 99 27 10 01");
    expect(userInitial(phoneOnly)).toBe("·");
    expect(userDisplayName({ ...phoneOnly, display_name: "  " })).toBe("+336 99 27 10 01");
  });

  it("reads the phone out of the synthetic address when the payload has none", () => {
    expect(userContact({ email: "phone-33600000097@no-email.folio.flowitup.com" })).toBe(
      "+336 00 00 00 97"
    );
  });

  it("prefers the name, then a real e-mail", () => {
    expect(userDisplayName({ ...phoneOnly, display_name: "Paul" })).toBe("Paul");
    expect(userInitial({ ...phoneOnly, display_name: "paul" })).toBe("P");
    expect(userDisplayName({ email: "dave@example.com" })).toBe("dave@example.com");
    expect(userInitial({ email: "dave@example.com" })).toBe("D");
  });
});
