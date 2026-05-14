/**
 * Locale wiring for the labor attendance calendar.
 *
 * Regression for PR #60 — the calendar used to hardcode "fr-FR" for the
 * month header and fall back to navigator.language for the weekday
 * headers, so an English user on a Vietnamese browser saw
 * "Mai 2026" / "THỨ 2 … CN" / "FÊTE DU TRAVAIL". The locale now
 * threads from next-intl's useLocale() through
 * AttendanceCalendar → CalendarMonthGrid → CalendarCell.
 *
 * The exact short-weekday and long-month strings come from Node's ICU,
 * so the expected values below match what `toLocaleDateString` actually
 * produces in this runtime (verified against Node 22 ICU):
 *   en  → "Mon Tue Wed Thu Fri Sat Sun" / "May 2026"
 *   fr  → "lun mar mer jeu ven sam dim" / "mai 2026"   (CSS-capitalized in UI)
 *   vi  → "Thứ 2 … CN"                  / "tháng 5 năm 2026"
 *
 * Holiday strings are pulled from messages/*.json via t("labor.holidays.*"),
 * so they're locale-stable regardless of ICU.
 */

import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import enMessages from "@/messages/en.json";
import frMessages from "@/messages/fr.json";
import viMessages from "@/messages/vi.json";

import { CalendarMonthGrid } from "../calendar-month-grid";
import { CalendarCell } from "../calendar-cell";
import { monthLabel } from "@/lib/utils/calendar-month";
import { getFrenchHolidayKey } from "@/lib/utils/french-holidays";

type Loc = "en" | "fr" | "vi";

const messagesByLocale = {
  en: enMessages,
  fr: frMessages,
  vi: viMessages,
} as const;

function renderWithLocale(locale: Loc, ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale={locale} messages={messagesByLocale[locale]}>
      {ui}
    </NextIntlClientProvider>,
  );
}

// May 2026: Friday 1 May is Labour Day, a public holiday.
const MAY_2026 = { year: 2026, monthIdx: 4 };
const MAY_FIRST = new Date(2026, 4, 1);

// What we expect rendered for each locale.
// `weekdayHeaders` matches the CalendarMonthGrid output verbatim (CSS
// uppercases for display; the assertion is case-insensitive).
// `monthHeader` is the toLocaleDateString output (CSS capitalizes for
// French; the assertion is also case-insensitive).
// `mayFirstHoliday` is the translated "Labour Day" string.
const EXPECTED: Record<Loc, {
  weekdayHeaders: string[];
  monthHeader: string;
  mayFirstHoliday: string;
}> = {
  en: {
    weekdayHeaders: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    monthHeader: "May 2026",
    mayFirstHoliday: "Labour Day",
  },
  fr: {
    weekdayHeaders: ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"],
    monthHeader: "mai 2026",
    mayFirstHoliday: "Fête du Travail",
  },
  vi: {
    weekdayHeaders: ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "CN"],
    monthHeader: "tháng 5 năm 2026",
    mayFirstHoliday: "Ngày Quốc tế Lao động",
  },
};

describe("attendance calendar — locale wiring", () => {
  describe.each(["en", "fr", "vi"] as const)("locale=%s", (locale) => {
    const expected = EXPECTED[locale];

    it("CalendarMonthGrid renders Monday-first weekday headers in the chosen locale", () => {
      renderWithLocale(
        locale,
        <CalendarMonthGrid
          year={MAY_2026.year}
          monthIdx={MAY_2026.monthIdx}
          entries={[]}
          locale={locale}
        />,
      );

      // The header row is aria-hidden but stays in the DOM. Locate it by
      // walking up from any header cell, then assert ordered text content.
      // CSS uppercases the label; compare case-insensitively.
      for (const label of expected.weekdayHeaders) {
        const re = new RegExp(`^${label}$`, "i");
        expect(screen.getByText(re)).toBeInTheDocument();
      }
    });

    it("monthLabel returns a localized month + year string", () => {
      expect(monthLabel(MAY_FIRST, locale)).toBe(expected.monthHeader);
    });

    it("CalendarCell shows the localized holiday name on 1 May (Labour Day)", () => {
      renderWithLocale(
        locale,
        <CalendarCell date={MAY_FIRST} entries={[]} />,
      );

      // Holiday name is rendered uppercase via CSS. Compare insensitively.
      // The cell button also has an aria-label that includes the same
      // holiday string, so scope to the visible span via title attribute.
      const cell = screen.getByRole("button", { name: new RegExp(expected.mayFirstHoliday, "i") });
      expect(cell).toBeInTheDocument();
      expect(within(cell).getByText(new RegExp(expected.mayFirstHoliday, "i"))).toBeInTheDocument();
    });
  });

  it("getFrenchHolidayKey maps 1 May to the labourDay translation key", () => {
    expect(getFrenchHolidayKey(MAY_FIRST)).toBe("labourDay");
  });
});
