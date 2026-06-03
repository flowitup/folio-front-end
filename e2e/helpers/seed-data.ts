/**
 * Deterministic anchors produced by the backend seed scripts
 * (`folio-back-end/scripts/seed.py --all`). E2E specs reference these
 * constants instead of magic strings so a single seed-data drift is fixed
 * in one place.
 *
 * Source of truth: seed_auth.py, seed_users.py, seed_project.py,
 * seed_invoices.py — all idempotent, password is uniform across users.
 */

/** Canonical admin login (seed_auth.py `--with-admin`). */
export const ADMIN = {
  email: process.env.ADMIN_EMAIL || "admin@example.com",
  password: process.env.ADMIN_PASSWORD || "password123",
} as const;

/** Every seeded user shares this password (seed_users.py). */
export const SEED_PASSWORD = "password123";

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
  riverside: "Riverside Apartments",
  mall: "Shopping Mall Renovation",
} as const;

/** Invoice number format `INV-{YYYY}-{NNNN}` (seed_invoices.py). */
export const INVOICE_NUMBER_RE = /INV-\d{4}-\d{4}/;
