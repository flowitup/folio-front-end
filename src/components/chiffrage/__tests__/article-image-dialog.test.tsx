/**
 * article-image-dialog.test.tsx — the supplier-link part of ArticleImageDialog,
 * now built on the shared ImageUrlField: the trimmed link goes to onFromUrl,
 * the dialog closes on success and stays open with the link on failure.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("next-intl", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const en = require("../../../messages/en.json") as Record<string, unknown>;
  function resolve(obj: Record<string, unknown>, path: string): string {
    return (path.split(".").reduce<unknown>((acc, k) => {
      if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[k];
      return undefined;
    }, obj) as string) ?? path;
  }
  return {
    useTranslations: (ns: string) => (key: string) => resolve(en, `${ns}.${key}`),
  };
});

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { ArticleImageDialog } from "../article-image-dialog";
import type { ChiffrageArticle } from "@/lib/api/chiffrage";

const article = { id: "art-1", image_ref: null } as unknown as ChiffrageArticle;
const LINK = "https://media.adeo.com/marketplace/photo.jpg";

function renderDialog(onFromUrl: (url: string) => Promise<boolean>) {
  const onOpenChange = vi.fn();
  render(
    <ArticleImageDialog
      open
      article={article}
      onOpenChange={onOpenChange}
      onUpload={vi.fn()}
      onFromUrl={onFromUrl}
      onRemove={vi.fn()}
    />
  );
  return { onOpenChange };
}

describe("ArticleImageDialog — supplier link", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends the trimmed link and closes on success", async () => {
    const onFromUrl = vi.fn().mockResolvedValue(true);
    const { onOpenChange } = renderDialog(onFromUrl);

    fireEvent.change(screen.getByLabelText("From a supplier link"), {
      target: { value: `  ${LINK}  ` },
    });
    fireEvent.click(screen.getByRole("button", { name: "Fetch" }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(onFromUrl).toHaveBeenCalledWith(LINK);
  });

  it("stays open with the link kept when the fetch fails", async () => {
    const onFromUrl = vi.fn().mockResolvedValue(false);
    const { onOpenChange } = renderDialog(onFromUrl);

    const input = screen.getByLabelText("From a supplier link") as HTMLInputElement;
    fireEvent.change(input, { target: { value: LINK } });
    fireEvent.click(screen.getByRole("button", { name: "Fetch" }));

    await waitFor(() => expect(onFromUrl).toHaveBeenCalled());
    await waitFor(() => expect(input).not.toBeDisabled());
    expect(input.value).toBe(LINK);
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
