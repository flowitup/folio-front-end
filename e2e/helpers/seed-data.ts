/**
 * Deterministic anchors produced by the backend seed scripts
 * (`folio-back-end/scripts/seed.py --all`). E2E specs reference these
 * constants instead of magic strings so a single seed-data drift is fixed
 * in one place.
 *
 * Source of truth: seed_auth.py, seed_users.py, seed_project.py,
 * seed_invoices.py — all idempotent. Sign-in is phone + SMS code; every
 * seeded user carries a French number (seed_users.py TEST_PHONES).
 */

/** Canonical admin account (seed_auth.py `--with-admin`), signed in by phone. */
export const ADMIN = {
  email: process.env.ADMIN_EMAIL || "admin@example.com",
  phone: process.env.ADMIN_PHONE || "+33612345678",
} as const;

/**
 * The backend's non-production OTP bypass (`OTP_TEST_CODE`), which lets the
 * suite complete a real phone sign-in without reading an SMS. The backend
 * refuses it unless FLASK_ENV is development/testing, so it cannot work
 * against a production deployment.
 */
export const OTP_TEST_CODE = process.env.OTP_TEST_CODE || "424242";

/** Sign-in numbers for the seeded users below (seed_users.py TEST_PHONES). */
export const SEED_PHONES = {
  superadmin: "+33600000001",
  managerAlice: "+33600000003",
  managerBob: "+33600000004",
  userDave: "+33600000006",
  userEve: "+33600000007",
} as const;

/** Selected seeded test users (seed_users.py + seed_memberships.py). */
export const SEED_USERS = {
  managerAlice: "manager.alice@example.com",
  managerBob: "manager.bob@example.com",
  userDave: "user.dave@example.com",
  userEve: "user.eve@example.com",
  client: "client@example.com",
} as const;

/** Seeded project names (seed_project.py), owned by admin. */
export const SEED_PROJECTS = {
  downtown: "Downtown Office Tower",
  /** Projects are labelled by address in the UI; this is the seeded address of `downtown`. */
  downtownLabel: "123 Main Street, Suite 100",
  riverside: "Riverside Apartments",
  mall: "Shopping Mall Renovation",
} as const;

/** Invoice number format `INV-{YYYY}-{NNNN}` (seed_invoices.py). */
export const INVOICE_NUMBER_RE = /INV-\d{4}-\d{4}/;
