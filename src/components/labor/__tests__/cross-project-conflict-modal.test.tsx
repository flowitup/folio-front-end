/**
 * Tests for CrossProjectConflictModal (Phase 4 — cook 4e).
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CrossProjectConflictModal } from "../cross-project-conflict-modal";
import type { ConflictGroup } from "@/types/labor";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const groups: ConflictGroup[] = [
  {
    person_id: "p1",
    person_name: "Hugo Martin",
    entries: [
      {
        project_id: "alpha",
        project_name: "Project Alpha",
        shift_type: "half",
        supplement_hours: 0,
      },
    ],
  },
  {
    person_id: "p2",
    person_name: "Léo Dupont",
    entries: [
      {
        project_id: "beta",
        project_name: "Project Beta",
        shift_type: null,
        supplement_hours: 4,
      },
    ],
  },
];

function renderModal(overrides = {}) {
  const onCancel = vi.fn();
  const onConfirm = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <CrossProjectConflictModal
      open
      onOpenChange={onOpenChange}
      groups={groups}
      onCancel={onCancel}
      onConfirm={onConfirm}
      {...overrides}
    />,
  );
  return { onCancel, onConfirm, onOpenChange };
}

describe("CrossProjectConflictModal", () => {
  it("lists every conflicting person", () => {
    renderModal();
    expect(screen.getByText("Hugo Martin")).toBeInTheDocument();
    expect(screen.getByText("Léo Dupont")).toBeInTheDocument();
  });

  it("renders other-project name + shift label for each entry", () => {
    renderModal();
    expect(
      screen.getByText(/Project Alpha — shiftHalf/),
    ).toBeInTheDocument();
  });

  it("shows supplement-only label + hours when shift is null", () => {
    renderModal();
    expect(
      screen.getByText(/Project Beta — supplement\.standaloneShiftLabel/),
    ).toBeInTheDocument();
    expect(screen.getByText(/\+4h/)).toBeInTheDocument();
  });

  it("calls onCancel when the cancel button is clicked", () => {
    const { onCancel } = renderModal();
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onConfirm when 'Continue anyway' is clicked", () => {
    const { onConfirm } = renderModal();
    fireEvent.click(screen.getByRole("button", { name: /continueAnyway/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("disables both buttons when isSaving=true", () => {
    renderModal({ isSaving: true });
    expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /continueAnyway/i }),
    ).toBeDisabled();
  });
});
