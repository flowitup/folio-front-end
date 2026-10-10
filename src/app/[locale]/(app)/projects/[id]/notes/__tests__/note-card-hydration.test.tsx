/**
 * NoteCard — the "Added today / yesterday" footer depends on the viewer's
 * time zone, which the server (UTC) does not share. It is rendered once
 * hydrated, so the server HTML never disagrees with the browser's first render.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { act } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { NoteCard } from "../note-card";
import type { Note } from "@/lib/api/notes";

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
  useLocale: () => "vi",
}));

const NOTE: Note = {
  id: "11111111-1111-1111-1111-111111111111",
  project_id: "proj-1",
  created_by: "user-1",
  title: "Giao hàng",
  description: null,
  category: "delivery",
  status: "open",
  // 10 Oct 01:13 in Hanoi, still 9 Oct in UTC.
  created_at: "2026-10-09T18:13:00+00:00",
  updated_at: "2026-10-09T18:13:00+00:00",
};

const savedTz = process.env.TZ;

afterEach(() => {
  vi.useRealTimers();
  if (savedTz === undefined) delete process.env.TZ;
  else process.env.TZ = savedTz;
});

describe("NoteCard — hydration", () => {
  it("hydrates a UTC server render in Hanoi without a mismatch, then says 'today'", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-10T03:00:00Z")); // 10 Oct 10:00 Hanoi

    const card = (
      <NoteCard
        note={NOTE}
        isEditing={false}
        onStartEdit={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
        onToggleDone={vi.fn()}
        canEdit={false}
      />
    );

    process.env.TZ = "UTC";
    const container = document.createElement("div");
    container.innerHTML = renderToString(card);
    document.body.appendChild(container);
    // The server knows no time zone of the viewer: no day word in its HTML.
    expect(container.textContent).not.toMatch(/notes\.added/);

    process.env.TZ = "Asia/Ho_Chi_Minh";
    const recoverable = vi.fn();
    await act(async () => {
      hydrateRoot(container, card, { onRecoverableError: recoverable });
    });

    expect(recoverable).not.toHaveBeenCalled();
    expect(container.textContent).toContain("notes.addedToday");
    container.remove();
  });
});
