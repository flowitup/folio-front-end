import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ActivityEventRow, pathForActivity } from "../activity-event-row";
import type { ActivityEvent } from "@/lib/api/notifications";

const push = vi.fn();
const selectProject = vi.fn();

vi.mock("next-intl", () => ({ useLocale: () => "fr" }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/context/ProjectContext", () => ({ useProject: () => ({ selectProject }) }));

function make(kind: string, data: Record<string, string>, read = false): ActivityEvent {
  return {
    id: "e1",
    category: "tasks",
    kind,
    title: "Titre",
    body: "Corps",
    data: { kind, ...data },
    created_at: "2026-10-10T10:00:00Z",
    read,
  };
}

describe("pathForActivity", () => {
  it("opens planning for a task", () => {
    expect(pathForActivity(make("task_moved", { project_id: "p1" }), "fr")).toBe("/fr/projects/p1/planning");
    expect(pathForActivity(make("task_assigned", { project_id: "p1" }), "en")).toBe("/en/projects/p1/planning");
  });

  it("opens the task itself when the event names it", () => {
    expect(pathForActivity(make("task_moved", { project_id: "p1", task_id: "t 1" }), "fr")).toBe(
      "/fr/projects/p1/planning?task=t%201"
    );
  });

  it("opens the invoice behind a refund", () => {
    expect(
      pathForActivity(make("refund_requested", { project_id: "p1", invoice_id: "i1" }), "fr")
    ).toBe("/fr/projects/p1/invoices/i1");
  });

  it("opens members for an accepted invitation", () => {
    expect(pathForActivity(make("invitation_accepted", { project_id: "p1" }), "fr")).toBe(
      "/fr/projects/p1/members"
    );
  });

  it("has no page for chat or when the project is unknown", () => {
    expect(pathForActivity(make("chat_message", { channel_key: "company:c1" }), "fr")).toBeNull();
    expect(pathForActivity(make("task_moved", {}), "fr")).toBeNull();
  });
});

describe("ActivityEventRow", () => {
  it("reports the click, selects the project and navigates", () => {
    const onOpen = vi.fn();
    const onNavigate = vi.fn();
    const item = make("task_moved", { project_id: "p1" });
    render(<ActivityEventRow item={item} onOpen={onOpen} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByText("Titre"));
    expect(onOpen).toHaveBeenCalledWith(item);
    expect(selectProject).toHaveBeenCalledWith("p1");
    expect(push).toHaveBeenCalledWith("/fr/projects/p1/planning");
    expect(onNavigate).toHaveBeenCalled();
  });

  it("stays in the bell for an entry without a page", () => {
    push.mockClear();
    const onNavigate = vi.fn();
    render(
      <ActivityEventRow
        item={make("chat_message", { channel_key: "company:c1" })}
        onOpen={vi.fn()}
        onNavigate={onNavigate}
      />
    );
    fireEvent.click(screen.getByText("Titre"));
    expect(push).not.toHaveBeenCalled();
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("marks unread entries", () => {
    render(<ActivityEventRow item={make("task_moved", {})} onOpen={vi.fn()} onNavigate={vi.fn()} />);
    expect(screen.getByRole("button").getAttribute("data-unread")).toBe("true");
  });
});
