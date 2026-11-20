/**
 * The export file language: defaults to the interface language, remembers
 * the last choice per browser.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { EXPORT_LOCALE_KEY, ExportLanguageField, useExportLocale } from "../export-language-field";

let uiLocale = "vi";
vi.mock("next-intl", () => ({ useLocale: () => uiLocale }));

afterEach(() => {
  window.localStorage.clear();
  uiLocale = "vi";
});

describe("useExportLocale", () => {
  it("defaults to the interface language", () => {
    const { result } = renderHook(() => useExportLocale());
    expect(result.current[0]).toBe("vi");
  });

  it("remembers the last choice", () => {
    const { result, unmount } = renderHook(() => useExportLocale());
    act(() => result.current[1]("fr"));
    expect(result.current[0]).toBe("fr");
    expect(window.localStorage.getItem(EXPORT_LOCALE_KEY)).toBe("fr");
    unmount();
    expect(renderHook(() => useExportLocale()).result.current[0]).toBe("fr");
  });

  it("ignores a stored value that is not a language of the app", () => {
    window.localStorage.setItem(EXPORT_LOCALE_KEY, "de");
    uiLocale = "en";
    expect(renderHook(() => useExportLocale()).result.current[0]).toBe("en");
  });
});

describe("ExportLanguageField", () => {
  it("names each language in its own language and marks the current one", () => {
    const onChange = vi.fn();
    render(<ExportLanguageField label="File language" value="vi" onChange={onChange} />);
    expect(screen.getByRole("button", { name: "Tiếng Việt" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Français" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: "Français" }));
    expect(onChange).toHaveBeenCalledWith("fr");
  });
});
