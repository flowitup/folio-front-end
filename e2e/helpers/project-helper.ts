import { Page } from "@playwright/test";
import { ADMIN } from "./seed-data";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api/v1";

/**
 * Resolve a seeded project's id by name (via the backend API) and make it the
 * active project in the browser.
 *
 * Why API + localStorage instead of clicking a card: the projects list renders
 * the name in an `<h3>` that sits OUTSIDE the clickable cover `<button>`, and a
 * project is auto-selected on load (so the name also appears in the sidebar
 * switcher) — both make a name-based card click unreliable. ProjectContext
 * persists the active project under `localStorage["selectedProjectId"]`, so we
 * resolve the id from the API and write it directly.
 *
 * Auth: reuse the session cookie that `loginAsAdmin` already set — `page.request`
 * shares the browser context's cookie jar, and `access_token_cookie` is
 * host-scoped on localhost (port-agnostic), so a plain GET is authenticated.
 * This avoids a second `/auth/login` call per test (login is rate-limited to
 * 5/min). Falls back to one explicit login only if the cookie path is rejected.
 *
 * After this call `/dashboard` renders the chosen project, and the returned id
 * can drive direct navigation to any `/projects/<id>/<subroute>` page.
 */
export async function openProjectByName(page: Page, name: string): Promise<string> {
  let res = await page.request.get(`${API_BASE}/projects`);
  if (res.status() === 401) {
    // Cookie not carried (cross-origin/port edge) — fall back to one login.
    const login = await page.request.post(`${API_BASE}/auth/login`, {
      data: { email: ADMIN.email, password: ADMIN.password },
    });
    const { access_token: token } = await login.json();
    res = await page.request.get(`${API_BASE}/projects`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  const body = await res.json();
  const projects: Array<{ id: string; name: string }> = body.projects ?? body;
  const project = projects.find((p) => p.name === name);
  if (!project) {
    throw new Error(`Project "${name}" not found via API (${projects.length} returned)`);
  }

  // Seed the active-project selection so context-driven pages (e.g. /dashboard)
  // render this project. Must be on the app origin before touching localStorage.
  await page.goto("/en/projects");
  await page.evaluate((id) => localStorage.setItem("selectedProjectId", id), project.id);
  return project.id;
}
