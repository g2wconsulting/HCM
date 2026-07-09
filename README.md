# Ledgerline — Timekeeping, Payroll & Client Portal

A staffing/PEO-style platform: your agency (the "master account") runs
payroll for your employees, places them with client companies at
client-specific rates, and gives each of three groups their own view:

- **Admins** (your staff) — full control: employees, clients, projects,
  timesheet approval, payroll runs.
- **Employees** — their own timesheets (fill in, sign, submit), their own
  onboarding documents and accommodation request, their own pay stubs.
- **Clients** (the sub-companies you place people with) — a portal showing
  only their own placed employees: profile info, shared notes, documents
  (read-only), and timesheet approval for hours logged against their
  projects.

## Setup

### 1. Create the Supabase project and run all schema files, in order

In the Supabase SQL editor, run each of these once, in order:
1. `supabase/schema.sql`
2. `supabase/migration_002_client_portal.sql`
3. `supabase/migration_003_forms_and_clock.sql`
4. `supabase/migration_004_signature_requests.sql`
5. `supabase/migration_005_project_budget.sql`
6. `supabase/migration_006_standard_forms.sql`
7. `supabase/migration_007_employer_liability_and_w2.sql`

(All files are safe to re-run if you're ever unsure whether one applied — every `create policy` and constraint is guarded so re-running won't error.)

### 2. Create a Storage bucket

Create a **private** bucket named `onboarding-docs` in Supabase Storage.

### 3. Configure and install the frontend

```bash
cp .env.example .env
# fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from
# Project Settings -> API in the Supabase dashboard
npm install
```

### 4. Create your admin login (one-time)

```bash
SUPABASE_URL=https://your-project.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=eyJ... \
node scripts/bootstrap-admin.mjs --company "Your Agency" --state OR --email you@youragency.com --password "ChooseAStrongPassword123!"
```

### 5. Add employees, clients, and their logins

As admin, in the app:
- **Employees** → add each person (pay type, rate, state, filing status)
- **Clients** → add each sub-company you place people with
- **Projects** → create a project under a client, and assign it a bill
  rate; this is where an employee's rate *for that client* lives — an
  employee can be assigned to multiple projects across multiple clients,
  each with its own rate

Then invite them (server-side, using the service role key). Set `SITE_URL`
to your real deployed URL — the invite email links there:

```bash
# employee login — sends a real invite email; they set their own password
SITE_URL=https://your-app.vercel.app \
node scripts/create-employee-login.mjs --employee-id <uuid> --email maya@youragency.com

# client portal login — same idea
SITE_URL=https://your-app.vercel.app \
node scripts/create-client-login.mjs --client-id <uuid> --email contact@theirclientco.com
```

