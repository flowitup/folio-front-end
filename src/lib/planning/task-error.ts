import { ApiError } from "@/lib/api/http";

/** What went wrong with a task request, as a `planning.errors.*` key. */
export type TaskErrorKey =
  | "forbidden"
  | "notFound"
  | "invalid"
  | "dueDate"
  | "create"
  | "save"
  | "delete";

/** The API's `message` (or `error`) on a rejected request, when it sent one. */
function apiMessage(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const d = data as { message?: unknown; error?: unknown };
  if (typeof d.message === "string") return d.message;
  return typeof d.error === "string" ? d.error : "";
}

/**
 * Map a failed task request to a message key: the status says why when it
 * can (no permission, task gone, rejected input), else the action's generic
 * failure message.
 */
export function taskErrorKey(err: unknown, action: "create" | "save" | "delete"): TaskErrorKey {
  const status = err instanceof ApiError ? err.status : undefined;
  if (status === 403) return "forbidden";
  if (status === 404) return "notFound";
  if (status === 400 || status === 422) {
    // A due date outside 2000–2100 (a mistyped year) is named as such, not
    // as a title/description/labels problem.
    if (err instanceof ApiError && apiMessage(err.data).trim().startsWith("due_date")) return "dueDate";
    return "invalid";
  }
  return action;
}
