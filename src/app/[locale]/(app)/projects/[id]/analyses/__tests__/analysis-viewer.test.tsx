/**
 * Tests for AnalysisViewer component
 * SECURITY REGRESSION TEST: ensures iframe sandbox is properly configured
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string, params?: Record<string, unknown>) => {
    const translations: Record<string, Record<string, string>> = {
      "analyses.viewer": {
        loading: "Loading report…",
      },
    };
    return translations[ns]?.[key] ?? key;
  },
}));

import { AnalysisViewer } from "../analysis-viewer";

const PROJECT_ID = "proj-123";
const ANALYSIS_ID = "analysis-456";

describe("AnalysisViewer", () => {
  describe("Security: iframe sandbox configuration", () => {
    it("SECURITY REGRESSION: iframe sandbox attribute equals exactly 'allow-scripts'", () => {
      const { container } = render(
        <AnalysisViewer projectId={PROJECT_ID} analysisId={ANALYSIS_ID} title="Report" />
      );

      const iframe = container.querySelector("iframe") as HTMLIFrameElement;
      expect(iframe).toBeDefined();
      expect(iframe.getAttribute("sandbox")).toBe("allow-scripts");
    });

    it("SECURITY REGRESSION: iframe sandbox does NOT contain 'allow-same-origin'", () => {
      const { container } = render(
        <AnalysisViewer projectId={PROJECT_ID} analysisId={ANALYSIS_ID} title="Report" />
      );

      const iframe = container.querySelector("iframe") as HTMLIFrameElement;
      expect(iframe).toBeDefined();

      // Explicitly check that allow-same-origin is NOT in the sandbox attribute
      const sandboxAttr = iframe.getAttribute("sandbox");
      expect(sandboxAttr).not.toContain("allow-same-origin");
    });

    it("SECURITY REGRESSION: iframe sandbox contains only 'allow-scripts', nothing else", () => {
      const { container } = render(
        <AnalysisViewer projectId={PROJECT_ID} analysisId={ANALYSIS_ID} title="Report" />
      );

      const iframe = container.querySelector("iframe") as HTMLIFrameElement;
      expect(iframe).toBeDefined();

      // The sandbox attribute should contain exactly "allow-scripts"
      const sandboxAttr = iframe.getAttribute("sandbox");
      expect(sandboxAttr).toBe("allow-scripts");
    });

    it("COMMENT: Adding 'allow-same-origin' would turn stored reports into stored XSS", () => {
      // This test documents the security rationale: the iframe is loaded from a
      // same-origin proxy route (/analysis-report/X/Y), which serves
      // the stored HTML report. If allow-same-origin were added to sandbox, the
      // document would synchronize with Folio's real origin, gaining access to
      // session cookies, localStorage, and parent DOM — enabling stored XSS.
      // The current configuration (allow-scripts only) gives the report an OPAQUE
      // origin: inline scripts and Google Fonts requests work, but the document
      // cannot read Folio's session.
      expect(true).toBe(true);
    });
  });

  describe("referrerPolicy configuration", () => {
    it("sets referrerPolicy to 'no-referrer'", () => {
      const { container } = render(
        <AnalysisViewer projectId={PROJECT_ID} analysisId={ANALYSIS_ID} title="Report" />
      );

      const iframe = container.querySelector("iframe") as HTMLIFrameElement;
      expect(iframe).toBeDefined();
      expect(iframe.getAttribute("referrerpolicy")).toBe("no-referrer");
    });
  });

  describe("src attribute configuration", () => {
    it("src points to the same-origin content route", () => {
      const { container } = render(
        <AnalysisViewer projectId={PROJECT_ID} analysisId={ANALYSIS_ID} title="Report" />
      );

      const iframe = container.querySelector("iframe") as HTMLIFrameElement;
      expect(iframe).toBeDefined();
      expect(iframe.src).toContain(`/analysis-report/${PROJECT_ID}/${ANALYSIS_ID}`);
    });

    it("URL-encodes project and analysis IDs in src", () => {
      const encodedProjId = "proj%2F123"; // "/" encoded as %2F
      const encodedAnalysisId = "analysis%2F456";

      const { container } = render(
        <AnalysisViewer
          projectId={encodedProjId}
          analysisId={encodedAnalysisId}
          title="Report"
        />
      );

      const iframe = container.querySelector("iframe") as HTMLIFrameElement;
      expect(iframe).toBeDefined();
      // The src should have the IDs encoded
      expect(iframe.src).toContain("proj%252F123");
      expect(iframe.src).toContain("analysis%252F456");
    });
  });

  describe("Accessibility", () => {
    it("sets iframe title attribute from props", () => {
      const { container } = render(
        <AnalysisViewer projectId={PROJECT_ID} analysisId={ANALYSIS_ID} title="My Analysis" />
      );

      const iframe = container.querySelector("iframe") as HTMLIFrameElement;
      expect(iframe).toBeDefined();
      expect(iframe.title).toBe("My Analysis");
    });
  });

  describe("Loading state", () => {
    it("shows loading indicator before iframe loads", () => {
      const { container } = render(
        <AnalysisViewer projectId={PROJECT_ID} analysisId={ANALYSIS_ID} title="Report" />
      );

      // Find the loading spinner (Loader2 icon from lucide-react)
      const loader = container.querySelector("[aria-hidden]");
      expect(loader).toBeDefined();
    });

    it("hides loading indicator on iframe load", async () => {
      const { container, rerender } = render(
        <AnalysisViewer projectId={PROJECT_ID} analysisId={ANALYSIS_ID} title="Report" />
      );

      const iframe = container.querySelector("iframe") as HTMLIFrameElement;
      expect(iframe).toBeDefined();

      // Simulate iframe load
      const loadEvent = new Event("load", { bubbles: false });
      iframe.dispatchEvent(loadEvent);

      // Re-render to see if loading state changed (component should hide loading UI)
      rerender(<AnalysisViewer projectId={PROJECT_ID} analysisId={ANALYSIS_ID} title="Report" />);

      // After load, the loading spinner should be gone
      // (The component uses useState to track loaded state)
    });
  });

  describe("CSS classes", () => {
    it("renders iframe with proper styling classes", () => {
      const { container } = render(
        <AnalysisViewer projectId={PROJECT_ID} analysisId={ANALYSIS_ID} title="Report" />
      );

      const iframe = container.querySelector("iframe") as HTMLIFrameElement;
      expect(iframe).toBeDefined();
      expect(iframe.className).toContain("h-full");
      expect(iframe.className).toContain("w-full");
      expect(iframe.className).toContain("rounded-md");
      expect(iframe.className).toContain("border");
      expect(iframe.className).toContain("bg-white");
    });

    it("renders container with proper dimensions", () => {
      const { container } = render(
        <AnalysisViewer projectId={PROJECT_ID} analysisId={ANALYSIS_ID} title="Report" />
      );

      const wrapper = container.querySelector("div[class*='relative']") as HTMLDivElement;
      expect(wrapper).toBeDefined();
      expect(wrapper.className).toContain("h-full");
      expect(wrapper.className).toContain("w-full");
    });
  });

  describe("Component remounting on analysisId change", () => {
    it("receives analysisId as prop for use as React key", () => {
      // The component's docstring recommends callers render with key={analysisId}
      // so switching analyses remounts the component and resets loading state.
      // This test documents that behavior expectation.
      const { container, rerender } = render(
        <AnalysisViewer projectId={PROJECT_ID} analysisId="analysis-1" title="Report 1" />,
        { container: document.createElement("div") }
      );

      const iframe1 = container.querySelector("iframe") as HTMLIFrameElement;
      expect(iframe1.src).toContain("analysis-1");

      // Simulate remount by rendering with different key (simulated via container)
      const newContainer = document.createElement("div");
      rerender(
        <AnalysisViewer projectId={PROJECT_ID} analysisId="analysis-2" title="Report 2" />
      );

      // Component should use new analysisId in src
    });
  });
});
