/**
 * persons-merge-flow.spec.ts — Person merge (deduplication) happy-path E2E.
 *
 * Scenario:
 *   1. Log in as admin → /en/persons-merge
 *   2. Source typeahead: type a seeded name → pick it
 *   3. Target typeahead: type another seeded name → pick it
 *   4. Click "Merge" → confirm dialog (worker-reassign warning) → confirm
 *   5. Assert the success toast ("Merged \"X\" into \"Y\".")
 *
 * ⚠️  DESTRUCTIVE — MUTATES SEED DATA.
 *   The merge permanently DELETES the source Person row and reassigns its
 *   Worker rows to the target. This spec must run against a FRESH seed and
 *   should NOT be combined in the same run with specs that depend on the
 *   persons it consumes. We pick "Hugo Martin" (source, deleted) and
 *   "Léo Dupont" (target, kept) — two persons unlikely to be referenced by
 *   the other E2E specs. After a run, re-seed before re-running.
 *
 * CI skip:
 *   Set TEST_E2E_PERSONS_MERGE=1 to run locally against a seeded Docker stack.
 *   Without this env var the entire suite is skipped — matching the established
 *   pattern in billing-flow.spec.ts and companies-flow.spec.ts.
 *
 * Run locally (on a fresh seed):
 *   TEST_E2E_PERSONS_MERGE=1 npx playwright test e2e/persons-merge-flow.spec.ts
 */

import { test, expect, type Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers/auth-helper";

const RUN = Boolean(process.env.TEST_E2E_PERSONS_MERGE);

// Two seeded persons chosen to minimise cross-spec coupling. Source is deleted.
const SOURCE_NAME = "Hugo Martin";
const TARGET_NAME = "Léo Dupont";

/**
 * Drive one PersonTypeahead: open its combobox, type a query into the shared
 * CommandInput, then click the matching option.
 *
 * The typeahead is a shadcn Popover + Command combobox:
 *   - trigger = <button role="combobox"> showing `triggerPlaceholder`
 *   - opening reveals a CommandInput (data-testid="person-typeahead-input")
 *   - results render as CommandItems (role="option") containing the person name
 * Search is debounced 200ms server-side.
 */
async function selectPerson(
  page: Page,
  triggerPlaceholder: string | RegExp,
  personName: string,
): Promise<void> {
  // Open the combobox by its trigger placeholder (source vs target differ).
  // TODO(verify): trigger placeholders are source "Pick the duplicate to
  // remove…" / target "Pick the row to keep…" (person-merge-form.tsx).
  await page
    .getByRole("combobox")
    .filter({ hasText: triggerPlaceholder })
    .click();

  // Type into the OPEN popover's CommandInput. Both typeaheads share the same
  // data-testid, so scope to the visible one (only the open popover is shown).
  const input = page.getByTestId("person-typeahead-input").filter({ visible: true });
  await expect(input).toBeVisible({ timeout: 5_000 });
  await input.fill(personName);

  // Wait past the 200ms debounce + server round-trip, then pick the option.
  // CommandItem renders with role="option" and the person's name as text.
  const option = page
    .getByRole("option", { name: new RegExp(personName, "i") })
    .filter({ visible: true });
  await expect(option.first()).toBeVisible({ timeout: 8_000 });
  await option.first().click();
}

test.describe("Person merge happy-path flow", () => {
  test.skip(!RUN, "Skipped in CI: set TEST_E2E_PERSONS_MERGE=1 to run locally");

  test("merge source person into target → success toast", async ({
    page,
  }: {
    page: Page;
  }) => {
    // KNOWN-GAP — both the source and target PersonTypeahead render the same
    // data-testid ("person-typeahead-input") and their Radix popover content
    // portals to <body>, so the two inputs cannot be disambiguated reliably from
    // the test. Hardening this flow needs a distinct test id per typeahead
    // instance (a small component change). Re-enable once the source/target
    // typeaheads expose unique identifiers. (The flow is also destructive —
    // it deletes the source person — so it must run on a fresh seed.)
    test.fixme(true, "PersonTypeahead source/target share one data-testid — needs distinct ids");

    // ── 1. Navigate ───────────────────────────────────────────────────────────
    await loginAsAdmin(page);
    await page.goto("/en/persons-merge");

    await expect(
      page.getByRole("heading", { name: "Merge persons" })
    ).toBeVisible({ timeout: 10_000 });

    // ── 2. Source typeahead ───────────────────────────────────────────────────
    await selectPerson(page, /Pick the duplicate to remove/i, SOURCE_NAME);

    // ── 3. Target typeahead ───────────────────────────────────────────────────
    await selectPerson(page, /Pick the row to keep/i, TARGET_NAME);

    // ── 4. Trigger merge → confirm dialog ─────────────────────────────────────
    // Form "Merge" button (enabled once both are picked and they differ).
    await page.getByRole("button", { name: "Merge", exact: true }).first().click();

    // AlertDialog: title "Merge persons?" + reassign warning.
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await expect(dialog.getByText("Merge persons?")).toBeVisible();

    // Confirm — the dialog's own "Merge" action button.
    await dialog.getByRole("button", { name: "Merge", exact: true }).click();

    // ── 5. Success toast ──────────────────────────────────────────────────────
    // Toast text is `Merged "<source>" into "<target>".` (sonner, hard-coded).
    await expect(
      page.getByText(`Merged "${SOURCE_NAME}" into "${TARGET_NAME}".`)
    ).toBeVisible({ timeout: 10_000 });
  });
});
