import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

import { toast } from "sonner";
import { queueFlashToast, takeFlashToast } from "@/lib/flash-toast";
import { FlashToast } from "@/components/flash-toast";

describe("flash toast", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it("shows a queued toast once on the next page", () => {
    queueFlashToast("You left Acme");

    render(<FlashToast />);
    expect(toast.success).toHaveBeenCalledWith("You left Acme");
    expect(takeFlashToast()).toBeNull();

    render(<FlashToast />);
    expect(toast.success).toHaveBeenCalledTimes(1);
  });

  it("shows nothing when nothing was queued", () => {
    render(<FlashToast />);
    expect(toast.success).not.toHaveBeenCalled();
  });
});
