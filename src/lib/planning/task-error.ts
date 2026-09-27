import { ApiError } from "@/lib/api/http";

/** What went wrong with a task request, as a `planning.errors.*` key. */
export type TaskErrorKey = "forbidden" | "notFound" | "invalid" | "create" | "save" | "delete";

/**
 * Map a failed task request to a message key: the status says why when it
 * can (no permission, task gone, rejected input), else the action's generic
 * failure message.
 */
export function taskErrorKey(err: unknown, action: "create" | "save" | "delete"): TaskErrorKey {
  const status = err instanceof ApiError ? err.status : undefined;
  if (status === 403) return "forbidden";
  if (status === 404) return "notFound";
  if (status === 400 || status === 422) return "invalid";
  return action;
}
