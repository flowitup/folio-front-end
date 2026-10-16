import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ActivityEventRow, pathForActivity, targetForActivity } from "../activity-event-row";
import type { ActivityEvent } from "@/lib/api/notifications";

const push = vi.fn();
const selectProject = vi.fn();
const openChat = vi.fn();
const toastError = vi.fn();
let projects = [{ id: "p1" }];

vi.mock("next-intl", () => ({
  useLocale: () => "fr",
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("sonner", () => ({ toast: { error: (...a: unknown[]) => toastError(...a) } }));
vi.mock("@/context/ProjectContext", () => ({
  useProject: () => ({ selectProject, projects, isLoading: false }),
}));
vi.mock("@/context/ChatContext", () => ({ useChat: () => ({ openChat }) }));

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

beforeEach(() => {
  push.mockClear();
  selectProject.mockClear();
  openChat.mockClear();
  toastError.mockClear();
  projects = [{ id: "p1" }];
});

describe("targetForActivity", () => {
  it("opens the task itself on the planning board", () => {
    expect(pathForActivity(make("task_moved", { project_id: "p1", task_id: "t9" }), "fr")).toBe(
      "/fr/projects/p1/planning?task=t9"
    );
    expect(pathForActivity(make("task_assigned", { project_id: "p1" }), "en")).toBe("/en/projects/p1/planning");
  });

  it("opens the task itself when the event names it", () => {
    expect(pathForActivity(make("task_moved", { project_id: "p1", task_id: "t 1" }), "fr")).toBe(
      "/fr/projects/p1/planning?task=t%201"
    );
  });

  it("opens the expense, or the expense list when it was deleted", () => {
    expect(pathForActivity(make("refund_requested", { project_id: "p1", invoice_id: "i1" }), "fr")).toBe(
      "/fr/projects/p1/invoices/i1"
    );
    expect(pathForActivity(make("invoice_created", { project_id: "p1", invoice_id: "i2" }), "fr")).toBe(
      "/fr/projects/p1/invoices/i2"
    );
    expect(pathForActivity(make("invoice_deleted", { project_id: "p1", invoice_id: "i2" }), "fr")).toBe(
      "/fr/projects/p1/invoices"
    );
  });

  it("opens labor for attendance and worker entries", () => {
    for (const kind of ["logged", "validated", "rejected", "attendance_edited", "change_applied"]) {
      expect(pathForActivity(make(kind, { project_id: "p1" }), "fr")).toBe("/fr/projects/p1/labor?tab=attendance");
    }
    expect(pathForActivity(make("worker_added", { project_id: "p1" }), "fr")).toBe("/fr/projects/p1/labor?tab=workers");
  });

  it("opens the quote or the invoice behind a billing status", () => {
    expect(pathForActivity(make("billing_status", { document_id: "d1", status: "accepted" }), "fr")).toBe(
      "/fr/billing/devis/d1"
    );
    expect(pathForActivity(make("billing_status", { document_id: "d1", status: "paid" }), "fr")).toBe(
      "/fr/billing/factures/d1"
    );
    expect(
      pathForActivity(make("billing_status", { document_id: "d1", status: "rejected", document_kind: "facture" }), "fr")
    ).toBe("/fr/billing/factures/d1");
  });

  it("opens company settings for team and role changes and reported messages", () => {
    for (const kind of [
      "member_added",
      "company_member_role_changed",
      "company_member_grants_changed",
      "chat_report",
    ]) {
      expect(pathForActivity(make(kind, { company_id: "c1" }), "fr")).toBe("/fr/settings#company");
    }
  });

  it("opens members for an accepted invitation and the dashboard for a new project", () => {
    expect(pathForActivity(make("invitation_accepted", { project_id: "p1" }), "fr")).toBe("/fr/projects/p1/members");
    expect(targetForActivity(make("project_member_added", { project_id: "p1" }), "fr")).toEqual({
      type: "path",
      path: "/fr/dashboard",
      projectId: "p1",
    });
  });

  it("opens the chat on its channel", () => {
    expect(targetForActivity(make("chat_message", { channel_key: "company:c1" }), "fr")).toEqual({
      type: "chat",
      channelKey: "company:c1",
    });
  });

  it("has nowhere to go for removals, deleted projects or missing ids", () => {
    expect(targetForActivity(make("project_member_removed", { project_id: "p1" }), "fr")).toBeNull();
    expect(targetForActivity(make("project_deleted", { company_id: "c1" }), "fr")).toBeNull();
    expect(targetForActivity(make("task_moved", {}), "fr")).toBeNull();
  });
});

describe("ActivityEventRow", () => {
  it("reports the click, selects the project and navigates", () => {
    const onOpen = vi.fn();
    const onNavigate = vi.fn();
    const item = make("task_moved", { project_id: "p1", task_id: "t1" });
    render(<ActivityEventRow item={item} onOpen={onOpen} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByText("Titre"));
    expect(onOpen).toHaveBeenCalledWith(item);
    expect(selectProject).toHaveBeenCalledWith("p1");
    expect(push).toHaveBeenCalledWith("/fr/projects/p1/planning?task=t1");
    expect(onNavigate).toHaveBeenCalled();
  });

  it("opens the chat drawer for a chat entry", () => {
    const onNavigate = vi.fn();
    render(
      <ActivityEventRow item={make("chat_message", { channel_key: "company:c1" })} onOpen={vi.fn()} onNavigate={onNavigate} />
    );
    fireEvent.click(screen.getByText("Titre"));
    expect(openChat).toHaveBeenCalledWith("company:c1");
    expect(push).not.toHaveBeenCalled();
    expect(onNavigate).toHaveBeenCalled();
  });

  it("says so instead of opening a project the viewer can no longer open", () => {
    projects = [{ id: "other" }];
    const onNavigate = vi.fn();
    render(<ActivityEventRow item={make("task_moved", { project_id: "p1" })} onOpen={vi.fn()} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByText("Titre"));
    expect(toastError).toHaveBeenCalledWith("notifications.activity.noAccess");
    expect(selectProject).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("renders an entry with nowhere to go as plain text with its own mark-read control", () => {
    const onOpen = vi.fn();
    const item = make("project_member_removed", { project_id: "p1" });
    render(<ActivityEventRow item={item} onOpen={onOpen} onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByText("Titre"));
    expect(onOpen).not.toHaveBeenCalled();
    const markRead = screen.getByRole("button", { name: "notifications.activity.markRead" });
    fireEvent.click(markRead);
    expect(onOpen).toHaveBeenCalledWith(item);
  });

  it("marks unread entries and keeps the full text in a tooltip", () => {
    render(<ActivityEventRow item={make("task_moved", { project_id: "p1" })} onOpen={vi.fn()} onNavigate={vi.fn()} />);
    const row = screen.getByRole("button");
    expect(row.getAttribute("data-unread")).toBe("true");
    expect(row.getAttribute("title")).toBe("Titre — Corps");
  });
});
