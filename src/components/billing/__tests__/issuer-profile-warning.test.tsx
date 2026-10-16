/** The issuer's missing SIRET / TVA number / IBAN are named before issuing. */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import fr from "@/messages/fr.json";
import {
  IssuerProfileWarning,
  missingIssuerFields,
} from "@/components/billing/issuer-profile-warning";

const base = { id: "co-1", legal_name: "Phú Quốc SAS" };

describe("IssuerProfileWarning", () => {
  it("lists what the company lacks and links to its profile", () => {
    render(
      <NextIntlClientProvider locale="fr" messages={fr}>
        <IssuerProfileWarning company={{ ...base, siret: "", tva_number: null, iban: "FR76 1234" }} />
      </NextIntlClientProvider>
    );
    expect(screen.getByTestId("issuer-profile-warning").textContent).toContain("SIRET, n° de TVA");
    expect(screen.getByRole("link", { name: "Compléter la fiche entreprise" }).getAttribute("href")).toContain(
      "/settings/companies/co-1"
    );
  });

  it("stays hidden for a complete profile", () => {
    expect(missingIssuerFields({ ...base, siret: "55210055400025", tva_number: "FR1", iban: "FR76" })).toEqual([]);
  });
});
