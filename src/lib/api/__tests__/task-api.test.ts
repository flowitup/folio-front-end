/** Task API paths: an id is one path segment, whatever it contains. */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { get, put, patch, del, post } = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
  post: vi.fn(),
}));
vi.mock("@/lib/api/http", () => ({ api: { get, put, patch, delete: del, post } }));

import { fetchTask, updateTask, moveTask, deleteTask, fetchTasks } from "../task-api";

beforeEach(() => {
  vi.clearAllMocks();
  get.mockResolvedValue({ tasks: [] });
});

describe("task-api", () => {
  it("encodes a task id that carries path characters", async () => {
    await fetchTask("../../companies/x");
    expect(get).toHaveBeenCalledWith("/tasks/..%2F..%2Fcompanies%2Fx");
    await updateTask("a/b", {});
    expect(put.mock.calls[0][0]).toBe("/tasks/a%2Fb");
    await moveTask("a/b", {} as never);
    expect(patch.mock.calls[0][0]).toBe("/tasks/a%2Fb/move");
    await deleteTask("a/b");
    expect(del).toHaveBeenCalledWith("/tasks/a%2Fb");
  });

  it("encodes the project id of a task list", async () => {
    await fetchTasks("p/../x", "todo");
    expect(get).toHaveBeenCalledWith("/projects/p%2F..%2Fx/tasks?status=todo");
  });

  it("leaves a UUID untouched", async () => {
    await fetchTask("3f2b8c1e-9d4a-4e6b-8a57-0c1d2e3f4a5b");
    expect(get).toHaveBeenCalledWith("/tasks/3f2b8c1e-9d4a-4e6b-8a57-0c1d2e3f4a5b");
  });
});
