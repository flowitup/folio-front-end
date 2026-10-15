/**
 * KanbanBoard — `?task=` ends up in an API path, so only a task UUID selects
 * a task; anything else is no selection.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";

const { nav, drawer } = vi.hoisted(() => ({
  nav: { search: "" },
  drawer: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/en/projects/p-1/planning",
  useSearchParams: () => new URLSearchParams(nav.search),
}));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: { permissions: [] } }) }));
vi.mock("@/context/ProjectContext", () => ({ useProject: () => ({ selectedProject: null }) }));
vi.mock("@/lib/api/task-api", () => ({ fetchTasks: vi.fn(), moveTask: vi.fn() }));
vi.mock("@/components/planning/task-detail-drawer", () => ({
  TaskDetailDrawer: (props: { taskId: string | null }) => {
    drawer(props.taskId);
    return null;
  },
}));
vi.mock("@/components/planning/task-create-dialog", () => ({ TaskCreateDialog: () => null }));

import { fetchTasks } from "@/lib/api/task-api";
import { KanbanBoard } from "../kanban-board";

const TASK_ID = "3f2b8c1e-9d4a-4e6b-8a57-0c1d2e3f4a5b";

async function renderBoard(search: string) {
  nav.search = search;
  vi.mocked(fetchTasks).mockResolvedValue([]);
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <KanbanBoard projectId="p-1" />
    </NextIntlClientProvider>
  );
  await waitFor(() => expect(fetchTasks).toHaveBeenCalled());
}

beforeEach(() => {
  vi.clearAllMocks();
  drawer.mockClear();
});

describe("KanbanBoard — ?task= selection", () => {
  it("opens the drawer for a task UUID", async () => {
    await renderBoard(`task=${TASK_ID}`);
    expect(drawer).toHaveBeenLastCalledWith(TASK_ID);
  });

  it("treats a path-like value as no selection", async () => {
    await renderBoard(`task=${encodeURIComponent("../../companies/c1")}`);
    expect(drawer).toHaveBeenLastCalledWith(null);
    expect(drawer).not.toHaveBeenCalledWith("../../companies/c1");
  });
});
