/**
 * article-form-quantity.test.tsx
 *
 * The quantity field used to be type="number", which Chrome parses in the OS
 * language: in an English browser a French "2,5" was saved as 25 without a
 * word. These pin that both decimal marks are read, and that text the form
 * cannot read is refused with a message instead of being guessed.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ArticleFormDialog } from "../article-form-dialog";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

function renderDialog() {
  const onSubmit = vi.fn();
  render(
    <ArticleFormDialog
      open
      article={null}
      units={[]}
      rooms={[]}
      submitting={false}
      onOpenChange={() => {}}
      onSubmit={onSubmit}
      onCreateUnit={async () => null}
      onCreateRoom={async () => null}
    />
  );
  return { onSubmit, user: userEvent.setup() };
}

async function typeItem(user: ReturnType<typeof userEvent.setup>, quantity: string) {
  await user.type(screen.getByLabelText("articleName"), "Plinthe");
  const qty = screen.getByLabelText("quantity");
  await user.clear(qty);
  await user.type(qty, quantity);
}

describe("ArticleFormDialog quantity", () => {
  it.each([
    ["2,5", "2.5"],
    ["2.5", "2.5"],
    ["1 250,125", "1250.125"],
  ])("reads %s as %s", async (typed, sent) => {
    const { onSubmit, user } = renderDialog();
    expect(screen.getByLabelText("quantity")).toHaveAttribute("type", "text");
    await typeItem(user, typed);
    await user.click(screen.getByRole("button", { name: "create" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].quantity).toBe(sent);
  });

  it("refuses text it cannot read, and says so once the field is left", async () => {
    const { onSubmit, user } = renderDialog();
    await typeItem(user, "2,5,5");
    expect(screen.queryByText("quantityInvalid")).not.toBeInTheDocument();

    await user.tab();
    expect(screen.getByText("quantityInvalid")).toBeInTheDocument();
    expect(screen.getByLabelText("quantity")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: "create" })).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("refuses more decimals than the quantity is stored with", async () => {
    const { user } = renderDialog();
    await typeItem(user, "1,2345");
    await user.tab();
    expect(screen.getByText("quantityInvalid")).toBeInTheDocument();
  });
});
