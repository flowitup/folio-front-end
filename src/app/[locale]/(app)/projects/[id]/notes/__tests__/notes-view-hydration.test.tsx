/**
 * NotesView — the Today / Yesterday sections follow the viewer's calendar
 * day, which the server (UTC) does not share. The server HTML carries no day
 * section, so hydrating it in Paris just after midnight cannot mismatch; the
 * sections appear once hydrated, on the Paris day.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { act } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { NotesView } from "../notes-view";
import type { Note } from "@/lib/api/notes";

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
  useLocale: () => "fr",
}));

vi.mock("../actions", () => ({
  createNoteAction: vi.fn(),
  updateNoteAction: vi.fn(),
  deleteNoteAction: vi.fn(),
}));

const NOTE: Note = {
  id: "11111111-1111-1111-1111-111111111111",
  project_id: "proj-1",
  created_by: "user-1",
  title: "Livraison",
  description: null,
  category: "delivery",
  status: "open",
  // Fri 9 Oct 20:58 in Paris.
  created_at: "2026-10-09T18:58:00+00:00",
  updated_at: "2026-10-09T18:58:00+00:00",
};

const savedTz = process.env.TZ;

afterEach(() => {
  vi.useRealTimers();
  if (savedTz === undefined) delete process.env.TZ;
  else process.env.TZ = savedTz;
});

describe("NotesView — day sections and hydration", () => {
  it("files a note from yesterday evening under Yesterday at 00:30 Paris, without a mismatch", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-09T22:30:00Z")); // Sat 10 Oct 00:30 Paris, still 9 Oct in UTC

    const view = <NotesView projectId="proj-1" initialNotes={[NOTE]} canEdit={false} />;

    process.env.TZ = "UTC";
    const container = document.createElement("div");
    container.innerHTML = renderToString(view);
    document.body.appendChild(container);
    // The server does not know the viewer's day: no section heading in its HTML.
    expect(container.textContent).not.toMatch(/notes\.groups\./);
    expect(container.textContent).toContain("Livraison");

    process.env.TZ = "Europe/Paris";
    const recoverable = vi.fn();
    await act(async () => {
      hydrateRoot(container, view, { onRecoverableError: recoverable });
    });

    expect(recoverable).not.toHaveBeenCalled();
    expect(container.querySelector("h2")?.textContent).toBe("notes.groups.yesterday");
    container.remove();
  });
});
