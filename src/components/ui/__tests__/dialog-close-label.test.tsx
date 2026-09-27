/** The dialog's close controls speak the app language, not hard-coded English. */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import fr from "@/messages/fr.json";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "../dialog";

describe("Dialog close labels", () => {
  it("names the corner button and the footer button with common.close", () => {
    render(
      <NextIntlClientProvider locale="fr" messages={fr}>
        <Dialog open>
          <DialogContent>
            <DialogTitle>Titre</DialogTitle>
            <DialogFooter showCloseButton />
          </DialogContent>
        </Dialog>
      </NextIntlClientProvider>
    );
    expect(screen.getAllByRole("button", { name: fr.common.close })).toHaveLength(2);
    expect(screen.queryByText("Close")).toBeNull();
  });
});
