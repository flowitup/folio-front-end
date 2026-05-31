/**
 * product-image.test.tsx — ProductImage component tests.
 *
 * Tests:
 *   - When hasImage=true and fetch succeeds → renders <img> with blob: URL
 *   - When hasImage=false → renders Package placeholder
 *   - When fetch rejects → renders Package placeholder
 *   - When fetch returns !ok → renders Package placeholder
 *   - On unmount or productId change → revokes object URL
 *   - URL.createObjectURL and revokeObjectURL are called correctly
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ProductImage } from "../product-image";

// ---- Mocks ----

const mockCreateObjectURL = vi.fn();
const mockRevokeObjectURL = vi.fn();

beforeEach(() => {
  // Mock URL.createObjectURL and URL.revokeObjectURL
  Object.defineProperty(URL, "createObjectURL", {
    value: mockCreateObjectURL,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    value: mockRevokeObjectURL,
    writable: true,
    configurable: true,
  });
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---- Helpers ----

function makeImageBlob(): Blob {
  return new Blob(["fake image data"], { type: "image/png" });
}

function makeSuccessResponse(blob: Blob): Response {
  return new Response(blob, {
    status: 200,
    headers: { "Content-Type": "image/png" },
  });
}

function makeErrorResponse(status: number): Response {
  return new Response("Error", { status });
}

// ---- Tests ----

describe("ProductImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateObjectURL.mockReturnValue("blob:http://localhost/test-url-123");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders placeholder when hasImage is false", () => {
    const { container } = render(
      <ProductImage
        productId="prod-1"
        hasImage={false}
        alt="Test Product"
      />
    );

    // Should NOT render an img element when hasImage is false
    expect(screen.queryByAltText("Test Product")).not.toBeInTheDocument();
    // But should render the Package icon placeholder (lucide Package icon)
    expect(container.querySelector('svg[class*="lucide"]')).toBeInTheDocument();
  });

  it("skips fetch when hasImage is false", async () => {
    global.fetch = vi.fn();

    render(
      <ProductImage
        productId="prod-1"
        hasImage={false}
        alt="Test Product"
      />
    );

    await waitFor(() => {
      // fetch should not be called at all
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  it("fetches image blob when hasImage is true", async () => {
    const blob = makeImageBlob();
    global.fetch = vi.fn().mockResolvedValueOnce(makeSuccessResponse(blob));

    render(
      <ProductImage
        productId="prod-1"
        hasImage={true}
        alt="Test Product"
      />
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/bibliotheque/products/prod-1/image",
        { credentials: "include" }
      );
    });
  });

  it("renders img element with blob URL when fetch succeeds", async () => {
    const blob = makeImageBlob();
    global.fetch = vi.fn().mockResolvedValueOnce(makeSuccessResponse(blob));
    const blobUrl = "blob:http://localhost/test-123";
    mockCreateObjectURL.mockReturnValue(blobUrl);

    const { container } = render(
      <ProductImage
        productId="prod-1"
        hasImage={true}
        alt="Test Product"
      />
    );

    await waitFor(() => {
      const img = container.querySelector("img");
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute("src", blobUrl);
      expect(img).toHaveAttribute("alt", "Test Product");
    });
  });

  it("creates object URL from fetched blob", async () => {
    const blob = makeImageBlob();
    global.fetch = vi.fn().mockResolvedValueOnce(makeSuccessResponse(blob));

    render(
      <ProductImage
        productId="prod-1"
        hasImage={true}
        alt="Test Product"
      />
    );

    await waitFor(() => {
      expect(mockCreateObjectURL).toHaveBeenCalledWith(blob);
    });
  });

  it("renders placeholder when fetch fails (non-ok response)", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(makeErrorResponse(404));

    const { container } = render(
      <ProductImage
        productId="prod-1"
        hasImage={true}
        alt="Test Product"
      />
    );

    await waitFor(() => {
      const img = container.querySelector("img");
      expect(img).not.toBeInTheDocument();
    });
  });

  it("renders placeholder when fetch throws network error", async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error("Network error"));

    const { container } = render(
      <ProductImage
        productId="prod-1"
        hasImage={true}
        alt="Test Product"
      />
    );

    await waitFor(() => {
      const img = container.querySelector("img");
      expect(img).not.toBeInTheDocument();
    });
  });

  it("revokes object URL on unmount", async () => {
    const blob = makeImageBlob();
    global.fetch = vi.fn().mockResolvedValueOnce(makeSuccessResponse(blob));
    const blobUrl = "blob:http://localhost/test-123";
    mockCreateObjectURL.mockReturnValue(blobUrl);

    const { unmount } = render(
      <ProductImage
        productId="prod-1"
        hasImage={true}
        alt="Test Product"
      />
    );

    await waitFor(() => {
      expect(mockCreateObjectURL).toHaveBeenCalled();
    });

    unmount();

    expect(mockRevokeObjectURL).toHaveBeenCalledWith(blobUrl);
  });

  it("revokes object URL when productId changes", async () => {
    const blob = makeImageBlob();
    global.fetch = vi.fn().mockResolvedValueOnce(makeSuccessResponse(blob));
    const blobUrl1 = "blob:http://localhost/test-123";
    mockCreateObjectURL.mockReturnValue(blobUrl1);

    const { rerender } = render(
      <ProductImage
        productId="prod-1"
        hasImage={true}
        alt="Test Product 1"
      />
    );

    await waitFor(() => {
      expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);
    });

    // Change productId — this should trigger a cleanup of the old URL
    const blob2 = makeImageBlob();
    global.fetch = vi.fn().mockResolvedValueOnce(makeSuccessResponse(blob2));
    const blobUrl2 = "blob:http://localhost/test-456";
    mockCreateObjectURL.mockReturnValue(blobUrl2);

    rerender(
      <ProductImage
        productId="prod-2"
        hasImage={true}
        alt="Test Product 2"
      />
    );

    await waitFor(() => {
      expect(mockRevokeObjectURL).toHaveBeenCalledWith(blobUrl1);
    });
  });

  it("encodes productId in URL", async () => {
    const blob = makeImageBlob();
    global.fetch = vi.fn().mockResolvedValueOnce(makeSuccessResponse(blob));

    render(
      <ProductImage
        productId="prod/with/slashes"
        hasImage={true}
        alt="Test"
      />
    );

    await waitFor(() => {
      const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
      expect(url).toContain("prod%2Fwith%2Fslashes");
    });
  });

  it("includes credentials include in fetch request", async () => {
    const blob = makeImageBlob();
    global.fetch = vi.fn().mockResolvedValueOnce(makeSuccessResponse(blob));

    render(
      <ProductImage
        productId="prod-1"
        hasImage={true}
        alt="Test"
      />
    );

    await waitFor(() => {
      const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
        string,
        RequestInit,
      ];
      expect(init.credentials).toBe("include");
    });
  });

  it("applies className to container", () => {
    const { container } = render(
      <ProductImage
        productId="prod-1"
        hasImage={false}
        alt="Test"
        className="custom-class"
      />
    );

    const div = container.firstChild;
    expect(div).toHaveClass("custom-class");
  });

  it("sets correct aspect ratio on container", () => {
    const { container } = render(
      <ProductImage
        productId="prod-1"
        hasImage={false}
        alt="Test"
      />
    );

    const div = container.firstChild as HTMLElement;
    expect(div.style.aspectRatio).toBe("16/9");
  });
});
