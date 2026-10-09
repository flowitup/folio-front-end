/**
 * ActivityDialog — a failed save shows the translated message, never ApiError's
 * raw "HTTP 400: BAD REQUEST" (nor a hard-coded English fallback).
 */
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import fr from "@/messages/fr.json";
import { ApiError } from "@/lib/api/http";
import { ActivityDialog } from "../activity-dialog";

function renderDialog(onSave: (data: { date: string; title: string }) => Promise<void>) {
  return render(
    <NextIntlClientProvider locale="fr" messages={fr}>
      <ActivityDialog open onOpenChange={vi.fn()} initialDate="2026-10-09" onSave={onSave} />
    </NextIntlClientProvider>
  );
}

describe("ActivityDialog — save failure", () => {
  it("shows the translated message for an API error", async () => {
    const onSave = vi.fn().mockRejectedValue(new ApiError("HTTP 400: BAD REQUEST", 400, { error: "ValidationError" }));
    renderDialog(onSave);

    fireEvent.change(screen.getByLabelText(fr.labor.activity.titleField), { target: { value: "Coulage dalle" } });
    fireEvent.click(screen.getByRole("button", { name: fr.labor.save }));

    await waitFor(() => expect(screen.getByText(fr.labor.activity.saveFailed)).toBeInTheDocument());
    expect(screen.queryByText(/HTTP 400/)).toBeNull();
  });
});
