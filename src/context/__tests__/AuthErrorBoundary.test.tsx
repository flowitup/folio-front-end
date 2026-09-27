import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import frMessages from "@/messages/fr.json";
import { AuthErrorBoundary, isNextJsInternalError } from "../AuthErrorBoundary";

function withDigest(digest: string) {
  return Object.assign(new Error(digest), { digest });
}

describe("isNextJsInternalError", () => {
  it("lets notFound(), forbidden() and redirect() through on Next 16", () => {
    expect(isNextJsInternalError(withDigest("NEXT_HTTP_ERROR_FALLBACK;404"))).toBe(true);
    expect(isNextJsInternalError(withDigest("NEXT_HTTP_ERROR_FALLBACK;403"))).toBe(true);
    expect(isNextJsInternalError(withDigest("NEXT_REDIRECT;replace;/en/login;307;"))).toBe(true);
    expect(isNextJsInternalError(withDigest("NEXT_NOT_FOUND"))).toBe(true);
  });

  it("catches ordinary errors", () => {
    expect(isNextJsInternalError(new Error("boom"))).toBe(false);
    expect(isNextJsInternalError(withDigest("123456"))).toBe(false);
  });
});

describe("AuthErrorBoundary fallback", () => {
  afterEach(() => vi.restoreAllMocks());

  it("is translated and keeps the current locale", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    function Boom(): never {
      throw new Error("boom");
    }
    render(
      <NextIntlClientProvider locale="fr" messages={frMessages}>
        <AuthErrorBoundary>
          <Boom />
        </AuthErrorBoundary>
      </NextIntlClientProvider>,
    );
    expect(screen.getByText(frMessages.errors.boundary.title)).toBeInTheDocument();
    expect(screen.queryByText("Authentication Error")).toBeNull();
    expect(screen.getByRole("link", { name: frMessages.errors.boundary.login })).toHaveAttribute(
      "href",
      "/fr/login",
    );
  });
});
