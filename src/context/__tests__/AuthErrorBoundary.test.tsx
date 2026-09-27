/**
 * notFound() must reach Next's not-found page, not this boundary's
 * session-clearing error screen.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Component, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import fr from "@/messages/fr.json";
import { AuthErrorBoundary } from "../AuthErrorBoundary";

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
    <NextIntlClientProvider locale="fr" messages={fr}>
      <Outer>
        <AuthErrorBoundary>
          <Thrower error={error} />
        </AuthErrorBoundary>
      </Outer>
    </NextIntlClientProvider>
  );
}

describe("AuthErrorBoundary", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(["NEXT_HTTP_ERROR_FALLBACK;404", "NEXT_HTTP_ERROR_FALLBACK;403", "NEXT_REDIRECT;replace;/fr/login;307;"])(
    "lets %s through to Next",
    (digest) => {
      renderWith(Object.assign(new Error(digest), { digest }));
      expect(screen.getByText(`outer:${digest}`)).toBeInTheDocument();
    }
  );

  it("shows a translated fallback for other errors", () => {
    renderWith(new Error("boom"));
    expect(screen.getByText(fr.authErrorBoundary.title)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: fr.authErrorBoundary.goToLogin })).toBeInTheDocument();
  });
});
