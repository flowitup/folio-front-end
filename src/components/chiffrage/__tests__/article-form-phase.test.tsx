/**
 * The stage (giai đoạn) picker of the item form: a new item starts in the
 * stage the list is filtered on, and posts without stages send no phase_id
 * (older backends refused the unknown field).
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ArticleFormDialog } from "../article-form-dialog";
import type { ChiffragePhase } from "@/lib/api/chiffrage";

vi.mock("next-intl", () => ({
  useLocale: () => "fr",
  useTranslations: () => (key: string) => key,
}));

const PHASES: ChiffragePhase[] = [
  { id: "g1", name: "Gaines", position: 1 },
  { id: "g2", name: "Appareillage", position: 2 },
];

function renderDialog(props: Partial<React.ComponentProps<typeof ArticleFormDialog>> = {}) {
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
      onCreatePhase={async () => null}
      {...props}
    />
  );
  return { onSubmit, user: userEvent.setup() };
}

describe("ArticleFormDialog stage", () => {
  it("starts a new item in the filtered stage and lets another be picked", async () => {
    const { onSubmit, user } = renderDialog({ phases: PHASES, defaultStage: 1 });
    expect(screen.getByTestId("phase-select-trigger").textContent).toContain("Appareillage");
    await user.click(screen.getByTestId("phase-select-trigger"));
    await user.click(screen.getByRole("button", { name: "Gaines" }));
    await user.type(screen.getByLabelText("articleName"), "Gaine ICTA 20");
    await user.click(screen.getByRole("button", { name: "create" }));
    expect(onSubmit.mock.calls[0][0].phase_id).toBe("g1");
  });

  it("sends no phase_id for a poste without stages", async () => {
    const { onSubmit, user } = renderDialog();
    expect(screen.getByTestId("phase-select-trigger").textContent).toContain("noPhase");
    await user.type(screen.getByLabelText("articleName"), "Plinthe");
    await user.click(screen.getByRole("button", { name: "create" }));
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty("phase_id");
  });
});
