/**
 * Browser-tab titles are translated and page-specific: every app page sets a
 * title (itself or through a section layout) in the URL's language, followed
 * by the app name.
 */
import { describe, it, expect, vi } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";

vi.mock("next-intl/server", () => ({
  getTranslations: async ({ locale }: { locale: string }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const messages = require(`../../../messages/${locale}.json`) as Record<string, unknown>;
    return (key: string) =>
      key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], messages) as string;
  },
}));

import { pageTitle } from "../page-title";

const appRoot = path.resolve(__dirname, "../../../app/[locale]");

function pages(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === "__tests__" ? [] : pages(full);
    return name === "page.tsx" ? [full] : [];
  });
}

const setsTitle = (file: string) => existsSync(file) && /export (const|async function) generateMetadata\b/.test(readFileSync(file, "utf8"));

describe("page titles", () => {
  it("translates a page title into the URL's locale", async () => {
    const generateMetadata = pageTitle("navigation.labor");
    const title = async (locale: string) => (await generateMetadata({ params: Promise.resolve({ locale }) })).title;

    expect(await title("en")).toEqual({ absolute: "Labor · Folio" });
    expect(await title("fr")).toEqual({ absolute: "Main-d'œuvre · Folio" });
    expect(await title("vi")).toEqual({ absolute: "Nhân công · Folio" });
  });

  it("gives every app page its own title, set by the page or a section layout", () => {
    const appGroup = path.join(appRoot, "(app)");
    const untitled = pages(appGroup).filter((page) => {
      if (setsTitle(page)) return false;
      for (let dir = path.dirname(page); dir !== appGroup; dir = path.dirname(dir)) {
        if (setsTitle(path.join(dir, "layout.tsx"))) return false;
      }
      return true;
    });
    expect(untitled.map((p) => path.relative(appRoot, p))).toEqual([]);
  });

  it("titles the sign-in page", () => {
    expect(setsTitle(path.join(appRoot, "login/page.tsx"))).toBe(true);
  });
});
