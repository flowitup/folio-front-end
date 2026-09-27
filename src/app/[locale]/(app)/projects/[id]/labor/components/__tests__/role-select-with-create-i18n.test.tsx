/**
 * RoleSelectWithCreate — the picker speaks the viewer's language
 * (it sits in the add-worker dialog, used daily by French crews).
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import frMessages from "@/messages/fr.json";
import { RoleSelectWithCreate } from "../role-select-with-create";

vi.mock("../../actions", () => ({ createLaborRoleAction: vi.fn() }));

describe("RoleSelectWithCreate", () => {
  it("renders the trigger, search and empty states in French", () => {
    render(
      <NextIntlClientProvider locale="fr" messages={frMessages}>
        <RoleSelectWithCreate
          roles={[]}
          palette={["#7C3AED"]}
          value={null}
          onChange={() => {}}
          onRoleCreated={() => {}}
        />
      </NextIntlClientProvider>,
    );

    const trigger = screen.getByRole("combobox");
    expect(trigger.textContent).toContain(frMessages.labor.role.selectRole);

    fireEvent.click(trigger);
    expect(screen.getByPlaceholderText(frMessages.labor.role.searchRoles)).toBeDefined();
    expect(screen.getByText(frMessages.labor.role.noRole)).toBeDefined();
    expect(screen.queryByText("No role")).toBeNull();
  });
});
