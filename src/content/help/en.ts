import type { HelpCatalogue, HelpChrome } from "./types";

/**
 * The English workflow guide for the web app. Every step names a control that actually exists in
 * the shipped app: removed features — phase tags above all — are deliberately absent, and the
 * hard-coded weather strip on the overview is not described as data.
 */
export const helpCatalogueEn: HelpCatalogue = [
  {
    id: "getting-started",
    title: "Signing in and joining a company",
    purpose:
      "Folio signs you in with your phone number and a code by SMS — there is no password. Your account then has to belong to a company before it can see anything.",
    steps: [
      "Enter your phone number on the sign-in page and ask for a code.",
      "Type the code you receive by SMS to finish signing in.",
      "If your account belongs to no company yet, Folio sends you to a short onboarding page.",
      "There, either create a company — you become its administrator — or join an existing one with the code its administrator gave you.",
      "If you were invited by email instead, the link in that message attaches you directly.",
    ],
    gotchas: [
      "Only French numbers are accepted, and without the leading zero.",
    ],
    whoCanDoIt: "Anyone with a phone number that has been added to a company.",
  },
  {
    id: "navigation",
    title: "Finding your way around",
    purpose:
      "One project is selected at a time, and most of the app talks about that project. The sidebar holds the project sections; the bar across the top holds the actions.",
    steps: [
      "Pick the active site from the project switcher at the top of the sidebar. On a narrow screen it sits in the top bar instead.",
      "The sidebar's first group is app-wide: Overview, Projects and Library.",
      "Once a project is selected the sidebar grows its sections: Planning, Labor, Expense, Cost planning, Members, Notes, Documents and Analyses.",
      "Company administrators also see a Billing group: Quotes, Invoices, Templates and Refundable.",
      "The top bar carries the page's main action, the help mark, the bell, the light and dark switch, the language picker and your account menu.",
    ],
    whoCanDoIt:
      "Everyone sees the app-wide group. Documents only appears if you may open it, and Billing only for company administrators.",
    gotchas: [
      "The top bar's action button changes with the page, and it is hidden entirely when you lack the right for it — so if you expected “New expense” or “Log day” and it is not there, that is a permission, not a bug.",
    ],
  },
  {
    id: "dashboard",
    title: "The project overview",
    purpose:
      "A read-only picture of the selected site: what has been spent this month, how far the bank credit has been drawn down, spend by type over six months, and this week's tasks.",
    steps: [
      "Select a project first — with none selected the panels stay empty.",
      "Read “Spent this month” and the share of the budget it represents.",
      "Read the “Bank credit release” chart. With no credit recorded it offers “Open project settings” instead.",
      "Use “Monthly spend by type” to see where the money went, and “Expense” to jump into the ledger.",
      "Read “This week” for tasks due, with overdue ones stamped, and “Agenda” to open Planning.",
    ],
    whoCanDoIt:
      "Anyone signed in. The financing half — the bank-credit chart and the budget-relative figures — needs budget-viewing rights and is simply not drawn without them.",
    gotchas: [
      "“Overview” is deliberately read-only and has no action button of its own.",
    ],
  },
  {
    id: "projects",
    title: "Projects and their settings",
    purpose:
      "Every site you can see, with its credit and spend, its team, and the forms to create, edit or delete one.",
    steps: [
      "Filter the list with the “All projects” and “Active” toggle, or search by name.",
      "Click “New project”, then give it a name — required — and optionally an address, a credit total and a funding source. If you administer several companies, pick which one it belongs to.",
      "On a project card, the actions menu offers “Edit project” and “Delete project”. Deleting asks you to type the confirmation text shown in bold.",
      "“Show team” expands the member list; “Invite” adds someone, and the row's trash icon removes them.",
      "“Open dashboard” selects the project and opens its overview; “Media” opens its photos.",
      "On the project settings page, set the bank credit and the funding source, and the invoice number prefix, then save.",
    ],
    whoCanDoIt:
      "Creating a project needs company administration. Editing needs project-editing rights, and deleting is administrator-only. Inviting and removing members needs user-management rights. The credit and remaining columns need budget-viewing rights.",
    gotchas: [
      "The project settings page is hard to reach: its only link is “Open project settings” in the bank-credit chart, and that link disappears once a credit has been recorded.",
      "Someone who cannot create projects and has none assigned sees a “Waiting to be assigned” message rather than an invitation to create one.",
    ],
  },
  {
    id: "planning",
    title: "Tasks and planning",
    purpose:
      "The team's task board for one site: a Kanban board with a backlog, plus a week view laid out by due date.",
    steps: [
      "Switch between “Board” and “Week” with the toggle at the top.",
      "On the board, work across the backlog strip and the “To do”, “In progress”, “Blocked” and “Done” columns.",
      "Click “Add task” in any column to create one there: a title, a description, a priority, a due date and comma-separated labels.",
      "Drag a card between columns to change its status.",
      "Click a card to open its detail panel, edit it inline, or delete it.",
      "In the week view, move between weeks and use the “+” on a day to create a task due that day, or the one on “Unscheduled” for a task with no date.",
    ],
    whoCanDoIt:
      "Anyone who can open the project. Planning has no permission gate at all — everyone can create, move, edit and delete tasks.",
    gotchas: [
      "Deleting a task is immediate and has no undo, only a browser confirmation.",
    ],
  },
  {
    id: "labor",
    title: "Attendance, workers and pay",
    purpose:
      "Who was on site, on which days, at what daily rate, what that costs, and what has actually been paid to each worker.",
    steps: [
      "Choose a tab: “Summary”, “Attendance”, “Workers” or “Payments”.",
      "On “Workers”, click “Add worker” and fill in the name, phone, role and daily rate. Each row can then be edited, deactivated, or given a rate change.",
      "“Adjust pay rate” takes a new daily rate and the date it takes effect; the history below lists and removes scheduled changes.",
      "On “Attendance”, click “Log day”, pick the date, then tick everyone who was present — optionally reusing the previous day, and per worker a rate override, a note and a supplement.",
      "Days a worker logged themselves arrive as “Pending validation” and stay unpriced until you use “Validate” or “Reject”.",
      "Export attendance for a worker or everyone, over a range of months, as xlsx or pdf.",
      "On “Payments”, read what each worker is owed against what has been paid, record a payment, or attribute a labor expense that has no worker attached.",
    ],
    whoCanDoIt:
      "Logging days, editing entries and validating need attendance-management rights. Recording payments needs invoice rights. Someone with none of those sees a single “Day roster” — names, status, hours and day type, and no money at all.",
    gotchas: [
      "Re-adding a day a worker already logged is refused; validate their pending entry instead.",
    ],
  },
  {
    id: "invoices",
    title: "The expense ledger",
    purpose:
      "Every euro in and out of one site — supplier expenses, labor payments, funds released by the bank and returns — with attachments, highlighting and export.",
    steps: [
      "Read the two-purse summary and the bank-credit chart at the top of the page.",
      "Filter with the type tabs: all, released funds, labor, materials and services, others, or returns.",
      "Click “New expense” and set the type, the issue date, the recipient — for labor this becomes a worker picker — the payment method and any notes.",
      "Add line items with a description, quantity, unit price and VAT rate, then save.",
      "For a return, pick the materials-and-services expense it refunds, say whether it was settled in cash or as a credit note, and for a credit note which invoice it was applied to.",
      "Click a row to expand it: print or save the PDF, edit it, delete it, or drag attachments onto it.",
      "Export a month range, filtered by type, as xlsx or pdf; and give rows a highlight colour to group them by eye.",
    ],
    whoCanDoIt:
      "Anyone on the project can read the list and export it. Editing, deleting, highlighting and everything inside an expanded row needs invoice rights. Without budget-viewing rights the purses and the bank chart are hidden and the released-funds tab disappears.",
    gotchas: [
      "A released-funds entry marked as a company cash advance is deliberately not counted as released funds. What you then buy with that cash must be recorded against your own cash method, or it is counted twice.",
      "Rows Folio generated itself can never be edited or deleted.",
    ],
  },
  {
    id: "chiffrage",
    title: "Cost planning",
    purpose:
      "Plan what has to be bought for the site — sections of items with quantities — record each shop's price per item, and get the amount to budget.",
    steps: [
      "Click “New section” and name it after a trade or an area, for example lighting or plumbing.",
      "Inside a section, add an item with a name, a quantity, a unit and a room.",
      "On an item, add a price: pick the shop — or type a name and add it inline — then the unit price, whether that price is before or after tax, the VAT rate, and optionally a product link.",
      "Expand an item to compare the prices you have collected; each is badged as retained, cheapest, or automatically cheapest. “Retain” fixes the price the budget uses.",
      "Use “Compare” on a section to put two shops head to head and read the gap per item and per basket.",
      "Read the totals card for the amount to budget, before and after tax, with a warning while items still have no price.",
    ],
    whoCanDoIt:
      "Anyone who can open the project may read it and use the comparison. Creating and editing sections, items and prices needs invoice rights; without them the page is read-only.",
    gotchas: [
      "Shops are name-only: there is no way to record or edit a shop's address or website, and none to delete one.",
      "Prices are compared by shop, so pick the same shop each time or the comparison quietly breaks.",
    ],
  },
  {
    id: "members",
    title: "Who works on this project",
    purpose:
      "Who is on this site and how they got here: assign people already in the company, invite new ones by email, and remove them.",
    steps: [
      "Click “Assign member”, search the company directory by name or phone, choose the role, and assign.",
      "Click “Invite member” to send an email invitation. An existing Folio account is added straight away; anyone else gets a link valid for seven days.",
      "Read the members table: name, email and when they joined.",
      "Use a row's “Edit” to correct a display name or email, or “Remove” to take someone off the project.",
      "Under “Pending invitations”, see who has not accepted yet and revoke an invitation if you need to.",
    ],
    whoCanDoIt:
      "Assigning needs project-editing rights, inviting and revoking need invitation rights, and editing or removing needs user-management rights. Only a company administrator can hand out the manager role; a manager can only assign “Member”.",
    gotchas: [
      "The project role is not editable from “Edit member” — roles are granted and changed through “Assign member”.",
    ],
  },
  {
    id: "notes",
    title: "The build journal",
    purpose:
      "Short dated cards recording what happened on site: decisions, calls, deliveries, inspections and payments.",
    steps: [
      "Type into the quick-add box at the top; focusing it reveals the body field.",
      "Optionally give the note a category: inspection, delivery, payment, decision, call or general.",
      "Save the note. Cards group themselves under today, yesterday, earlier this week and earlier.",
      "Click a card to edit it in place, or tick it to mark it done and untick to reopen it.",
      "Search the journal, or narrow it with the category filter.",
    ],
    whoCanDoIt:
      "Anyone on the project can read the journal. Writing, editing, marking done and deleting all need project-editing rights.",
    gotchas: [
      "Deleting a note has no confirmation: it disappears at once, with a short undo toast. Once that toast is gone the note is gone.",
    ],
  },
  {
    id: "documents",
    title: "Project documents",
    purpose:
      "The site's file library — plans, contracts, permits — with tagging, preview, rename and delete.",
    steps: [
      "Drag files onto the dropzone or click to choose them. PDF, PNG, JPG, WebP, DOCX, XLSX, DWG and TXT are accepted, up to 150 MB each.",
      "Uploads run on their own; each row moves from queued to uploading to uploaded.",
      "Narrow the library with the kind chips, the uploader dropdown and the tag chips, and reset them in one click.",
      "Per file: preview a PDF or image, download it, rename it — the extension cannot change — or delete it.",
      "Add free-text tags inline from the tags column.",
    ],
    whoCanDoIt:
      "Project administrators and managers only. This is the one project area a plain member cannot even read, and the sidebar hides it from them entirely.",
    gotchas: [
      "Renaming or deleting can still be refused even for a manager: only the person who uploaded a file, or a project administrator, may change it.",
    ],
  },
  {
    id: "photos",
    title: "Site photos and videos",
    purpose:
      "The visual record of the build — progress photos and videos, each with a caption and the date it was taken.",
    steps: [
      "Open “Media” from a project card.",
      "Click “Add media” to upload. Images may be JPEG, PNG or WebP up to 25 MB; videos may be MP4, WebM or MOV up to 50 MB.",
      "Open an item to write a caption describing what is shown, and to set the date taken.",
      "Delete an item from the same place; it asks first, and deletion is permanent.",
    ],
    whoCanDoIt:
      "Anyone on the project can look. Uploading, captioning and deleting need project-editing rights.",
  },
  {
    id: "analyses",
    title: "Analysis reports",
    purpose:
      "A shelf of saved HTML reports and guides for the build, each opened in a distraction-free reader.",
    steps: [
      "Click “Upload analysis” and choose the HTML report — it must be self-contained, with no external files, and at most 2 MB.",
      "Give it a title, and optionally a summary, a source URL and tags.",
      "Narrow the shelf with the search box and the tag chips.",
      "Click a card to open the reader; the panel beside it shows who uploaded it, when, and its source.",
      "Use “Edit” or “Delete” on the report's own page.",
    ],
    whoCanDoIt:
      "Anyone on the project can read. Uploading, editing and deleting need project-editing rights.",
    gotchas: [
      "There is no edit or delete on a card in the grid — open the report first.",
    ],
  },
  {
    id: "bibliotheque",
    title: "The product library",
    purpose:
      "A company-wide catalogue of the products you buy from suppliers, with their purchase history and a side-by-side price comparison.",
    steps: [
      "Search by product name, or filter by supplier and category.",
      "Click “Add product”, choose an existing supplier or create one, then fill in the name — required — and optionally a reference, category, size, description, link and image.",
      "Click a product card for its details and its purchase history: date, reference, receipt, order, quantity and unit price.",
      "From that dialog, edit the product or delete it. Deleting asks you to type the product name.",
      "Click “Compare”, tick up to four products, then compare them side by side.",
    ],
    whoCanDoIt:
      "Anyone attached to a company can read it. The add, edit and delete controls are always shown, but the server refuses changes unless you hold the library-management permission and tells you so.",
    gotchas: [
      "The library belongs to one company — your primary one — and there is no company picker.",
    ],
  },
  {
    id: "billing-devis",
    title: "Quotes",
    purpose:
      "The quotes your company issues to its own clients: write them, send them, track them, and turn an accepted one into an invoice.",
    steps: [
      "Open Billing → Quotes and click “New quote”.",
      "Start from blank, from an existing document, or from a template.",
      "If you administer several companies, choose which one issues the quote.",
      "Fill in the recipient — the name is required — and the details: issue date, valid-until date, and optionally the project it relates to.",
      "Add the lines, check the totals, and create the quote.",
      "Move its status along from draft to sent to accepted, then use “Convert to Invoice”.",
    ],
    whoCanDoIt:
      "Company administrators only. Everyone else does not see the Billing group at all.",
  },
  {
    id: "billing-factures",
    title: "Customer invoices",
    purpose:
      "The invoices your company issues to its clients, tracked through to payment, with PDF and spreadsheet exports.",
    steps: [
      "Open Billing → Invoices and click “New invoice”.",
      "Start from blank, from an existing document or from a template, and pick the issuing company if you administer several.",
      "Fill in the recipient, then the issue date, the payment due date, the payment terms, and optionally a project.",
      "Add the lines, check the live totals, and create the invoice.",
      "Move the status along: draft, sent, then paid, overdue or cancelled. An overdue invoice can still be marked paid.",
      "Download the invoice as PDF or XLSX, or delete it — deletion asks first.",
    ],
    whoCanDoIt: "Company administrators only.",
    gotchas: [
      "Once an invoice is marked paid, the only status left is cancelling it as a refund.",
    ],
  },
  {
    id: "billing-templates",
    title: "Quote and invoice templates",
    purpose:
      "Reusable skeletons for the documents you issue often: the line items, the default VAT rate, the notes and your terms.",
    steps: [
      "Open Billing → Templates. If you administer several companies, pick whose templates to show — templates belong to one company.",
      "Click “New template” and choose its kind, quote or invoice. The kind cannot be changed afterwards.",
      "Name the template and set a default VAT rate, choosing one of the usual rates or a custom one.",
      "Add the line items, and optionally notes and your general terms, then save.",
      "From the list, “Use” a template to open a new document already filled in.",
    ],
    whoCanDoIt: "Company administrators only.",
    gotchas: ["Two templates of the same kind cannot share a name."],
  },
  {
    id: "billing-refundable",
    title: "Expenses awaiting reimbursement",
    purpose:
      "A company-wide view of the materials and services expenses flagged for reimbursement across every project, and how far each has been refunded.",
    steps: [
      "Open Billing → Refundable.",
      "Click “Add refundable expense” and search the not-yet-flagged expenses by project, number or recipient.",
      "Tick the ones to track and add them.",
      "Set each row's status: refundable, refund pending, refunded by the company, by the bank, or by both — or remove the flag entirely.",
      "Open an expense's attachments from the invoice column to check the paperwork.",
      "Read the totals: refunded overall, refunded by the company, refunded by the bank, and still refundable.",
    ],
    whoCanDoIt: "Company administrators only.",
    gotchas: [
      "The table shows at most 200 rows; beyond that it tells you how many it is showing.",
    ],
  },
  {
    id: "company",
    title: "Your company, its members and permissions",
    purpose:
      "The companies you belong to, and — for the ones you administer — the join code, the member roles, the permission grants and the people directory.",
    steps: [
      "Open Settings → Company.",
      "Click “Add company” and paste an invite token or a company code to attach yourself to another one.",
      "If you belong to several, switch between them with the company picker; a chip shows your role in each.",
      "Use “Set as primary” to choose your default company, or “Detach” to leave one.",
      "As an administrator, manage the company code: create it, issue a new one, revoke it, or copy it to share. People type that code in the mobile app to join as members.",
      "In the members table, change someone's role, or open “Custom permissions” to grant or deny one specific permission, company-wide or on a single project.",
      "Use “Add by phone” to add someone by number, or “Import from company” to bring people across from another company you administer.",
      "The directory lists everyone linked to the company with their phone, whether they have signed in yet, and the projects they are assigned to.",
      "Under “Payment methods”, add, rename or delete the ways that company's invoices get paid. Built-in methods can be renamed but not removed.",
    ],
    whoCanDoIt:
      "Anyone can see the companies they belong to and attach another. The join code, the members table, the directory and the payment methods are for administrators of the selected company.",
    gotchas: [
      "There are two different ways to add a person and they are not interchangeable: a single-use invite token valid seven days, and the reusable company code people type in the mobile app.",
    ],
  },
  {
    id: "settings",
    title: "Your profile and preferences",
    purpose:
      "Your own details, the current project's invoice numbering, and which notifications reach your phone.",
    steps: [
      "Open Settings; the list down the left selects the section.",
      "On “Profile”, edit your display name and phone and save. Your email is read-only — only an administrator can change it.",
      "On “Project”, set the invoice number prefix for the selected project, up to eight letters or digits, and watch the preview line before saving.",
      "On “Company”, manage the companies you belong to: the identity card of each, which one is primary, detaching, and attaching another with a code. Administering the selected one adds its join code, its members and its payment methods.",
      "On “Notifications”, use the master switch and the per-category switches: team chat, attendance, tasks, team and access, and money.",
      "On “Users & Roles”, platform operators attach an existing account to projects: find the person, tick the projects, and submit. No role is set here — those come from the company role and the per-project grants under “Company”.",
      "The Folio version you are running is printed at the foot of the page, under whichever section is open.",
    ],
    whoCanDoIt:
      "Everyone reaches their own profile, the project prefix and their notification choices. “Company” shows anyone their own attachments, and its admin tools — join code, members, payment methods — only to an administrator of the selected company. “Users & Roles” is offered to platform operators alone.",
    gotchas: [
      "Settings has no billing section of its own. Quotes, invoices and templates all live in the Billing group in the sidebar.",
      "The notification switches govern the pushes that reach the Folio mobile app, not the bell in this window.",
    ],
  },
  {
    id: "notifications",
    title: "The bell",
    purpose:
      "A short live feed of what needs your attention: note reminders that have come due, days a worker logged that are waiting for validation, and people who just joined your company.",
    steps: [
      "Click the bell in the top bar. Its badge counts reminders and attendance items, showing “9+” beyond nine.",
      "Under “Attendance to validate”, use “Validate” or “Reject” on each day a worker declared.",
      "Click a reminder to jump to that project's notes, or dismiss it with the ✕.",
      "“New members” lists people who just joined your company, linking to the settings page where you can place them.",
    ],
    whoCanDoIt:
      "Everyone sees the bell. What it contains is decided per person: attendance rows only reach the people who validate them.",
    gotchas: [
      "New-member events are left out of the badge count, so the popover can have content while the bell looks quiet.",
      "The feed refreshes about once a minute rather than instantly.",
    ],
  },
  {
    id: "chat",
    title: "Team chat",
    purpose:
      "A conversation with your company and your project teams, one channel per company and per project.",
    steps: [
      "Open the chat from its button in the corner of the window.",
      "Pick a channel from the list; unread ones are marked.",
      "Write your message and send it.",
      "Attach a photo to a message when a picture says it faster.",
      "Avatars under the latest message show who has read that far.",
    ],
    whoCanDoIt:
      "Everyone. The channels you see follow your company access and the projects you are on. Chat can be switched off for a server, in which case it says so.",
  },
];

/** The panel's own labels in this language. */
export const helpChromeEn: HelpChrome = {
  title: "How Folio works",
  subtitle: "Every workflow, step by step.",
  back: "All topics",
  steps: "Steps",
  whoCanDoIt: "Who can do this",
  gotchas: "Good to know",
  close: "Close the guide",
};
