# Folio — Web App (Front-end)

The web interface for **Folio**, a Construction Management System for small and mid-sized construction companies. This is the part you actually click on in your browser; the API behind it lives in the [folio-back-end](https://github.com/flowitup/folio-back-end) repository.

---

## What Folio gives you

A clean workspace built for the rhythm of a construction business.

### Sign in, languages & joining a company
- Sign in with your phone number and a 6-digit code sent by SMS — no password. Only French numbers are accepted; the field is already prefixed +33, so the leading 0 is optional.
- The web app has no sign-up screen. An account is created by accepting an email invitation or by signing up in the Folio mobile app. A company admin can add your number in advance (Settings › Company › Add by phone); you're attached to that company automatically when you sign up with that number within 30 days. Signing in with a number that has no account sends no code.
- First time in with no company yet? Folio sends you to a short onboarding step: create a company (you become its admin) or join an existing one with the 8-character code its admin gives you.
- Available in **English, French and Vietnamese**, switchable from the top bar at any time.

### Getting around
One project is selected at a time, and most of the app talks about that project. The **sidebar** lists the sections and carries the project switcher; the **top bar** carries the help guide, notifications bell, language switcher, account menu, and a page-specific action button (New project, New task, Log day, New expense — each shown only if you have the matching rights).

### Dashboard
The project overview after sign-in: this month's spend, a six-month spend-by-type chart, and this week's task agenda linking into Planning. With budget-viewing rights you also see the bank-credit drawdown chart.

### Projects
- A grid of project cards, each titled by its site address, with a "Selected" badge and spend figures (spent on credit, spent personally). The credit total, remaining budget and progress bar need budget-viewing rights. The selected project's card also has **Open dashboard** and **Media** (photos) buttons.
- Company admins create projects with an address (required) plus an optional name and starting budget. Folio identifies projects by address everywhere, so the name is only a fallback label.
- Each card's menu offers edit and delete (both permission-gated), and **Show team** lists who is on the project (see Members below).
- Switching the selected project updates every project-specific section in real time.

### Product library & equipment inventory (company-wide)
- **Library** — a catalogue of the products you buy from suppliers, with purchase history and a side-by-side price comparison.
- **Inventory** — every tool and machine the company owns: how many, whether they're working, and where they are (a warehouse or a site).

Both show your primary company. Anyone attached to the company can browse them; adding, editing or deleting needs the matching management permission.

### Planning (per project)
A Kanban task board — drag cards across the board, starting from the Backlog — plus a week view laid out by due date. Add a title, description, priority, due date and free-text labels. Anyone who can open the project can create, edit and move tasks; deleting a task needs project-editing rights. The top bar's **New task** button only appears for people with those rights; everyone else adds tasks from the board.

### Labor (per project)
A dedicated workspace with four tabs for people who manage labor, see pay or manage expenses, plus a simplified read-only **Day roster** (name, status, hours, day type — no money) for everyone else:

- **Summary** — per-worker totals, with priced cost and bonus cost as separate columns.
- **Attendance** — log who worked each day: full day, half day, overtime, or "supplement hours" only (0–12h, for partial-day or on-call work). Every 8 banked supplement hours convert to a paid bonus day; 4 or more leftover hours earn a bonus half-day.
- **Workers** — your crew list with daily rates and phone numbers. Add, edit or deactivate workers; download a single-worker labor report from the row's download icon.
- **Payments** — what's actually been paid vs. owed per worker, split by company and personal share, with a status (Unpaid / Partial / Settled / Overpaid) and a way to record a payment.

### Labor exports (Excel & PDF)
Export labor data for any 1-to-24-month range in two formats:

- **Excel** — one sheet per month with daily attendance and per-worker totals, plus a Summary sheet aggregating priced and bonus costs across the range. Currency uses French formatting.
- **PDF** — A4 portrait. KPI mini-table at the top, per-worker breakdown below. Vietnamese accents render correctly thanks to bundled fonts.

Export the whole project or just one worker. File names are auto-generated from the project name and date range.

### Cost planning — chiffrage (per project)
Plan what a project needs to buy in sections (e.g. Lighting, Plumbing). List items with a quantity, unit and optional room (rooms show as sub-totalled dividers inside a section), record each shop's price, then compare two shops head to head per section and read the amount to budget. Anyone who can open the project can read it and use the comparison; creating or editing needs expense-management rights.

### Expenses (per project)
- Tabs: **All / Released Funds / Labor / Materials & Services / Others / Return** — Released Funds only shows with budget-viewing rights.
- With budget-viewing rights, a company/personal "purse" view and the bank-credit chart sit above the list: spend against released funds per purse, with a type-by-type breakdown.
- A company cash advance (cash handed to someone, e.g. to pay labor) is filed under Others and counts as company-purse spend, not as released funds. Record what you pay with that cash under your own cash method, not a company one, so it isn't counted twice.
- Returns settle as a cash refund or as an avoir (supplier credit) applied to a later invoice.
- With expense-management rights, create expenses with line items, a payment method and attachments (PDF, JPEG, PNG, WebP, HEIC — up to 10 MB). Expand an expense's row to print it without the app chrome.

### Documents, photos & analyses (per project)
- **Documents** — the project's file library (plans, contracts, permits) with tags, preview, rename and delete. Only people with project-editing rights (company admins, managers on the project, or anyone granted it) can open it; plain members don't see the entry, and opening the URL shows a "restricted" notice.
- **Photos** (labeled *Media* in the app) — progress photos and videos, each with a caption and capture date. Anyone on the project can view; uploading needs project-editing rights. Open it from the **Media** button on the selected project's card (Projects page); it isn't in the sidebar.
- **Analyses** — a shelf of saved HTML reports and guides for the build, each opened in a distraction-free reader.

### Notes (per project)
Short dated cards for the project's build journal — a title, description and category (inspection, delivery, payment, decision, call, general). Mark a note done or reopen it. The list is grouped by when each note was added (Today / Yesterday / Earlier this week / Earlier); search it or filter it by category. Anyone on the project can read the journal; writing, editing and deleting need project-editing rights.

### Billing (company admins)
A separate, company-wide document generator for the paperwork you issue to your own clients. Company admins only — anyone else who opens a Billing page is sent back to the home page.

- **Quotes** — write a quote, mark it as sent and track it through draft/sent/accepted/rejected/expired, then turn an accepted one into an invoice.
- **Invoices** — the invoices you issue to clients, tracked through to paid, with PDF and spreadsheet exports.
- **Templates** — reusable line items, default VAT rate, notes and terms (CGV) for the quotes and invoices you issue often.
- **Refundable** — a company-wide view of materials & services expenses flagged for reimbursement, across every project, where admins set the refund status.

### Members & invitations
- Company admins manage people in **Settings › Company**. The members table sets each person's company role (Admin, Manager or Member) and custom permission grants. Its **Projects** column puts people on sites, always as plain members; the company role is what makes someone a manager. Bring people in with **Add by phone**, **Import from company**, or the company's 8-character join code.
- On the **Projects** page, **Show team** on a card lists who is on that project; people who can manage the project's team can add an existing account or remove someone there.
- Email invitations still exist for people outside the company. The invitee gets a one-time link valid for 7 days; if that email already belongs to a Folio account, the person is added straight away. They join as a plain member — an invitation carries no role. Invites are sent, listed and revoked on a project's members page (`/<locale>/projects/<project-id>/members`), which is no longer linked from the navigation.

### Accept invitation
A public landing page for people clicking an invitation email. The invitee enters their name and phone number and verifies it with an SMS code to create their account — the email is shown read-only, just to confirm which invitation they're accepting, since sign-in itself is phone-only. If that number already has an account, the page asks them to sign in instead and the invitation is not applied. Every other state is handled too: already accepted, expired, revoked, invalid token, or "you're signed in as someone else."

### Team chat & assistant
- A floating chat button opens a drawer with one channel per company you belong to and one per project, plus a private admin channel for company admins. Send text or a photo; see who's read up to your latest message.
- Chat and the **@folio** assistant are separate feature flags on the API. With chat off, the chat button doesn't appear. With the assistant off, its answer buttons are hidden; the Assistant audit link stays visible, but the API refuses the audit request, so the page has nothing to show.
- Company admins get an **Assistant audit** page (under Company settings) listing every `@folio` mention the assistant answered, filterable by date range, company and user.

### Notifications
The bell in the top bar shows attendance days waiting for a manager's validation (validate or reject inline) and, for company admins, new members who joined without a project assignment yet, linking to Settings to place them. The badge (capped at "9+") counts what needs action; new-member events aren't counted. Reminders on notes written before notes became a journal still show up there too.

### Help guide
A question-mark icon next to the bell opens an in-app guide to the main workflows, explained step by step and filtered to what your role can reach, with its own language picker.

### Settings
Every tab here opens something real — there are no "coming soon" placeholders.
- **Profile** — display name and phone. The phone is your sign-in number, so changing it changes how you sign in. Email is shown read-only; only an administrator can change it.
- **Project** — the invoice-number prefix (up to 8 letters/digits) for the project you have selected. Only appears once a project is selected.
- **Company** — every company you belong to: identity card, set-as-primary, detach, attach-by-code. Administering the selected company also adds its join code, a member table with roles and custom per-project or company-wide permission grants, add-by-phone, importing members from another company you admin, payment methods, and the Assistant audit link.
- **Notifications** — per-category switches (team chat, attendance, tasks, team & access, money) for push notifications to the Folio mobile app; they don't affect the web bell.
- **API Keys** — every signed-in user can generate personal API keys to call the Folio API from scripts. A key acts with your permissions (it can't manage your account or other keys) and never expires until you revoke it; it is shown once, and revoking it stops it immediately.
- **Users & Roles** — Folio's support team only: attach an existing account to one or more projects at once. It doesn't set roles — those come from the person's company role and the per-project grants under Company.

The app version sits in a footer under the content, visible from every tab.

### Permissions
What you can see and do depends on your role in the company (Admin, Manager or Member), the projects you're assigned to, and any custom grants an admin has set. Most controls you can't use are hidden. If you open a page you're not allowed on, Folio shows a short "restricted" notice or sends you back to a page you can use (such as Projects or the Overview). The API enforces the same permissions on its side, so anything that slips through is refused.

---

## Running the app

The web app needs the API. Run it from [folio-back-end](https://github.com/flowitup/folio-back-end) — its README covers Docker, migrations and creating a first local account; it listens on `http://localhost:5000` by default.

### Prerequisites
- Node.js 20.19+ or 22.13+ (the Docker image uses Node 22; CI runs Node 20)
- npm

### Environment variables

There's no `.env.example` — create `.env.local` yourself if you need to override a default:

| Variable | When you need it | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Production builds (baked in at build time) | The API base URL, e.g. `http://localhost:5000/api/v1`. Used by the browser, and by the server too unless `API_INTERNAL_BASE_URL` is set. `npm run dev` falls back to that value if unset. |
| `API_INTERNAL_BASE_URL` | When the server can't reach the public URL (e.g. in Docker) | Server-only, read at runtime, never sent to the browser. Used for every server-side API call (sign-in, the session check on each page, server actions), e.g. `http://api:5000/api/v1`. |
| `NEXT_PUBLIC_S3_PUBLIC_URL` | Only if file storage has its own origin | Origin of the S3/MinIO endpoint behind presigned URLs (document upload and preview). Added to the Content-Security-Policy at build time; without it the browser blocks those requests. |

### Install and run

```bash
npm install
npm run dev
```

Open **http://localhost:3000**. You'll be sent to the sign-in page on first visit. Sign-in needs an account on the API you're pointing at; with the API's default `SMS_PROVIDER=log` no SMS is sent and the code appears in the API log.

### Running with Docker

This repo's own `docker compose up -d --build` builds and runs a production container of the front end alone, on port 3000. It does not start the API. Two addresses matter:

- `NEXT_PUBLIC_API_BASE_URL` — the API address your **browser** uses, baked in at build time (default `http://localhost:5000/api/v1`). To change it, export it in your shell (or put it in a `.env` file next to `docker-compose.yml`) and rebuild with `--build`; `.env.local` is not read by the Docker build.
- `API_INTERNAL_BASE_URL` — the API address the **container itself** uses for sign-in and every server-rendered page. Inside the container `localhost` is the container, and `docker-compose.yml` doesn't set this variable, so add it under the service's `environment:` — for example `http://host.docker.internal:5000/api/v1` with Docker Desktop (on Linux, also add `extra_hosts: ["host.docker.internal:host-gateway"]`), or `http://api:5000/api/v1` if the container joins the API's Docker network.

### Useful commands

| Command | Description |
|---|---|
| `npm run dev` | Start the app for local development |
| `npm run build` | Build a production version |
| `npm run start` | Run the production build |
| `npm run test` | Run the unit/component test suite (Vitest) |
| `npm run test:e2e` | Playwright end-to-end suite. Specs are opt-in via `TEST_E2E_*` environment flags and need a running API with seeded data; with no flags they skip. Run `npx playwright install` once first. |
| `npm run lint` | Check code style (ESLint) |
| `npm run type-check` | Check TypeScript types |

CI runs lint, type-check, test and build on every pull request; `test:e2e` isn't part of CI.

---

## Tips for everyday use

- Pick a project from the **sidebar's project switcher** first — Planning, Labor, Expense, Cost planning, Notes, Documents (with project-editing rights) and Analyses only appear in the sidebar once a project is active.
- The **language switcher** is in the top bar; the URL changes to reflect your locale (e.g. `/en/dashboard` vs `/fr/dashboard`).
- The **bell icon** is your attendance-validation and new-member inbox.
- Use the **download icon** on a worker row to grab a labor report scoped to just that person.
- For a printable expense, expand its row in Expense and use the print button; it opens the chrome-free view at `/<locale>/projects/<project-id>/invoices/<expense-id>/print`.

---

## Browser support

Folio is tested on Chromium (desktop and phone emulation); current Edge, Firefox and Safari are expected to work. Below 1024 px wide the sidebar becomes a bottom bar (Overview, Projects, Expense, Planning, More). Library, Inventory, Cost planning and Billing › Refundable aren't reachable from it yet, so use a wider screen for those; a tablet or laptop screen also gives the best experience for tables and exports.

---

## Support & feedback

- Bug reports and feature requests: [open an issue](https://github.com/flowitup/folio-front-end/issues).
- Account or permission issues: contact your company admin.
- The app's public privacy policy and support pages live at `/<locale>/legal/privacy` and `/<locale>/legal/support`.
