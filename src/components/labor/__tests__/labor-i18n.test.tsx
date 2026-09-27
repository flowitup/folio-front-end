/** Labor strings that used to be hard-coded English or not pluralised. */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider, createTranslator } from "next-intl";
import fr from "@/messages/fr.json";
import en from "@/messages/en.json";
import { ViewToggle } from "../view-toggle";

describe("labor i18n", () => {
  it("pluralises the worker count", () => {
    const tFr = createTranslator({ locale: "fr", messages: fr, namespace: "labor" });
    const tEn = createTranslator({ locale: "en", messages: en, namespace: "labor" });
    expect(tFr("workersBadge", { n: 1 })).toBe("1 ouvrier");
    expect(tFr("workersBadge", { n: 3 })).toBe("3 ouvriers");
    expect(tEn("acrossWorkers", { n: 1 })).toBe("across 1 worker");
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
