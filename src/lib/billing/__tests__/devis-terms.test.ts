import { describe, it, expect } from "vitest";
import { factureHasDevisTerms, looksCopiedFromDevis } from "../devis-terms";

describe("looksCopiedFromDevis", () => {
  it("matches a quote's validity clause, any case", () => {
    expect(looksCopiedFromDevis("Acompte de 30%. Devis valable 30 jours.")).toBe(true);
    expect(looksCopiedFromDevis("DEVIS  VALABLE un mois")).toBe(true);
    expect(looksCopiedFromDevis("Validité du devis : 3 mois")).toBe(true);
  });

  it("ignores other text and empty values", () => {
    expect(looksCopiedFromDevis("Paiement à 30 jours")).toBe(false);
    expect(looksCopiedFromDevis("Suivant devis n° DEV-2026-001")).toBe(false);
    expect(looksCopiedFromDevis(null)).toBe(false);
    expect(looksCopiedFromDevis("")).toBe(false);
  });
});

describe("factureHasDevisTerms", () => {
  it("only flags factures, on notes or terms", () => {
    expect(factureHasDevisTerms({ kind: "facture", notes: null, terms: "Devis valable 30 jours" })).toBe(true);
    expect(factureHasDevisTerms({ kind: "facture", notes: "devis valable", terms: null })).toBe(true);
    expect(factureHasDevisTerms({ kind: "devis", notes: null, terms: "Devis valable 30 jours" })).toBe(false);
  });
});
