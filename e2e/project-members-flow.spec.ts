/**
 * E2E: Project members flow (happy path).
 *
 * Scenario:
 *   1. Login as admin → open the Downtown Office Tower project (resolve its id)
 *   2. Go to /en/projects/<id>/members
 *   3. Assert the seeded members table shows manager.alice & user.dave emails
 *   4. Open the invite dialog → enter a unique new email → pick a role → submit
 *   5. Assert a pending-invitation row with that email appears
 *   6. Revoke it (native confirm dialog) → assert the row is removed
 *
 * A brand-new (unseeded) email is used so the backend returns "invitation_sent"
 * (not "direct_added"), guaranteeing a pending-invitation row to revoke.
 *
 * Env flag: TEST_E2E_MEMBERS — requires a running backend with seeded data
 * (Downtown project has members manager.alice & user.dave). Skipped in CI
 * unless TEST_E2E_MEMBERS=1.
 *
 * Run locally:
 *   TEST_E2E_MEMBERS=1 npx playwright test e2e/project-members-flow.spec.ts
 */

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers/auth-helper";
import { openProjectByName } from "./helpers/project-helper";
import { SEED_PROJECTS, SEED_USERS } from "./helpers/seed-data";

const RUN = Boolean(process.env.TEST_E2E_MEMBERS);

test.describe("Project members flow", () => {
  test.skip(!RUN, "Skipped in CI: set TEST_E2E_MEMBERS=1 to run locally");

  test("members listed → invite → pending row → revoke → gone", async ({ page }) => {
    // ── 1. Login + resolve project id ────────────────────────────────────────
    await loginAsAdmin(page);
    const pid = await openProjectByName(page, SEED_PROJECTS.downtown);

    // ── 2. Navigate to the members sub-route ─────────────────────────────────
    await page.goto(`/en/projects/${pid}/members`);
    await page.waitForLoadState("networkidle");

    // ── 3. Seeded members table shows alice + dave emails ────────────────────
    // Members table renders member.email in a cell (members-table.tsx ~162).
    // The roster renders twice (members-mobile cards + members-desktop table);
    // scope to the visible copy to avoid a strict-mode 2-element match.
    await expect(
      page.getByText(SEED_USERS.managerAlice).filter({ visible: true }).first()
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText(SEED_USERS.userDave).filter({ visible: true }).first()
    ).toBeVisible({ timeout: 10_000 });

    // ── 4. Open the invite dialog and submit a new invite ────────────────────
    // Trigger button text: members.invite.button = "Invite member".
    await page.getByRole("button", { name: "Invite member" }).click();

    // Dialog title: members.invite.dialogTitle = "Invite a new member".
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Invite a new member")).toBeVisible({ timeout: 10_000 });

    const inviteEmail = `e2e.invite.${Date.now()}@example.com`;
    // Email <Input id="invite-email"> labelled "Email address".
    await dialog.locator("#invite-email").fill(inviteEmail);

    // Role is a required Radix Select (trigger #invite-role, implicit
    // role="combobox"). Open it and pick the first available role option so the
    // submit button enables. Mirrors e2e/invite-flow.spec.ts.
    await dialog.getByRole("combobox").click();
    const firstRoleOption = page.getByRole("option").first();
    await expect(firstRoleOption).toBeVisible({ timeout: 5_000 });
    await firstRoleOption.click();

    // Submit button text: members.invite.submit = "Send invitation".
    await dialog.getByRole("button", { name: "Send invitation" }).click();

    // Dialog closes on success (members-table/invite-member-dialog onOpenChange).
    await expect(dialog).not.toBeVisible({ timeout: 10_000 });

    // Success toast: members.toast.inviteSent = "Invitation sent to {email}".
    await expect(page.getByText(`Invitation sent to ${inviteEmail}`)).toBeVisible({
      timeout: 10_000,
    });

    // ── 5. Pending-invitation row/card with that email appears ───────────────
    // Pending invites render twice: desktop <tr> rows (invites-desktop) and
    // mobile cards (invites-mobile). Match the unit (row or card) that holds
    // this email in whichever copy the viewport shows.
    const pendingUnitAll = page.locator(
      '[data-testid="invites-desktop"] tr, [data-testid="invites-mobile"] > div'
    );
    const pendingUnit = pendingUnitAll
      .filter({ hasText: inviteEmail })
      .filter({ visible: true });
    await expect(pendingUnit).toBeVisible({ timeout: 15_000 });

    // ── 6. Revoke it ─────────────────────────────────────────────────────────
    // Revoke uses native window.confirm (members-table.tsx ~74), NOT an
    // AlertDialog — register a one-shot dialog handler that accepts it.
    page.once("dialog", (d) => d.accept());
    // Revoke button text: members.revoke = "Revoke" (scoped to the pending unit).
    await pendingUnit.getByRole("button", { name: "Revoke" }).click();

    // Success toast: members.toast.revoked = "Invitation revoked".
    await expect(page.getByText("Invitation revoked")).toBeVisible({ timeout: 10_000 });

    // ── Assert the pending row/card is gone ──────────────────────────────────
    await expect(
      pendingUnitAll.filter({ hasText: inviteEmail })
    ).toHaveCount(0, { timeout: 10_000 });
  });
});
