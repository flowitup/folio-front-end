# Folio — Web App (Front-end)

The web interface for **Folio**, a Construction Management System for small and mid-sized construction companies. This is the part you actually click on in your browser; the API behind it lives in the [folio-back-end](../folio-back-end) repository.

---

## What Folio gives you

A clean, modern workspace inspired by fintech dashboards — but built for the rhythm of a construction business.

### Sign in & languages
- Secure email + password sign-in. Sessions persist in a secure cookie, so you don't have to log back in on every visit.
- Available in **English, French and Vietnamese**, switchable from the top bar at any time.
- **Light, Dark and System** theme modes. The app remembers your preference.

### Dashboard
The home page after sign-in. KPI cards for active projects, pending tasks and team members, plus a recent-activity panel. The top bar carries your project selector, language switcher, theme toggle, notifications bell and user menu.

### Projects
- A grid of project cards — name, address, member count, an action menu, and a "Selected" badge on whichever project you are currently working in.
- Create new projects with the **+ New Project** button.
- Switching projects updates every project-specific section in real time.

### Labor (per project)
A dedicated workspace with three tabs:

- **Workers** — your crew list with daily rates and phone numbers. Add, edit or deactivate workers; download a single-worker labor report from the row's download icon.
- **Attendance** — log who worked each day. Full day, half day, or "supplement hours" only (0–12 hours, useful for partial-day or on-call work). The system automatically converts banked supplement hours into bonus days at month-end (8h = 1 bonus day, 4h = 1 bonus half-day).
- **Summary** — per-worker totals, with **priced cost** and **bonus cost** shown as separate columns so nothing is hidden inside one figure.

### Labor exports (Excel & PDF)
Export labor data for any 1-to-24-month range in two formats:

- **Excel** — one sheet per month with daily attendance and per-worker totals, plus a Summary sheet aggregating priced and bonus costs across the range. Currency uses French formatting.
- **PDF** — A4 portrait. KPI mini-table at the top, per-worker breakdown below. Vietnamese accents render correctly thanks to bundled fonts.

You can export the whole project or just one worker. File names are auto-generated from the project name and date range.

### Invoices (per project)
- Tabbed list filtered by **All / Client / Labor / Supplier**.
- Create invoices with line items (description, quantity, unit price, total) and a live total.
- Detail view per invoice plus a **print-only** version at `…/invoices/{id}/print` — designed to print cleanly without the app chrome.

### Members & invitations
- See your project's members in one table and pending invitations in another.
- **Invite by email** — invitees get a one-time link valid for 7 days. If they already have a Folio account, they're added directly with a notification.
- Pending invitations show who invited them, the role assigned, and time until expiry; you can revoke any unaccepted invite.
- Invite controls are visible only to project owners and administrators.

### Accept invitation
A public landing page for people clicking an invitation email. The page handles every state cleanly — valid invitation (sign-up form), already accepted, expired, revoked, invalid token, or "you're signed in as someone else."

### Notes & reminders
- Members can post notes on a project with a due date and a lead time.
- When the lead time hits, the note appears as a reminder in the **bell-icon dropdown** at the top of the screen, for every member of the project. Each member dismisses reminders independently.
- Three lead-time presets: **at due time, 1 hour before, 1 day before**.
- An agenda view groups notes by **Today / Tomorrow / This week / Later / Done**, with inline editing on each row.

### Settings
- **Profile** and **Notification preferences** placeholders (coming soon).
- **Users & Roles** tab (administrators only) — bulk-assign roles to existing users across one or more projects in three steps.

### Permissions
Every page respects the role you have on a given project. If you reach a page you aren't allowed to see, Folio takes you to a clean 403 page with a "Go to Dashboard" button — no broken UI, no leaked data.

---

## Running the app

The web app needs the API to be running. The easiest way to start both at once is the `docker compose up -d` command at the root of the [folio repo](..).

If you only want to run the front-end (with the API running somewhere else):

### Prerequisites
- Node.js 20 LTS
- npm

### Install and run

```bash
npm install
cp .env.example .env.local
```

Edit `.env.local` and point it at your API:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api/v1
```

Start the dev server:

```bash
npm run dev
```

Open **http://localhost:3000**. You'll be sent to the login page on first visit.

### Useful commands

| Command | Description |
|---|---|
| `npm run dev` | Start the app for local development |
| `npm run build` | Build a production version |
| `npm run start` | Run the production build |
| `npm run test` | Run the automated test suite |
| `npm run lint` | Check code style |

---

## Tips for everyday use

- Pick a project from the **top bar** before navigating to Labor or Invoices — those sections only appear once a project is active.
- The **language switcher** is in the top bar; the URL changes to reflect your locale (e.g. `/en/dashboard` vs `/fr/dashboard`).
- The **bell icon** is your reminder + notification inbox. Numbers indicate unread items.
- Use the **download icon** on a worker row to grab a labor report scoped to just that person.
- For printable invoices, navigate to the invoice detail and add `/print` to the URL — or use the print link in the UI.

---

## Browser support

Folio works on the latest versions of Chrome, Edge, Firefox, and Safari, on desktop and tablet sizes. The interface adapts to smaller widths, but a tablet or laptop screen gives the best experience for tables and exports.

---

## Support & feedback

- Bug reports and feature requests: open an issue on the project tracker.
- Account or permission issues: contact the project owner or your administrator.
