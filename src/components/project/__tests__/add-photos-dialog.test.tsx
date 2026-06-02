/**
 * Tests for AddPhotosDialog — the inline upload dialog launched from a project
 * card (replaces the old sidebar Photos entry). Proves the dialog renders its
 * title/description and embeds the reusable PhotosUpload control when open, and
 * renders nothing when closed.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AddPhotosDialog } from "../add-photos-dialog";

// next-intl identity mock — return the key so we can assert on stable strings.
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

// PhotosUpload reaches for the browser upload + toasts; stub their deps.
vi.mock("@/lib/api/project-photo-blob", () => ({
  uploadProjectPhoto: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe("AddPhotosDialog", () => {
  it("renders title, description and the upload control when open", () => {
    render(
      <AddPhotosDialog
        projectId="p-1"
        projectName="Acme Tower"
        open
        onOpenChange={() => {}}
      />,
    );

    // Dialog title uses photos.addPhotos; description includes the project name.
    expect(screen.getAllByText("addPhotos").length).toBeGreaterThan(0);
    expect(screen.getByText(/Acme Tower/)).toBeInTheDocument();
    // PhotosUpload's caption field proves the upload control is embedded.
    expect(screen.getByText("caption.label")).toBeInTheDocument();
  });

  it("renders nothing when closed", () => {
    render(
      <AddPhotosDialog
        projectId="p-1"
        projectName="Acme Tower"
        open={false}
        onOpenChange={() => {}}
      />,
    );

    expect(screen.queryByText("caption.label")).not.toBeInTheDocument();
  });
});
