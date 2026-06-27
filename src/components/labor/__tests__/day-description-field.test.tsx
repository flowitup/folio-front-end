/**
 * Tests for DayDescriptionField — inline per-day description.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { DayDescriptionField } from "../day-description-field";

// Mock next-intl — returns key as fallback
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

// Mock lucide-react icons used in DayDescriptionField
vi.mock("lucide-react", () => ({
  FileText: () => <span data-testid="file-text-icon" />,
}));

const DATE = "2026-04-28";

describe("DayDescriptionField", () => {
  describe("Read-only mode (!canManage || !onSave)", () => {
    it("renders nothing when value is empty and not editable", () => {
      const { container } = render(
        <DayDescriptionField date={DATE} value="" canManage={false} />,
      );
      expect(container.firstChild).toBeNull();
    });

    it("renders the description text when value is non-empty", () => {
      render(
        <DayDescriptionField
          date={DATE}
          value="Concreting the foundation"
          canManage={false}
        />,
      );
      expect(screen.getByText("Concreting the foundation")).toBeDefined();
    });

    it("renders nothing when canManage=true but onSave is not provided", () => {
      const { container } = render(
        <DayDescriptionField date={DATE} value="" canManage={true} />,
      );
      expect(container.firstChild).toBeNull();
    });
  });

  describe("Editable mode (canManage + onSave)", () => {
    it("renders a textarea seeded with the current value", () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      render(
        <DayDescriptionField
          date={DATE}
          value="Initial text"
          canManage={true}
          onSave={onSave}
        />,
      );
      const textarea = screen.getByRole<HTMLTextAreaElement>("textbox");
      expect(textarea.value).toBe("Initial text");
    });

    it("shows the label key via i18n", () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      render(
        <DayDescriptionField date={DATE} value="" canManage={true} onSave={onSave} />,
      );
      expect(screen.getByText("label")).toBeDefined();
    });

    it("does NOT call onSave on blur when the value has not changed", async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      render(
        <DayDescriptionField
          date={DATE}
          value="Same text"
          canManage={true}
          onSave={onSave}
        />,
      );
      const textarea = screen.getByRole("textbox");
      await act(async () => {
        fireEvent.blur(textarea);
      });
      expect(onSave).not.toHaveBeenCalled();
    });

    it("calls onSave on blur when the value changed", async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      render(
        <DayDescriptionField
          date={DATE}
          value="Old value"
          canManage={true}
          onSave={onSave}
        />,
      );
      const textarea = screen.getByRole("textbox");
      fireEvent.change(textarea, { target: { value: "New value" } });
      await act(async () => {
        fireEvent.blur(textarea);
      });
      expect(onSave).toHaveBeenCalledOnce();
      expect(onSave).toHaveBeenCalledWith(DATE, "New value");
    });

    it("calls onSave with trimmed value", async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      render(
        <DayDescriptionField
          date={DATE}
          value=""
          canManage={true}
          onSave={onSave}
        />,
      );
      const textarea = screen.getByRole("textbox");
      fireEvent.change(textarea, { target: { value: "  spaced  " } });
      await act(async () => {
        fireEvent.blur(textarea);
      });
      expect(onSave).toHaveBeenCalledWith(DATE, "spaced");
    });

    it("syncs draft when the value prop changes externally", () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      const { rerender } = render(
        <DayDescriptionField
          date={DATE}
          value="v1"
          canManage={true}
          onSave={onSave}
        />,
      );
      rerender(
        <DayDescriptionField
          date={DATE}
          value="v2"
          canManage={true}
          onSave={onSave}
        />,
      );
      const textarea = screen.getByRole<HTMLTextAreaElement>("textbox");
      expect(textarea.value).toBe("v2");
    });
  });
});
