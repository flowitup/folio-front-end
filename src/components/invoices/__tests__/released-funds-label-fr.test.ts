/**
 * French spells the released-funds type "Fonds débloqués" everywhere: the
 * ledger tab and group header, the export dialog's type list and the dashboard
 * all read the same word ("fond" alone means "bottom").
 */

import { describe, it, expect } from "vitest";
import frMessages from "@/messages/fr.json";

describe("French released-funds label", () => {
  it("reads 'Fonds débloqués' on the ledger and in the export dialog", () => {
    expect(frMessages.invoices.types.released_funds).toBe("Fonds débloqués");
    expect(frMessages.invoices.export.typeReleasedFunds).toBe("Fonds débloqués");
  });

  it("has no 'fond débloqué' left anywhere", () => {
    expect(JSON.stringify(frMessages)).not.toMatch(/\bfond débloqué/i);
  });
});
