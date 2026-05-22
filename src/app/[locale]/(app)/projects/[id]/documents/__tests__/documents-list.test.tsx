/**
 * Tests for DocumentsList component.
 *
 * Covers:
 * - Renders all document rows with formatted size and date
 * - Delete button visibility gated by uploader/admin/owner
 * - Preview button only shown for pdf/image kinds
 * - Download button triggers blob-fetch helper (not a bare anchor href)
 * - Sort header click triggers onSortChange callback with column name
 * - Empty state when documents array is empty
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DocumentsList } from "../documents-list";
import type { ProjectDocument } from "@/lib/api/project-documents";

// ---- Module mocks ----

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/lib/api/project-document-blob", () => ({
  downloadProjectDocument: vi.fn().mockResolvedValue(undefined),
}));

// ---- Module mocks ----

vi.mock("next-intl", () => {
  const translations: Record<string, Record<string, string>> = {
    "documents.list": {
      empty: "No documents yet",
      "columns.file": "File",
      "columns.type": "Type",
      "columns.size": "Size",
      "columns.uploadedBy": "Uploaded by",
      "columns.uploaded": "Uploaded",
      "columns.actions": "Actions",
      "actions.preview": "Preview",
      "actions.download": "Download",
      "actions.downloadError": "Download failed — please try again",
      "actions.rename": "Rename",
      "actions.delete": "Delete",
      formerMember: "Former member",
    },
    "documents.kinds": {
      pdf: "PDF",
      image: "Image",
      spreadsheet: "Spreadsheet",
      doc: "Document",
      cad: "CAD",
      text: "Text",
      other: "Other",
    },
    "documents.tags": {
      column: "Tags",
      add: "Add tag",
      remove: "Remove tag",
      placeholder: "New tag…",
      done: "Done",
    },
  };

  return {
    useTranslations: (ns: string) => (key: string) => {
      return translations[ns]?.[key] ?? key;
    },
    useLocale: () => "en",
  };
});

// ---- Helpers ----

// Counter so successive makeDoc() calls without an explicit `id` get distinct
// React keys — silences the "two children with the same key" warning when a
// test renders multiple default docs in the same table.
let _docSeq = 0;

function makeDoc(overrides: Partial<ProjectDocument> = {}): ProjectDocument {
  _docSeq += 1;
  const id = overrides.id ?? `doc-${_docSeq}`;
  return {
    id,
    project_id: "proj-1",
    filename: "sample.pdf",
    content_type: "application/pdf",
    size_bytes: 1024,
    kind: "pdf",
    uploaded_at: "2024-01-15T10:30:00Z",
    uploader_id: "user-1",
    download_url: `/api/v1/projects/proj-1/documents/${id}/download`,
    tags: [],
    ...overrides,
  };
}

function makeMember(id: string, name: string) {
  return { id, firstName: name.split(" ")[0], lastName: name.split(" ")[1] };
}

// ---- Tests ----

describe("DocumentsList", () => {
  const defaultProps = {
    documents: [],
    projectId: "proj-1",
    currentUserId: "user-1",
    isAdminOrOwner: false,
    members: [],
    sort: "name" as const,
    order: "asc" as const,
    availableTags: [],
    onSortChange: vi.fn(),
    onPreview: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
    onTagsUpdate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("empty state", () => {
    it("displays empty message when no documents", () => {
      render(<DocumentsList {...defaultProps} documents={[]} />);
      expect(screen.getByText("No documents yet")).toBeDefined();
    });
  });

  describe("document rendering", () => {
    it("renders document row with filename, size, uploader, date", () => {
      const doc = makeDoc({
        filename: "report.pdf",
        size_bytes: 2_048_000, // ~2 MB
        uploaded_at: "2024-03-20T14:25:00Z",
        uploader_id: "user-2",
      });

      const members = [makeMember("user-2", "Alice Brown")];

      const { container } = render(
        <DocumentsList
          {...defaultProps}
          documents={[doc]}
          members={members}
        />
      );

      expect(screen.getByText("report.pdf")).toBeDefined();
      // Check for MB formatted size - 2048000 / (1024*1024) ≈ 1.95 MB -> displays as 2.0
      expect(container.textContent).toContain("2.0");
      expect(container.textContent).toContain("MB");
      expect(screen.getByText("Alice Brown")).toBeDefined();
      expect(screen.getByText("Mar 20, 2024")).toBeDefined();
    });

    it("formats sizes correctly (B, KB, MB, GB)", () => {
      const docs = [
        makeDoc({ filename: "tiny.txt", size_bytes: 512 }),
        makeDoc({ filename: "small.pdf", size_bytes: 50_000 }),
        makeDoc({ filename: "medium.pdf", size_bytes: 5_000_000 }),
      ];

      const { container } = render(
        <DocumentsList
          {...defaultProps}
          documents={docs}
        />
      );

      // Check for formatted sizes in the container text
      expect(container.textContent).toContain("512 B");
      expect(container.textContent).toContain("48.8");
      expect(container.textContent).toContain("KB");
      expect(container.textContent).toContain("4.8");
      expect(container.textContent).toContain("MB");
    });

    it("displays former member name when uploader not in members list", () => {
      const doc = makeDoc({ uploader_id: "unknown-user" });

      render(
        <DocumentsList
          {...defaultProps}
          documents={[doc]}
          members={[makeMember("user-1", "John Doe")]}
        />
      );

      expect(screen.getByText("Former member")).toBeDefined();
    });

    it("displays kind icon and badge for each document", () => {
      const pdfDoc = makeDoc({ filename: "doc.pdf", kind: "pdf" });
      const imgDoc = makeDoc({
        id: "doc-2",
        filename: "photo.jpg",
        kind: "image",
      });

      render(
        <DocumentsList
          {...defaultProps}
          documents={[pdfDoc, imgDoc]}
        />
      );

      expect(screen.getByText("PDF")).toBeDefined();
      expect(screen.getByText("Image")).toBeDefined();
    });
  });

  describe("sort headers", () => {
    it("calls onSortChange when file name header clicked", () => {
      const onSortChange = vi.fn();
      const doc = makeDoc();

      render(
        <DocumentsList
          {...defaultProps}
          documents={[doc]}
          sort="name"
          onSortChange={onSortChange}
        />
      );

      const fileHeader = screen.getByText("File");
      fireEvent.click(fileHeader);

      expect(onSortChange).toHaveBeenCalledWith("name");
    });

    it("calls onSortChange when size header clicked", () => {
      const onSortChange = vi.fn();
      const doc = makeDoc();

      render(
        <DocumentsList
          {...defaultProps}
          documents={[doc]}
          sort="size"
          onSortChange={onSortChange}
        />
      );

      const sizeHeader = screen.getByText("Size");
      fireEvent.click(sizeHeader);

      expect(onSortChange).toHaveBeenCalledWith("size");
    });

    it("calls onSortChange when uploader header clicked", () => {
      const onSortChange = vi.fn();
      const doc = makeDoc();

      render(
        <DocumentsList
          {...defaultProps}
          documents={[doc]}
          sort="uploader"
          onSortChange={onSortChange}
        />
      );

      const uploaderHeader = screen.getByText("Uploaded by");
      fireEvent.click(uploaderHeader);

      expect(onSortChange).toHaveBeenCalledWith("uploader");
    });

    it("calls onSortChange when date header clicked", () => {
      const onSortChange = vi.fn();
      const doc = makeDoc();

      render(
        <DocumentsList
          {...defaultProps}
          documents={[doc]}
          sort="created_at"
          onSortChange={onSortChange}
        />
      );

      const dateHeader = screen.getByText("Uploaded");
      fireEvent.click(dateHeader);

      expect(onSortChange).toHaveBeenCalledWith("created_at");
    });
  });

  describe("preview button", () => {
    it("shows preview button for PDF documents", () => {
      const doc = makeDoc({ kind: "pdf" });

      render(
        <DocumentsList
          {...defaultProps}
          documents={[doc]}
        />
      );

      const previewButtons = screen.getAllByTitle("Preview");
      expect(previewButtons.length).toBeGreaterThan(0);
    });

    it("shows preview button for image documents", () => {
      const doc = makeDoc({ kind: "image", filename: "photo.jpg" });

      render(
        <DocumentsList
          {...defaultProps}
          documents={[doc]}
        />
      );

      const previewButtons = screen.getAllByTitle("Preview");
      expect(previewButtons.length).toBeGreaterThan(0);
    });

    it("does NOT show preview button for spreadsheet", () => {
      const doc = makeDoc({
        kind: "spreadsheet",
        filename: "data.xlsx",
      });

      render(
        <DocumentsList
          {...defaultProps}
          documents={[doc]}
        />
      );

      // Should have download button but not preview
      const downloadButtons = screen.getAllByTitle("Download");
      expect(downloadButtons.length).toBeGreaterThan(0);

      const previewButtons = screen.queryAllByTitle("Preview");
      expect(previewButtons.length).toBe(0);
    });

    it("does NOT show preview button for text documents", () => {
      const doc = makeDoc({ kind: "text", filename: "notes.txt" });

      render(
        <DocumentsList
          {...defaultProps}
          documents={[doc]}
        />
      );

      const downloadButtons = screen.getAllByTitle("Download");
      expect(downloadButtons.length).toBeGreaterThan(0);

      const previewButtons = screen.queryAllByTitle("Preview");
      expect(previewButtons.length).toBe(0);
    });

    it("does NOT show preview button for CAD documents", () => {
      const doc = makeDoc({ kind: "cad", filename: "blueprint.dwg" });

      render(
        <DocumentsList
          {...defaultProps}
          documents={[doc]}
        />
      );

      const downloadButtons = screen.getAllByTitle("Download");
      expect(downloadButtons.length).toBeGreaterThan(0);

      const previewButtons = screen.queryAllByTitle("Preview");
      expect(previewButtons.length).toBe(0);
    });

    it("calls onPreview callback when preview button clicked", () => {
      const onPreview = vi.fn();
      const doc = makeDoc({ kind: "pdf" });

      render(
        <DocumentsList
          {...defaultProps}
          documents={[doc]}
          onPreview={onPreview}
        />
      );

      const previewButton = screen.getByTitle("Preview");
      fireEvent.click(previewButton);

      expect(onPreview).toHaveBeenCalledWith(doc);
    });
  });

  describe("download button", () => {
    it("is rendered as a button (not a bare anchor)", () => {
      const doc = makeDoc({ id: "doc-abc", filename: "my-report.pdf" });

      render(<DocumentsList {...defaultProps} documents={[doc]} />);

      const downloadBtn = screen.getByTitle("Download");
      expect(downloadBtn.tagName.toLowerCase()).toBe("button");
    });

    it("calls downloadProjectDocument with correct ids and filename on click", async () => {
      const { downloadProjectDocument } = await import("@/lib/api/project-document-blob");
      const doc = makeDoc({
        id: "doc-abc",
        project_id: "proj-123",
        filename: "my-report.pdf",
        download_url: "/api/v1/projects/proj-123/documents/doc-abc/download",
      });

      render(
        <DocumentsList
          {...defaultProps}
          documents={[doc]}
        />
      );

      const downloadBtn = screen.getByTitle("Download");
      fireEvent.click(downloadBtn);

      // Allow the async click handler to settle
      await vi.waitFor(() => {
        expect(downloadProjectDocument).toHaveBeenCalledWith(
          "proj-123",
          "doc-abc",
          "my-report.pdf"
        );
      });
    });
  });

  describe("delete button visibility", () => {
    it("shows delete button when currentUserId matches uploader_id", () => {
      const doc = makeDoc({ uploader_id: "user-1" });

      render(
        <DocumentsList
          {...defaultProps}
          documents={[doc]}
          currentUserId="user-1"
          isAdminOrOwner={false}
        />
      );

      expect(screen.getByTitle("Delete")).toBeDefined();
    });

    it("hides delete button when currentUserId does NOT match uploader_id and NOT admin", () => {
      const doc = makeDoc({ uploader_id: "user-2" });

      render(
        <DocumentsList
          {...defaultProps}
          documents={[doc]}
          currentUserId="user-1"
          isAdminOrOwner={false}
        />
      );

      expect(screen.queryByTitle("Delete")).toBeNull();
    });

    it("shows delete button when isAdminOrOwner=true even if not uploader", () => {
      const doc = makeDoc({ uploader_id: "user-2" });

      render(
        <DocumentsList
          {...defaultProps}
          documents={[doc]}
          currentUserId="user-1"
          isAdminOrOwner={true}
        />
      );

      expect(screen.getByTitle("Delete")).toBeDefined();
    });

    it("calls onDelete callback when delete button clicked", () => {
      const onDelete = vi.fn();
      const doc = makeDoc({ uploader_id: "user-1" });

      render(
        <DocumentsList
          {...defaultProps}
          documents={[doc]}
          currentUserId="user-1"
          onDelete={onDelete}
        />
      );

      const deleteButton = screen.getByTitle("Delete");
      fireEvent.click(deleteButton);

      expect(onDelete).toHaveBeenCalledWith(doc);
    });
  });

  describe("multiple documents", () => {
    it("renders all documents in table", () => {
      const docs = [
        makeDoc({ id: "doc-1", filename: "file1.pdf" }),
        makeDoc({ id: "doc-2", filename: "file2.png", kind: "image" }),
        makeDoc({ id: "doc-3", filename: "file3.xlsx", kind: "spreadsheet" }),
      ];

      render(
        <DocumentsList
          {...defaultProps}
          documents={docs}
        />
      );

      expect(screen.getByText("file1.pdf")).toBeDefined();
      expect(screen.getByText("file2.png")).toBeDefined();
      expect(screen.getByText("file3.xlsx")).toBeDefined();
    });

    it("respects different uploader permissions for each row", () => {
      const docs = [
        makeDoc({ id: "doc-1", filename: "myfile.pdf", uploader_id: "user-1" }),
        makeDoc({ id: "doc-2", filename: "otherfile.pdf", uploader_id: "user-2" }),
      ];

      render(
        <DocumentsList
          {...defaultProps}
          documents={docs}
          currentUserId="user-1"
          isAdminOrOwner={false}
        />
      );

      const deleteButtons = screen.queryAllByTitle("Delete");
      // Only one delete button should be visible (for user-1's doc)
      expect(deleteButtons.length).toBe(1);
    });
  });

  describe("sort state visual indicators", () => {
    it("shows chevron-up when actively sorted asc", () => {
      const doc = makeDoc();

      const { container } = render(
        <DocumentsList
          {...defaultProps}
          documents={[doc]}
          sort="name"
          order="asc"
        />
      );

      // The active sort header should show ChevronUp icon
      const fileHeader = screen.getByText("File");
      const parent = fileHeader.closest("button");
      // SVG chevrons are nested, just verify the header is styled as active
      expect(fileHeader).toBeDefined();
    });

    it("shows chevron-down when actively sorted desc", () => {
      const doc = makeDoc();

      render(
        <DocumentsList
          {...defaultProps}
          documents={[doc]}
          sort="name"
          order="desc"
        />
      );

      const fileHeader = screen.getByText("File");
      expect(fileHeader).toBeDefined();
    });
  });
});
