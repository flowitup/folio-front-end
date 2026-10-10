/** Labor strings that used to be hard-coded English or not pluralised. */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider, createTranslator } from "next-intl";
import fr from "@/messages/fr.json";
import en from "@/messages/en.json";
import viMessages from "@/messages/vi.json";
import { ViewToggle } from "../view-toggle";

describe("labor i18n", () => {
  it("pluralises the worker count", () => {
    const tFr = createTranslator({ locale: "fr", messages: fr, namespace: "labor" });
    const tEn = createTranslator({ locale: "en", messages: en, namespace: "labor" });
    expect(tFr("workersBadge", { n: 1 })).toBe("1 ouvrier");
    expect(tFr("workersBadge", { n: 3 })).toBe("3 ouvriers");
    expect(tEn("acrossWorkers", { n: 1 })).toBe("across 1 worker");
  });

  it("pluralises counts instead of writing '(s)'", () => {
    const tFr = createTranslator({ locale: "fr", messages: fr, namespace: "labor" });
    const tEn = createTranslator({ locale: "en", messages: en, namespace: "labor" });
    expect(tFr("payments.invoiceCount", { n: 1 })).toBe("1 facture");
    expect(tFr("payments.invoiceCount", { n: 2 })).toBe("2 factures");
    expect(tEn("payments.invoiceCount", { n: 1 })).toBe("1 invoice");
    expect(tEn("payments.invoiceCount", { n: 2 })).toBe("2 invoices");
    expect(tFr("payments.unassignedHint", { n: 2 })).toBe("2 non attribuées");
    expect(tFr("summaryUnassignedHint", { n: 1 })).toBe("+ 1 non attribué");
    expect(tFr("logDayDialog.toastLogged", { n: 1 })).toBe("1 ouvrier pointé");
    expect(tFr("logDayDialog.toastLoggedWithSkip", { n: 3, skipped: 1 })).toBe(
      "3 ouvriers pointés, 1 ignoré (déjà saisi)"
    );
    expect(tFr("conflict.sameAsLastDaySkipped", { n: 2 })).toBe(
      "2 ouvriers ignorés — déjà pointés ailleurs"
    );
    expect(tEn("conflict.sameAsLastDaySkipped", { n: 1 })).toBe("1 worker skipped — already logged elsewhere");
    // The "on site today" caption agrees with the number above it.
    expect(tFr("workersLogged", { n: 1 })).toBe("ouvrier pointé");
    expect(tFr("workersLogged", { n: 4 })).toBe("ouvriers pointés");
    expect(tEn("workersLogged", { n: 1 })).toBe("worker logged");
    expect(tEn("workersLogged", { n: 0 })).toBe("workers logged");
  });

  it("pluralises banked bonus days (fr: 0 and 1.5 are singular)", () => {
    const tFr = createTranslator({ locale: "fr", messages: fr, namespace: "labor" });
    const tEn = createTranslator({ locale: "en", messages: en, namespace: "labor" });
    expect(tEn("supplement.bonusDaysSubtitle", { days: "1", count: 1 })).toBe("1 day banked");
    expect(tEn("supplement.bonusDaysSubtitle", { days: "1.5", count: 1.5 })).toBe("1.5 days banked");
    expect(tFr("supplement.bonusDaysSubtitle", { days: "0", count: 0 })).toBe("0 jour cumulé");
    expect(tFr("supplement.bonusDaysSubtitle", { days: "1,5", count: 1.5 })).toBe("1,5 jour cumulé");
    expect(tFr("supplement.bonusDaysSubtitle", { days: "2", count: 2 })).toBe("2 jours cumulés");
    expect(
      tEn("supplement.banner", { banked: 8, bonusDays: "1", count: 1, bonusCost: "€100.00" })
    ).toBe("Banked 8h → 1 bonus day (€100.00)");
    expect(
      tFr("supplement.banner", { banked: 16, bonusDays: "2", count: 2, bonusCost: "200,00 €" })
    ).toBe("Cumulé 16h → 2 jours bonus (200,00 €)");
  });

  it("writes the worker tooltip's day unit in the app language", () => {
    const tFr = createTranslator({ locale: "fr", messages: fr, namespace: "labor" });
    const tVi = createTranslator({ locale: "vi", messages: viMessages, namespace: "labor" });
    expect(tFr("daysShort", { n: "5,5" })).toBe("5,5 j");
    expect(tVi("daysShort", { n: "5,5" })).toBe("5,5 ngày");
  });

  it("leaves no '(s)' plural in the labor strings", () => {
    for (const messages of [en, fr]) {
      expect(JSON.stringify(messages.labor)).not.toMatch(/\w\(s\)/);
    }
  });

  it("shows the attendance view toggle in the app language", () => {
    render(
      <NextIntlClientProvider locale="fr" messages={fr}>
        <ViewToggle value="calendar" onChange={vi.fn()} />
      </NextIntlClientProvider>
    );
    expect(screen.getByRole("tablist", { name: "Affichage des présences" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Calendrier/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Liste/ })).toBeInTheDocument();
  });
});

describe("worker tile section", () => {
  it("says there are no workers in the app language", async () => {
    const { WorkerTileSection } = await import("../worker-tile-section");
    render(
      <NextIntlClientProvider locale="fr" messages={fr}>
        <WorkerTileSection heading="Tous">{[]}</WorkerTileSection>
      </NextIntlClientProvider>
    );
    expect(screen.getByText("Aucun ouvrier.")).toBeInTheDocument();
  });
});
