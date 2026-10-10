/**
 * TaskForm — the API's limits on labels (20, 50 characters each) and the
 * description (5,000) are enforced in the form, which names the field at fault
 * instead of a 400 that pointed the user at the title.
 */

import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import { TaskForm } from "../task-form";

function renderForm() {
  const onSubmit = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <TaskForm onSubmit={onSubmit} onCancel={vi.fn()} />
    </NextIntlClientProvider>
  );
  return { onSubmit };
}

describe("TaskForm — limits", () => {
  it("refuses a label over 50 characters and says which one, without submitting", async () => {
    const { onSubmit } = renderForm();
    const long = "x".repeat(51);
    await userEvent.type(screen.getByLabelText(en.planning.titleLabel), "Pour slab");
    // Long values set in one go: typing them key by key is slow under load.
    fireEvent.change(screen.getByLabelText(en.planning.labelsLabel), { target: { value: `ok, ${long}` } });
    await userEvent.click(screen.getByRole("button", { name: en.planning.save }));

    expect(onSubmit).not.toHaveBeenCalled();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("at most 50 characters");
    expect(alert).toHaveTextContent(long);
    expect(screen.getByLabelText(en.planning.labelsLabel)).toHaveAttribute("aria-invalid", "true");

    // Editing the labels clears the error; a valid set goes through.
    fireEvent.change(screen.getByLabelText(en.planning.labelsLabel), { target: { value: "ok, fine" } });
    expect(screen.queryByRole("alert")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: en.planning.save }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ labels: ["ok", "fine"] }));
  });

  it("counts a label's characters as the API does (an emoji is one)", async () => {
    const { onSubmit } = renderForm();
    await userEvent.type(screen.getByLabelText(en.planning.titleLabel), "Pour slab");
    const emoji = "🧱".repeat(50); // 50 characters, 100 UTF-16 units
    fireEvent.change(screen.getByLabelText(en.planning.labelsLabel), { target: { value: emoji } });
    await userEvent.click(screen.getByRole("button", { name: en.planning.save }));

    expect(screen.queryByRole("alert")).toBeNull();
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ labels: [emoji] }));
  });

  it("refuses more than 20 labels", async () => {
    const { onSubmit } = renderForm();
    await userEvent.type(screen.getByLabelText(en.planning.titleLabel), "Pour slab");
    const many = Array.from({ length: 21 }, (_, i) => `l${i}`).join(",");
    fireEvent.change(screen.getByLabelText(en.planning.labelsLabel), { target: { value: many } });
    await userEvent.click(screen.getByRole("button", { name: en.planning.save }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Use at most 20 labels.");
  });

  it("caps the description at the API's 5,000 characters", () => {
    renderForm();
    expect(screen.getByLabelText(en.planning.descriptionLabel)).toHaveAttribute("maxLength", "5000");
  });
});
