/**
 * notFound(), forbidden() and redirect() must reach Next (its not-found page),
 * not this boundary's error screen.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { Component, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import frMessages from "@/messages/fr.json";
import { AuthErrorBoundary, isNextJsInternalError } from "../AuthErrorBoundary";

function withDigest(digest: string) {
  return Object.assign(new Error(digest), { digest });
}

class Outer extends Component<{ children: ReactNode }, { caught: string | null }> {
  state = { caught: null as string | null };
  static getDerivedStateFromError(error: Error & { digest?: string }) {
    return { caught: error.digest ?? error.message };
  }
  render() {
    return this.state.caught ? <p>outer:{this.state.caught}</p> : this.props.children;
  }
}

function Thrower({ error }: { error: Error }): never {
  throw error;
}

function renderWith(error: Error) {
  return render(
    <NextIntlClientProvider locale="fr" messages={frMessages}>
      <Outer>
        <AuthErrorBoundary>
          <Thrower error={error} />
        </AuthErrorBoundary>
      </Outer>
    </NextIntlClientProvider>
  );
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

describe("AuthErrorBoundary", () => {
  afterEach(() => vi.restoreAllMocks());

  it.each(["NEXT_HTTP_ERROR_FALLBACK;404", "NEXT_HTTP_ERROR_FALLBACK;403", "NEXT_REDIRECT;replace;/fr/login;307;"])(
    "lets %s through to Next",
    (digest) => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      renderWith(withDigest(digest));
      expect(screen.getByText(`outer:${digest}`)).toBeInTheDocument();
    }
  );

  it("shows a translated fallback that keeps the current locale", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderWith(new Error("boom"));
    expect(screen.getByText(frMessages.errors.boundary.title)).toBeInTheDocument();
    expect(screen.queryByText("Authentication Error")).toBeNull();
    expect(screen.getByRole("link", { name: frMessages.errors.boundary.login })).toHaveAttribute(
      "href",
      "/fr/login"
    );
  });
});
