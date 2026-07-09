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

(All three files are safe to re-run if you're ever unsure whether one applied — every `create policy` and constraint is guarded so re-running won't error.)

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
- **Employer-side taxes, local/city taxes, and benefit deductions** are
  still not modeled (see the tax section below).
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
