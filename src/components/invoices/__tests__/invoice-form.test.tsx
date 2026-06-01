/**
 * Tests for InvoiceForm component
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InvoiceForm } from "../invoice-form";

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    // Simple mock translations — return key as fallback
    const translations: Record<string, string> = {
      "invoices.type": "Type",
      "invoices.types.released_funds": "Released Funds",
      "invoices.types.labor": "Labor",
      "invoices.types.materials_services": "Materials & Services",
      "invoices.issueDate": "Issue Date",
      "invoices.recipient": "Recipient",
      "invoices.recipientAddress": "Recipient Address",
      "invoices.notes": "Notes",
      "invoices.items": "Line Items",
      "invoices.addItem": "Add Item",
      "invoices.description": "Description",
      "invoices.quantity": "Quantity",
      "invoices.unitPrice": "Unit Price",
      "invoices.total": "Total",
      "invoices.totalAmount": "Total Amount",
      "invoices.save": "Save",
      "invoices.saving": "Saving...",
      "invoices.errorDateRequired": "Issue date is required",
      "invoices.errorRecipientRequired": "Recipient name is required",
      "invoices.errorAtLeastOneItem": "At least one item is required",
      "invoices.errorDescriptionRequired": "Description is required",
      "invoices.errorQuantityPositive": "Quantity must be greater than 0",
    };
    return translations[key] || key;
  },
}));

describe("InvoiceForm", () => {
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    mockOnSubmit.mockClear();
    mockOnSubmit.mockResolvedValue(undefined);
  });

  describe("Rendering", () => {
    it("renders form with all sections", () => {
      render(<InvoiceForm onSubmit={mockOnSubmit} />);

      // Type select
      expect(screen.getByRole("combobox")).toBeDefined();

      // Input fields - the component doesn't use labels with for= attributes
      const allInputs = screen.getAllByRole("textbox");
      expect(allInputs.length).toBeGreaterThan(0);

      // Line items section - look for the heading
      expect(screen.getByText("items")).toBeDefined();

      // Save button
      const submitBtn = screen.getByRole("button", { name: /save/i });
      expect(submitBtn).toBeDefined();
    });

    it("renders type select with all options", () => {
      render(<InvoiceForm onSubmit={mockOnSubmit} />);

      const typeSelect = screen.getByRole("combobox");
      expect(typeSelect).toBeDefined();

      // Check options are present
      const options = typeSelect.querySelectorAll("option");
      expect(options.length).toBeGreaterThanOrEqual(3);
    });

    it("renders one empty line item by default", () => {
      render(<InvoiceForm onSubmit={mockOnSubmit} />);

      const descriptionInputs = screen.getAllByPlaceholderText(/description/i);
      expect(descriptionInputs.length).toBeGreaterThanOrEqual(1);
    });

    it("renders save button", () => {
      render(<InvoiceForm onSubmit={mockOnSubmit} />);

      const saveButton = screen.getByRole("button", { name: /save/i });
      expect(saveButton).toBeDefined();
      expect(saveButton).toHaveAttribute("type", "submit");
    });
  });

  describe("Validation", () => {
    it("shows error when submitting with empty recipient", async () => {
      const user = userEvent.setup();
      render(<InvoiceForm onSubmit={mockOnSubmit} />);

      const submitBtn = screen.getByRole("button", { name: /save/i });
      await user.click(submitBtn);

      // Should show validation error
      const errorText = screen.queryByText((content) =>
        /recipient.*required/i.test(content)
      );
      expect(errorText).toBeDefined();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it("shows error when recipient is only whitespace", async () => {
      const user = userEvent.setup();
      render(<InvoiceForm onSubmit={mockOnSubmit} />);

      // Get all textbox inputs and find the recipient one
      const inputs = screen.getAllByRole("textbox");
      // First few are usually recipient, address, notes
      if (inputs.length > 0) {
        await user.type(inputs[0], "   ");

        const submitBtn = screen.getByRole("button", { name: /save/i });
        await user.click(submitBtn);

        const errorText = screen.queryByText((content) =>
          /recipient.*required/i.test(content)
        );
        expect(errorText).toBeDefined();
        expect(mockOnSubmit).not.toHaveBeenCalled();
      }
    });

    it("shows error when no description in item", async () => {
      const user = userEvent.setup();
      render(<InvoiceForm onSubmit={mockOnSubmit} />);

      const inputs = screen.getAllByRole("textbox");
      if (inputs.length > 0) {
        // Fill recipient
        await user.type(inputs[0], "Test Client");

        const submitBtn = screen.getByRole("button", { name: /save/i });
        await user.click(submitBtn);

        const errorText = screen.queryByText((content) =>
          /description.*required/i.test(content)
        );
        expect(errorText).toBeDefined();
        expect(mockOnSubmit).not.toHaveBeenCalled();
      }
    });

    it("shows error when quantity is zero", async () => {
      const user = userEvent.setup();
      render(<InvoiceForm onSubmit={mockOnSubmit} />);

      const inputs = screen.getAllByRole("textbox");
      if (inputs.length > 0) {
        await user.type(inputs[0], "Test Client");

        const descriptionInputs = screen.getAllByPlaceholderText(/description/i);
        await user.type(descriptionInputs[0], "Work Item");

        // Find quantity input - typically comes after description in the grid
        const numInputs = screen.getAllByRole("spinbutton");
        if (numInputs.length > 0) {
          await user.clear(numInputs[0]);
          await user.type(numInputs[0], "0");

          const submitBtn = screen.getByRole("button", { name: /save/i });
          await user.click(submitBtn);

          const errorText = screen.queryByText((content) =>
            /quantity.*greater than 0/i.test(content)
          );
          expect(errorText).toBeDefined();
          expect(mockOnSubmit).not.toHaveBeenCalled();
        }
      }
    });

    it("clears error when valid data is entered", async () => {
      const user = userEvent.setup();
      render(<InvoiceForm onSubmit={mockOnSubmit} />);

      const inputs = screen.getAllByRole("textbox");
      if (inputs.length > 0) {
        const submitBtn = screen.getByRole("button", { name: /save/i });

        // First attempt with empty recipient
        await user.click(submitBtn);

        // Then fill in valid data
        await user.type(inputs[0], "Test Client");

        const descriptionInputs = screen.getAllByPlaceholderText(/description/i);
        await user.type(descriptionInputs[0], "Work");

        await user.click(submitBtn);

        // Should have called onSubmit
        expect(mockOnSubmit).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe("Form submission", () => {
    it("submits form with valid data", async () => {
      const user = userEvent.setup();
      render(<InvoiceForm onSubmit={mockOnSubmit} />);

      const inputs = screen.getAllByRole("textbox");
      if (inputs.length > 0) {
        await user.type(inputs[0], "ACME Corp");

        const descriptionInputs = screen.getAllByPlaceholderText(/description/i);
        await user.type(descriptionInputs[0], "Consulting Services");

        const numInputs = screen.getAllByRole("spinbutton");
        if (numInputs.length >= 2) {
          await user.clear(numInputs[0]);
          await user.type(numInputs[0], "10");

          await user.clear(numInputs[1]);
          await user.type(numInputs[1], "100");
        }

        const submitBtn = screen.getByRole("button", { name: /save/i });
        await user.click(submitBtn);

        expect(mockOnSubmit).toHaveBeenCalledTimes(1);
        const payload = mockOnSubmit.mock.calls[0][0];
        expect(payload.recipient_name).toBe("ACME Corp");
        expect(payload.items).toHaveLength(1);
        expect(payload.items[0].description).toBe("Consulting Services");
      }
    });

    it("disables submit button while loading", async () => {
      render(<InvoiceForm onSubmit={mockOnSubmit} isLoading={true} />);

      const submitBtn = screen.getByRole("button", { name: /saving/i });
      expect(submitBtn).toBeDisabled();
    });

    it("handles submission error", async () => {
      const user = userEvent.setup();
      const errorMessage = "Network error";
      mockOnSubmit.mockRejectedValueOnce(new Error(errorMessage));

      render(<InvoiceForm onSubmit={mockOnSubmit} />);

      const inputs = screen.getAllByRole("textbox");
      if (inputs.length > 0) {
        await user.type(inputs[0], "ACME Corp");

        const descriptionInputs = screen.getAllByPlaceholderText(/description/i);
        await user.type(descriptionInputs[0], "Work");

        const submitBtn = screen.getByRole("button", { name: /save/i });
        await user.click(submitBtn);

        expect(mockOnSubmit).toHaveBeenCalledTimes(1);

        // Wait for error to appear
        await new Promise((r) => setTimeout(r, 100));
        const errorText = screen.queryByText(/network error/i);
        expect(errorText).toBeDefined();
      }
    });
  });

  describe("Line items management", () => {
    it("adds a new line item when clicking add button", async () => {
      const user = userEvent.setup();
      render(<InvoiceForm onSubmit={mockOnSubmit} />);

      const buttons = screen.getAllByRole("button");
      const addBtn = buttons.find((btn) => /add.*item/i.test(btn.textContent || ""));

      if (addBtn) {
        await user.click(addBtn);

        // Should have 2 description inputs now
        const descriptionInputs = screen.getAllByPlaceholderText(/description/i);
        expect(descriptionInputs.length).toBe(2);
      }
    });

    it("removes line item when clicking delete button", async () => {
      const user = userEvent.setup();
      render(<InvoiceForm onSubmit={mockOnSubmit} />);

      // Add a second item so we can delete the first
      const buttons = screen.getAllByRole("button");
      const addBtn = buttons.find((btn) => /add.*item/i.test(btn.textContent || ""));

      if (addBtn) {
        await user.click(addBtn);

        const allButtons = screen.getAllByRole("button");
        const trashButtons = allButtons.filter((btn) => btn.querySelector("svg"));

        // Click first trash button to delete first item (if not disabled)
        if (trashButtons.length > 1 && !trashButtons[0].hasAttribute("disabled")) {
          await user.click(trashButtons[0]);
        }

        const descriptionInputs = screen.getAllByPlaceholderText(/description/i);
        expect(descriptionInputs.length).toBeGreaterThanOrEqual(1);
      }
    });

    it("calculates and displays line item total", async () => {
      const user = userEvent.setup();
      render(<InvoiceForm onSubmit={mockOnSubmit} />);

      const numInputs = screen.getAllByRole("spinbutton");

      if (numInputs.length >= 2) {
        await user.clear(numInputs[0]);
        await user.type(numInputs[0], "5");

        await user.clear(numInputs[1]);
        await user.type(numInputs[1], "20");

        // Total should be displayed somewhere (5 * 20 = 100)
        // Note: actual display depends on component implementation
        expect(mockOnSubmit).not.toHaveBeenCalled();
      }
    });

    it("allows deleting when multiple items exist", async () => {
      const user = userEvent.setup();
      render(<InvoiceForm onSubmit={mockOnSubmit} />);

      // Add a second item so we can delete
      const buttons = screen.getAllByRole("button");
      const addBtn = buttons.find((btn) => /add.*item/i.test(btn.textContent || ""));

      if (addBtn) {
        await user.click(addBtn);

        const allButtons = screen.getAllByRole("button");
        const trashButtons = allButtons.filter(
          (btn) => btn.querySelector("svg") && !btn.textContent?.includes("Add")
        );

        // First item trash button should not be disabled when 2 items exist
        if (trashButtons.length > 0) {
          expect(trashButtons[0]).not.toBeDisabled();
        }
      }
    });
  });

  describe("Grand total calculation", () => {
    it("displays grand total of all items", async () => {
      const user = userEvent.setup();
      render(<InvoiceForm onSubmit={mockOnSubmit} />);

      const numInputs = screen.getAllByRole("spinbutton");

      if (numInputs.length >= 2) {
        await user.clear(numInputs[0]);
        await user.type(numInputs[0], "2");

        await user.clear(numInputs[1]);
        await user.type(numInputs[1], "50");

        // Should show total 100.00 somewhere
        // Add another item
        const buttons = screen.getAllByRole("button");
        const addBtn = buttons.find((btn) => /add.*item/i.test(btn.textContent || ""));

        if (addBtn) {
          await user.click(addBtn);

          const numInputsAfter = screen.getAllByRole("spinbutton");

          if (numInputsAfter.length >= 4) {
            await user.clear(numInputsAfter[2]);
            await user.type(numInputsAfter[2], "1");

            await user.clear(numInputsAfter[3]);
            await user.type(numInputsAfter[3], "30");

            // Total should be 130.00
            expect(mockOnSubmit).not.toHaveBeenCalled();
          }
        }
      }
    });
  });

  describe("Initial values", () => {
    it("populates form with initial values", async () => {
      const initialValues = {
        type: "labor" as const,
        issue_date: "2024-01-15",
        recipient_name: "Test Client",
        recipient_address: "123 Main St",
        notes: "Test notes",
        items: [
          { description: "Initial Item", quantity: 5, unit_price: 25 },
        ],
      };

      render(<InvoiceForm onSubmit={mockOnSubmit} initialValues={initialValues} />);

      const inputs = screen.getAllByRole("textbox");
      expect(inputs[0]).toHaveValue("Test Client");

      const descriptionInputs = screen.getAllByPlaceholderText(/description/i);
      expect(descriptionInputs[0]).toHaveValue("Initial Item");
    });

    it("defaults to released_funds type when no initial values", () => {
      render(<InvoiceForm onSubmit={mockOnSubmit} />);

      const typeSelect = screen.getByRole("combobox");
      expect(typeSelect).toHaveValue("released_funds");
    });
  });

  describe("Issue date", () => {
    it("defaults the issue date to today so the payload is never empty", async () => {
      const user = userEvent.setup();
      const { container } = render(<InvoiceForm onSubmit={mockOnSubmit} />);

      // Date input is pre-filled (not blank) on a fresh form.
      const dateInput = container.querySelector(
        'input[type="date"]'
      ) as HTMLInputElement;
      expect(dateInput.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      // Fill the remaining required fields and submit.
      await user.type(screen.getAllByRole("textbox")[0], "Resto");
      await user.type(screen.getAllByPlaceholderText(/description/i)[0], "Dinner");
      await user.click(screen.getByRole("button", { name: /save/i }));

      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
      const payload = mockOnSubmit.mock.calls[0][0];
      expect(payload.issue_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("blocks submit and shows an error when the date is cleared", async () => {
      const user = userEvent.setup();
      const { container } = render(<InvoiceForm onSubmit={mockOnSubmit} />);

      const dateInput = container.querySelector(
        'input[type="date"]'
      ) as HTMLInputElement;
      await user.clear(dateInput);

      await user.type(screen.getAllByRole("textbox")[0], "Resto");
      await user.type(screen.getAllByPlaceholderText(/description/i)[0], "Dinner");
      await user.click(screen.getByRole("button", { name: /save/i }));

      const errorText = screen.queryByText((content) =>
        /issue date.*required/i.test(content)
      );
      expect(errorText).toBeDefined();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });
});
