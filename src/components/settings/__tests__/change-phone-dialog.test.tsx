/**
 * Change number: Send stays usable and explains a number that is not French,
 * and the code's expiry counts down and says when the code has expired — the
 * same behaviour as the sign-in card.
 */
import { afterEach, describe, it, expect, vi } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";

const { mockRequest, mockConfirm } = vi.hoisted(() => ({
  mockRequest: vi.fn(),
  mockConfirm: vi.fn(),
}));
vi.mock("@/app/[locale]/(app)/settings/_actions/profile-actions", () => ({
  requestPhoneChangeCodeAction: mockRequest,
  confirmPhoneChangeAction: mockConfirm,
}));

import { ChangePhoneDialog } from "../change-phone-dialog";

function renderDialog() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <ChangePhoneDialog open onOpenChange={vi.fn()} onChanged={vi.fn()} />
    </NextIntlClientProvider>
  );
}

afterEach(() => {
  vi.useRealTimers();
  mockRequest.mockReset();
  mockConfirm.mockReset();
});

describe("ChangePhoneDialog", () => {
  it("keeps Send enabled for a foreign number and says why it is refused", async () => {
    renderDialog();
    fireEvent.change(screen.getByTestId("change-phone-phone"), { target: { value: "+84 912 345 678" } });
    const send = screen.getByTestId("change-phone-send");
    expect(send).toBeEnabled();
    await act(async () => {
      fireEvent.click(send);
    });
    expect(screen.getByTestId("change-phone-error")).toHaveTextContent(en.settings.changePhone.errorInvalidPhone);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("counts the code's expiry down and says when it has expired", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    mockRequest.mockResolvedValue({ success: true, expiresIn: 120 });
    renderDialog();
    fireEvent.change(screen.getByTestId("change-phone-phone"), { target: { value: "6 12 34 56 78" } });
    await act(async () => {
      fireEvent.click(screen.getByTestId("change-phone-send"));
    });
    expect(mockRequest).toHaveBeenCalledWith("+33612345678");
    expect(screen.getByTestId("change-phone-expiry")).toHaveTextContent("2 minutes");

    await act(async () => {
      vi.advanceTimersByTime(61_000);
    });
    expect(screen.getByTestId("change-phone-expiry")).toHaveTextContent("1 minute");

    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByTestId("change-phone-expiry")).toHaveTextContent(en.auth.codeExpired);
    expect(screen.getByTestId("change-phone-confirm")).toBeDisabled();
  });
});
