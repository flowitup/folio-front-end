import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/http";
import { taskErrorKey } from "../task-error";
import { isTaskOverdue } from "../week";

describe("taskErrorKey", () => {
  it("names a rejected due date as such", () => {
    const err = new ApiError("HTTP 400", 400, {
      message: "due_date: Date must be between 2000-01-01 and 2100-12-31",
    });
    expect(taskErrorKey(err, "create")).toBe("dueDate");
  });

  it("keeps the generic 'invalid' key for other rejected input", () => {
    expect(taskErrorKey(new ApiError("HTTP 400", 400, { message: "title: too long" }), "save")).toBe("invalid");
    expect(taskErrorKey(new ApiError("HTTP 422", 422, "plain text"), "save")).toBe("invalid");
  });
});

describe("isTaskOverdue", () => {
  it("is true for an unfinished task due before today only", () => {
    expect(isTaskOverdue({ due_date: "2026-10-05", status: "todo" }, "2026-10-16")).toBe(true);
    expect(isTaskOverdue({ due_date: "2026-10-05", status: "done" }, "2026-10-16")).toBe(false);
    expect(isTaskOverdue({ due_date: "2026-10-16", status: "todo" }, "2026-10-16")).toBe(false);
    expect(isTaskOverdue({ due_date: null, status: "todo" }, "2026-10-16")).toBe(false);
  });
});
