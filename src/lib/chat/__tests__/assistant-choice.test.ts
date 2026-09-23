/** Pure parsing/comparison helpers for a `content_type: "choice"` message payload. */

import { describe, expect, it } from "vitest";
import { isChosenOption, parseChoicePayload } from "@/lib/chat/assistant-choice";

const rawPayload = (overrides: Record<string, unknown> = {}) => ({
  prompt: "Log today for Alice, Bob?",
  options: [
    { label: "Yes", action: "confirm_bulk_attendance", payload: { worker_ids: ["w1"] } },
    { label: "No", action: "cancel_bulk_attendance", payload: {} },
  ],
  answered: null,
  addressed_to: "user-1",
  ...overrides,
});

describe("parseChoicePayload", () => {
  it("parses a well-formed choice payload", () => {
    const parsed = parseChoicePayload(rawPayload());
    expect(parsed).toEqual({
      prompt: "Log today for Alice, Bob?",
      options: [
        { label: "Yes", action: "confirm_bulk_attendance", payload: { worker_ids: ["w1"] } },
        { label: "No", action: "cancel_bulk_attendance", payload: {} },
      ],
      answered: null,
      answeredPayload: null,
      addressedTo: "user-1",
    });
  });

  it("carries the answered action and its recorded payload once answered", () => {
    const parsed = parseChoicePayload(
      rawPayload({ answered: "confirm_bulk_attendance", answered_payload: { worker_ids: ["w1"] } })
    );
    expect(parsed?.answered).toBe("confirm_bulk_attendance");
    expect(parsed?.answeredPayload).toEqual({ worker_ids: ["w1"] });
  });

  it("returns null on a missing prompt, missing options, or a malformed option", () => {
    expect(parseChoicePayload(null)).toBeNull();
    expect(parseChoicePayload({})).toBeNull();
    expect(parseChoicePayload({ prompt: "Hi" })).toBeNull();
    expect(parseChoicePayload({ prompt: "Hi", options: [{ label: "Yes" }] })).toBeNull();
    expect(parseChoicePayload({ prompt: "Hi", options: "not-an-array" })).toBeNull();
  });

  it("defaults a missing option payload to an empty object", () => {
    const parsed = parseChoicePayload({
      prompt: "Hi",
      options: [{ label: "Yes", action: "confirm" }],
    });
    expect(parsed?.options[0].payload).toEqual({});
  });

  it("defaults addressedTo to null on an older server that never set it", () => {
    const { addressed_to: _omit, ...withoutAddressedTo } = rawPayload();
    expect(parseChoicePayload(withoutAddressedTo)?.addressedTo).toBeNull();
  });
});

describe("isChosenOption", () => {
  const options = parseChoicePayload(rawPayload())!.options;
  const [yes, no] = options;

  it("is false while unanswered", () => {
    expect(isChosenOption(yes, null, null)).toBe(false);
  });

  it("is true for the option whose action matches and no payload was recorded", () => {
    expect(isChosenOption(yes, "confirm_bulk_attendance", null)).toBe(true);
    expect(isChosenOption(no, "confirm_bulk_attendance", null)).toBe(false);
  });

  it("compares the recorded payload (key order does not matter) when two options share an action", () => {
    const setProjectA = { label: "Villa Bleue", action: "set_project", payload: { project_id: "p1", source: "x" } };
    const setProjectB = { label: "Chantier B", action: "set_project", payload: { project_id: "p2", source: "x" } };
    const recorded = { source: "x", project_id: "p1" };
    expect(isChosenOption(setProjectA, "set_project", recorded)).toBe(true);
    expect(isChosenOption(setProjectB, "set_project", recorded)).toBe(false);
  });
});
