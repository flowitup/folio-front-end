import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/http";
import { classifyProjectLoadError } from "@/lib/api/project-load";

describe("classifyProjectLoadError", () => {
  it("treats only 403/404 as not found and 401 as signed out", () => {
    expect(classifyProjectLoadError(new ApiError("x", 403)).kind).toBe("notFound");
    expect(classifyProjectLoadError(new ApiError("x", 404)).kind).toBe("notFound");
    expect(classifyProjectLoadError(new ApiError("x", 401)).kind).toBe("unauthenticated");
  });

  it("reports an outage, a timeout or a network error as an error to retry", () => {
    expect(classifyProjectLoadError(new ApiError("x", 500)).kind).toBe("error");
    expect(classifyProjectLoadError(new ApiError("x", 504)).kind).toBe("error");
    expect(classifyProjectLoadError(new Error("Network error fetching project")).kind).toBe("error");
  });
});
