import { describe, expect, it } from "vitest";
import { parseLabels } from "../task-form";

describe("parseLabels", () => {
  it("trims, drops empty entries and keeps the first spelling of a repeat, ignoring case", () => {
    expect(parseLabels(" Électricité, électricité ,, a, A ,dup, dup")).toEqual(["Électricité", "a", "dup"]);
  });

  it("returns nothing for an empty field", () => {
    expect(parseLabels(" , ")).toEqual([]);
  });
});