(You still need `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set as
shown in step 4 — omitted above for brevity.)

Find the relevant `id` in Supabase's Table Editor (`employees` or
`clients` table) until a copy-id button is added to the UI.

## Running locally

```bash
npm run dev       # http://localhost:5180 (fixed port, see vite.config.ts)
```

## Deploying

### Option A — Vercel (fastest way to let a colleague try it)

1. Push this project to a GitHub repo (or use Vercel's CLI to deploy
   directly from your machine without GitHub — `npx vercel` from the
   project folder).
2. In Vercel, import the repo as a new project. It auto-detects Vite;
   defaults (`npm run build`, output directory `dist`) are correct.
3. Before deploying, add your environment variables in Vercel's project
   settings → Environment Variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   (same values as your local `.env`)
4. Deploy. Vercel gives you a URL like `your-project.vercel.app` —
   send that to your colleague along with their login (create it first
   with `create-employee-login.mjs` or `create-client-login.mjs`).
5. Because this is a single-page app with client-side routing, Vercel
   needs to know to serve `index.html` for all paths. Add a
   `vercel.json` file at the project root:
   ```json
   {
     "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
   }
   ```
   Without this, refreshing the page on something like
   `/employees/abc123` will 404.

Nothing else changes — Supabase is already a hosted cloud service, so
Vercel just needs to serve the built frontend and point at the same
Supabase project you've been using locally.

### Option B — your own server

```bash
npm run build     # outputs static files to dist/
```

Serve `dist/` with any static file server (nginx, Caddy, etc.) behind
HTTPS, with `try_files $uri /index.html;` for client-side routing.

## How the pieces fit together

- **Employees belong to the master account** for payroll/tax purposes —
  that's who withholds and pays them, regardless of which client they're
  placed with.
- **Clients are an organizing layer above projects.** A "client" is the
  sub-company; a "project" under that client is effectively "the
  job/placement and its rate." Assigning an employee to a project (with a
  rate override) is how you assign them to a client and a rate — an
  employee can have several, one per client.
- **Notes** on an employee can be marked internal-only or shared with the
  client. Clients can only ever see/add notes marked shared.
- **Accommodation requests** are a structured form (not just a file
  upload) that employees fill out during onboarding under "My onboarding."
  Admins can see and manage the status; clients see it only if the admin
  leaves "visible to client" checked (on by default).

## Inviting employees and clients from the app (no scripts)

Adding an employee now has a checkbox: **"Email them a login invite now"**
— check it, and they get a real invite email immediately, no CLI script
needed. For employees added before this existed, or if you skipped the
checkbox, there's an **"Invite to portal"** button on their profile page.
This uses the same `invite-user` Edge Function pattern as the
e-signature emails — deploy it once:

```bash
supabase functions deploy invite-user
```

It reuses your existing `RESEND_API_KEY` / `RESEND_FROM` secrets — nothing
new to configure if e-signature emails are already working.

The CLI scripts (`create-employee-login.mjs`, `create-client-login.mjs`,
`create-admin-login.mjs`) still work and are handy for bulk setup — the
in-app button is just faster for one person at a time.

## Standard onboarding forms (W-4, I-9, W-9)

Every company automatically has these three forms, always available,
built to mirror the real government forms' actual sections (not just a
generic field list): Form W-4 (steps 1–5, with the dependents credit
computed live from qualifying children/other dependents, matching the
real form's math), Form I-9 Section 1, and Form W-9. W-4 and I-9 are set
to auto-assign to every new employee automatically; W-9 is available but
not auto-assigned (it's for contractors, not most employees) — toggle
auto-assign for any form, standard or custom, from the Forms page.

**The W-4 is special-cased**: when an employee submits it, their answers
write directly onto their own employee record — filing status, dependents
credit, and extra withholding — the same fields payroll's tax
calculations already use. No separate step to copy the numbers over.

Custom forms you build yourself keep using the drag-free field builder
as before; standard forms' fields are fixed (since their layout is
purpose-built to match the real form), but you can still toggle them
active/inactive and auto-assign.

## Real signatures only for external e-signature

The public signing page (what an external recipient sees) only offers
**draw a signature** or **upload an image of your signature** — never a
typed-name stand-in. That distinction matters for e-signature to mean
something. (Internal quick sign-off — an employee submitting their own
timesheet, an admin approving one — still allows typed signatures, since
that's a different, lower-stakes use case than sending something out for
someone else's binding signature.)

When sending a timesheet for external approval, you can now choose the
period covered — this week only (the default, since weekly is typical),
this + last week, this + last 2 weeks, or the last 4 weeks — right from
the timesheet page itself, no need to use the separate export flow
unless you want a custom date range.

## Grouping timesheets

The Timesheets list has a **Group by** control — None, Employee, Client,
or Project — so a growing timesheet history doesn't turn into one long
undifferentiated table. Each group is collapsible and shows a running
hours total.

## Sending timesheets out for external e-signature

This is the real approval mechanism for teams where staff manage time but
an outside party (like a client's hiring manager) approves it — no login
required on their end, and signing automatically marks the underlying
timesheets "approved" so they're ready for payroll.

Flow: **Timesheets → Export range to PDF** (pick employee + date range)
**→ Send for e-signature** (enter the recipient's name and email). They
get an email with a link, review the hours on a clean page, sign, done.
You can track status (sent / viewed / signed) back on that export page.

### One-time setup (this feature needs real email sending)

1. **Run the migration**: `supabase/migration_004_signature_requests.sql`
   in the Supabase SQL editor.

2. **Create a free Resend account** at resend.com — this is what actually
   sends the email. Grab an API key from their dashboard.
   - For quick testing, Resend lets you send from `onboarding@resend.dev`
     with no setup. For real use, verify your own domain in Resend
     (resend.com/domains) so emails come from your address and land in
     inboxes reliably.

3. **Install the Supabase CLI** (a separate tool from the Supabase
   dashboard — this lets you deploy the small server-side function that
   actually sends the email):
   ```bash
   npm install -g supabase
   supabase login
   ```
   Then link it to your project (find your project ref in the Supabase
   dashboard URL, or under Project Settings → General):
   ```bash
   supabase link --project-ref your-project-ref
   ```

4. **Set the email secrets** (these stay server-side, never touch the
   browser):
   ```bash
   supabase secrets set RESEND_API_KEY=re_your_key_here
   supabase secrets set RESEND_FROM="Your Company <timesheets@yourdomain.com>"
   ```
   (Skip `RESEND_FROM` while testing to fall back to `onboarding@resend.dev`.)

5. **Deploy the function**:
   ```bash
   supabase functions deploy send-signature-request
   ```

That's it — no changes needed to your `.env` or Vercel settings, since
this function runs on Supabase's servers, not yours.

### If you don't want to set this up right now

The **Download PDF** and **Share / Email PDF** buttons next to "Send for
e-signature" still work with zero setup — they just require you to send
the email yourself rather than the system doing it, and won't
automatically update anything when someone signs.

## Timesheets — admin control and PDF export

Admins can now create a timesheet for **any employee, any week** (not
just "start this week" for whichever employee happened to be first in
the list) via **Timesheets → + New timesheet**. Admins can also edit
hours on a timesheet in any status except "paid" — so a mistake found
after approval can still be fixed before payroll runs, without needing
to reject and restart the whole sign-off flow. A status dropdown next to
the badge on a timesheet's detail page lets an admin set status directly
if needed, bypassing the normal sign/approve flow entirely.

**Exporting to PDF**: from the Timesheets list, **Export range to PDF**
lets you pick an employee and a date range (a single week or several —
it grabs every week that overlaps the range) and generates a combined
PDF: each week's hours by project, any signatures already captured
in-app, a running total, and a blank signature block at the end for
sending out for a fresh e-signature. From there:
- **Download PDF** — saves the file locally.
- **Share / Email PDF** — on browsers/devices that support the Web
  Share API with file attachments (most mobile browsers, some desktop
  ones), this opens your device's normal share sheet with the PDF
  attached — pick Mail, Gmail, Slack, whatever you want. On browsers
  that don't support this (some desktop browsers), it downloads the PDF
  and opens a blank email with instructions to attach it manually — true
  automatic "download happens, email sends with attachment already on
  it" behavior would require a backend email service (see below), which
  isn't wired up yet.

## Clock in/out

Employees can either type hours into the weekly grid (as before) or use
the **Clock** widget — pick a project, hit **Clock in**, and **Clock out**
later. The elapsed time gets added to that day's entry for that project
automatically, and a session log (start/end/hours) is kept alongside for
an audit trail. Both approaches write to the same underlying hours, so
payroll calculations don't need to know which method was used. The clock
widget appears on the employee dashboard and on the current week's
timesheet (only while it's still editable — draft or sent-back).

## Custom forms

Admins can build arbitrary forms under **Forms** — short text, long text,
number, date, checkbox, or dropdown fields, each marked required or not.
Assign a form to an employee from their profile page; it shows up under
that employee's **My onboarding** page to fill out and sign, the same way
onboarding documents work. Admins can review submitted responses on the
employee's profile, and optionally mark a submission "visible to client"
so it also shows up in the client portal (read-only).

## Password reset & self-serve login management

Anyone can now reset a forgotten password from the login screen ("Forgot
password?"), and anyone already logged in can change their password from
the "Change password" link in the sidebar — no admin involvement needed
for either.

**One-time setup required** for the reset email link to work: in your
Supabase dashboard, go to **Authentication → URL Configuration** and add
your app's URL(s) to the redirect allowlist:
- `http://localhost:5180/reset-password` (for local dev)
- `https://your-vercel-url.vercel.app/reset-password` (for production —
  update this if your Vercel URL changes)

Without this, Supabase will reject the redirect and the reset link will
fail. If you add a custom domain later, add that too.

Supabase's default email sending works out of the box for testing, but
has rate limits and sends from a generic address — for production use
serving real employees, consider configuring a custom SMTP provider
under **Authentication → Emails** in Supabase so reset emails reliably
land in inboxes (not spam) and come from your own domain.

## Known simplifications, worth knowing about

- **Timesheet approval by clients assumes one client per week.** A
  client's "Approve & sign" action approves the whole timesheet, not just
  the line items tied to their projects. If someone regularly splits a
  single week across two different clients, both clients will see the
  same timesheet and either can approve it — there's no per-line-item
  split approval yet. Worth building if that scenario comes up often.
- **No candidate/ATS pipeline.** "Candidates" are just employees with
  status `onboarding` — there's no separate pre-hire tracking stage.
- **Local/city taxes and benefit deductions** are still not modeled.
  Employer-side liability (FICA match, FUTA, SUTA, workers' comp) is now
  computed per payroll run (see the tax section below) but SUTA rate/wage
  base and workers' comp rate default to 0 until an admin configures them
  in Settings — every state sets its own SUTA rate and wage base, and
  workers' comp rates depend on job classification, so there's no safe
  universal default the way there is for federal FUTA.
- **No self-serve signup or password reset UI yet** — Supabase Auth
  supports both; only the screens haven't been built.

## Tax withholding — please read

`src/lib/taxEngine.ts` implements the IRS Publication 15-T "annualized
wages" percentage method: federal brackets, standard deductions, and FICA
reflect **2024** figures, with all 50 states + DC covered. Tax numbers
change most years — review and update that one file each January against
current IRS Publication 15-T and your state's Department of Revenue
tables before running real payroll. This is a simplified model, not a
substitute for a CPA or payroll compliance service.

**Employer liability** (employer FICA match, FUTA, SUTA, workers' comp) is
computed alongside employee withholding on every payroll run — see
`computeEmployerFica`/`computeFutaSuta`/`computeWorkersComp` in
`taxEngine.ts`. Rates, wage bases, and the account/policy numbers they're
filed under are configured per-company in Settings.

**W-2s** (downloadable from an employee's "My pay" page, or by an admin
from an employee's profile) are a wage-and-tax summary generated with
jsPDF — they are **not** a laser-printed, SSA-approved substitute Form
W-2 (IRS Publication 1141 governs the exact box layout/paper stock
required for that). Treat generated W-2 PDFs as an internal reference for
employees, not as the document you file with the SSA — for actual filing,
run these totals through a certified W-2 vendor or payroll tax service.

## Project structure

```
supabase/
  schema.sql                     — companies, employees, timesheets, payroll, RLS
  migration_002_client_portal.sql — clients, client role, notes, accommodation requests
scripts/
  bootstrap-admin.mjs         — one-time: create company + first admin login
  create-employee-login.mjs   — create a login for an existing employee
  create-client-login.mjs     — create a login for an existing client
src/
  lib/
    types.ts, taxEngine.ts, payroll.ts, mappers.ts
    supabaseClient.ts, AuthContext.tsx, AppContext.tsx
    format.ts
  components/
    Layout.tsx (role-aware nav), SignaturePad.tsx, ui.tsx
  pages/
    Login.tsx, Dashboard.tsx
    Timesheets.tsx / TimesheetDetail.tsx        (admin + employee)
    Employees.tsx / EmployeeDetail.tsx          (admin)
    Clients.tsx / Projects.tsx                  (admin)
    Payroll.tsx / PayrollRunDetail.tsx           (admin)
    Settings.tsx                                 (admin)
    MyPay.tsx / MyOnboarding.tsx                (employee)
    PortalDashboard.tsx / PortalEmployees.tsx
    PortalEmployeeDetail.tsx / PortalTimesheets.tsx
    PortalTimesheetDetail.tsx                    (client)
```
