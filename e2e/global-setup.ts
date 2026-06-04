import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { ADMIN } from "./helpers/seed-data";

/**
 * Playwright global setup — provisions the deterministic dataset by running
 * the backend seed scripts against the running Docker `api` container.
 *
 * FAIL-SOFT BY DESIGN: only runs when `E2E_SEED=1`. If the flag is unset, or
 * the folio root / Docker stack can't be found, it logs and returns without
 * throwing — so `playwright test` still works in a backend-less env (CI, where
 * the env-gated specs skip anyway).
 *
 * Prerequisite when E2E_SEED=1: the Docker stack must already be UP. This hook
 * seeds an existing stack; it does not boot one.
 */
export default async function globalSetup(): Promise<void> {
  if (process.env.E2E_SEED !== "1") {
    console.log("[global-setup] E2E_SEED!=1 → skipping seed (specs self-guard).");
    return;
  }

  // Resolve the folio workspace root (parent umbrella holding folio-front-end),
  // allowing an explicit override for worktrees/non-standard checkouts.
  // Standard layout: <root>/folio-front-end/e2e → <root> is two levels up.
  const folioRoot =
    process.env.FOLIO_ROOT || path.resolve(__dirname, "..", "..");

  if (!existsSync(path.join(folioRoot, "docker-compose.yml"))) {
    console.warn(
      `[global-setup] No docker-compose.yml under ${folioRoot}. ` +
        "Set FOLIO_ROOT to the folio workspace root. Skipping seed."
    );
    return;
  }

  try {
    console.log("[global-setup] Seeding via seed.py --all …");
    execSync("docker compose exec -T api python scripts/seed.py --all", {
      cwd: folioRoot,
      stdio: "inherit",
      env: {
        ...process.env,
        ADMIN_EMAIL: ADMIN.email,
        ADMIN_PASSWORD: ADMIN.password,
      },
    });
    console.log("[global-setup] Seed complete.");
  } catch (err) {
    console.warn(
      `[global-setup] Seed command failed (is the Docker stack up?): ${
        (err as Error).message
      }. Continuing — env-gated specs will skip if data is missing.`
    );
  }
}
