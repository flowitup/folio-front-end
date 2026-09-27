import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import { ApiError } from "@/lib/api/http";

const { mockCreate, mockToast } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockToast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/api/task-api", () => ({ createTask: mockCreate }));
vi.mock("sonner", () => ({ toast: mockToast }));

import { TaskCreateDialog } from "../task-create-dialog";

describe("TaskCreateDialog", () => {
  it("keeps the dialog and the typed title when the create fails, and says why", async () => {
    mockCreate.mockRejectedValue(new ApiError("HTTP 400", 400));
    const onOpenChange = vi.fn();
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <TaskCreateDialog
          open
          projectId="p1"
          defaultStatus="todo"
          onOpenChange={onOpenChange}
          onCreated={vi.fn()}
        />
      </NextIntlClientProvider>
    );

    await userEvent.type(screen.getByLabelText(en.planning.titleLabel), "Pour slab");
    await userEvent.click(screen.getByRole("button", { name: en.planning.save }));

    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith(en.planning.errors.invalid));
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByLabelText(en.planning.titleLabel)).toHaveValue("Pour slab");
    expect(screen.getByLabelText(en.planning.titleLabel)).toHaveAttribute("maxLength", "255");
  });
});
