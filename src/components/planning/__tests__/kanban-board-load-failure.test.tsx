/**
 * KanbanBoard — a failed first load is one clear state: the error replaces
 * the board instead of sitting above an empty kanban whose "+" buttons can
 * only fail. A project the caller cannot open says so.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import { ApiError } from "@/lib/api/http";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/en/projects/p-1/planning",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: { permissions: [] } }) }));
vi.mock("@/context/ProjectContext", () => ({ useProject: () => ({ selectedProject: null }) }));
vi.mock("@/lib/api/task-api", () => ({ fetchTasks: vi.fn(), moveTask: vi.fn() }));
vi.mock("@/components/planning/task-detail-drawer", () => ({ TaskDetailDrawer: () => null }));
vi.mock("@/components/planning/task-create-dialog", () => ({ TaskCreateDialog: () => null }));

import { fetchTasks } from "@/lib/api/task-api";
import { KanbanBoard } from "../kanban-board";

const mockFetchTasks = vi.mocked(fetchTasks);

function renderBoard() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <KanbanBoard projectId="p-1" />
    </NextIntlClientProvider>
  );
}

beforeEach(() => vi.clearAllMocks());

describe("KanbanBoard — failed load", () => {
  it("says the project is out of reach instead of drawing an empty board", async () => {
    mockFetchTasks.mockRejectedValue(new ApiError("HTTP 403: FORBIDDEN", 403, { error: "Forbidden" }));
    renderBoard();

    await waitFor(() => expect(screen.getByText(en.planning.loadForbidden)).toBeInTheDocument());
    expect(screen.queryByText(en.planning.column.todo)).toBeNull();
    expect(screen.queryByRole("button", { name: en.planning.addTask })).toBeNull();
  });

  it("shows the generic load error, still without the board, on a server failure", async () => {
    mockFetchTasks.mockRejectedValue(new ApiError("HTTP 500: INTERNAL SERVER ERROR", 500, {}));
    renderBoard();

    await waitFor(() => expect(screen.getByText(en.planning.loadError)).toBeInTheDocument());
    expect(screen.queryByText(en.planning.column.todo)).toBeNull();
  });

  it("draws the board once the tasks load", async () => {
    mockFetchTasks.mockResolvedValue([]);
    renderBoard();

    await waitFor(() => expect(screen.getByText(en.planning.column.todo)).toBeInTheDocument());
    expect(screen.queryByText(en.planning.loadError)).toBeNull();
  });
});
