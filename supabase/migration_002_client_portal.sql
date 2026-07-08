-- Migration 002: Client portal, notes, and accommodation requests.
-- Run this in the Supabase SQL editor AFTER schema.sql.

-- ---------------------------------------------------------------------------
-- Clients (the "sub companies" your agency places employees with)
-- ---------------------------------------------------------------------------
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade, -- the master account
  name text not null,
  contact_name text,
  contact_email text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Projects now belong to a client. Existing projects get client_id = null
-- until you assign one — the app treats "no client" as an internal project.
alter table projects add column if not exists client_id uuid references clients(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Profiles: extend role to include 'client', add client_id
-- ---------------------------------------------------------------------------
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check check (role in ('admin', 'employee', 'client'));
alter table profiles add column if not exists client_id uuid references clients(id) on delete set null;

create or replace function auth_client_id() returns uuid
language sql stable security definer as $$
  select client_id from profiles where id = auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- Timesheets: add a separate client-approval trail alongside the internal
-- manager approval. Simplification: this approves the whole timesheet, not
-- individual line items — fine for the common case of one client per week,
-- worth revisiting if employees regularly split a week across clients.
-- ---------------------------------------------------------------------------
alter table timesheets add column if not exists client_approval jsonb;
alter table timesheets add column if not exists client_approved_at timestamptz;

-- ---------------------------------------------------------------------------
-- Notes on employees (candidates are just employees with status='onboarding')
-- ---------------------------------------------------------------------------
create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  author_id uuid references profiles(id) on delete set null,
  author_label text not null, -- denormalized display name, survives author deletion
  body text not null,
  visibility text not null default 'internal' check (visibility in ('internal', 'shared_with_client')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Accommodation requests — one row per employee, filled during onboarding.
-- ---------------------------------------------------------------------------
create table if not exists accommodation_requests (
  employee_id uuid primary key references employees(id) on delete cascade,
  needs_accommodation boolean not null default false,
  description text,
  status text not null default 'none' check (status in ('none', 'requested', 'in_review', 'resolved')),
  admin_notes text,
  visible_to_client boolean not null default true,
  submitted_at timestamptz,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table clients enable row level security;
alter table notes enable row level security;
alter table accommodation_requests enable row level security;

-- clients: admins manage their own company's clients; client users can read
-- their own client row (so the portal can show the company name etc.)
drop policy if exists "admin manage clients" on clients;
create policy "admin manage clients" on clients for all
  using (company_id = auth_company_id() and auth_role() = 'admin')
  with check (company_id = auth_company_id() and auth_role() = 'admin');
drop policy if exists "client reads own client row" on clients;
create policy "client reads own client row" on clients for select
  using (id = auth_client_id());

-- projects: allow client users to read projects belonging to their client
-- (they need this to see which of their placements a timesheet covers)
drop policy if exists "client reads own projects" on projects;
create policy "client reads own projects" on projects for select
  using (client_id = auth_client_id());

-- employees: client users can read employees who have at least one project
-- assignment under their client. Note this depends on project_ids (jsonb)
-- containing a project owned by the client.
drop policy if exists "client reads assigned employees" on employees;
create policy "client reads assigned employees" on employees for select
  using (
    auth_role() = 'client' and exists (
      select 1 from projects p
      where p.client_id = auth_client_id()
        and p.id::text in (select jsonb_array_elements_text(employees.project_ids))
    )
  );

-- timesheets: client users can read/update (approve) timesheets that
-- include at least one entry against one of their client's projects.
drop policy if exists "client reads relevant timesheets" on timesheets;
create policy "client reads relevant timesheets" on timesheets for select
  using (
    auth_role() = 'client' and exists (
      select 1 from jsonb_array_elements(timesheets.entries) as e
      join projects p on p.id = (e->>'projectId')::uuid
      where p.client_id = auth_client_id()
    )
  );
drop policy if exists "client approves relevant timesheets" on timesheets;
create policy "client approves relevant timesheets" on timesheets for update
  using (
    auth_role() = 'client' and exists (
      select 1 from jsonb_array_elements(timesheets.entries) as e
      join projects p on p.id = (e->>'projectId')::uuid
      where p.client_id = auth_client_id()
    )
  )
  with check (
    auth_role() = 'client' and exists (
      select 1 from jsonb_array_elements(timesheets.entries) as e
      join projects p on p.id = (e->>'projectId')::uuid
      where p.client_id = auth_client_id()
    )
  );

-- onboarding_documents: client users get read-only access to documents of
-- their assigned employees (visibility, not editing).
drop policy if exists "client reads assigned employee docs" on onboarding_documents;
create policy "client reads assigned employee docs" on onboarding_documents for select
  using (
    auth_role() = 'client' and exists (
      select 1 from employees emp, projects p
      where emp.id = onboarding_documents.employee_id
        and p.client_id = auth_client_id()
        and p.id::text in (select jsonb_array_elements_text(emp.project_ids))
    )
  );

-- notes: admins full access within company. Client users can read notes
-- marked shared_with_client for their assigned employees, and can create
-- new notes (always created as shared_with_client — clients can't write
-- internal-only notes).
drop policy if exists "admin manage notes" on notes;
create policy "admin manage notes" on notes for all
  using (company_id = auth_company_id() and auth_role() = 'admin')
  with check (company_id = auth_company_id() and auth_role() = 'admin');
drop policy if exists "client reads shared notes for assigned employees" on notes;
create policy "client reads shared notes for assigned employees" on notes for select
  using (
    auth_role() = 'client' and visibility = 'shared_with_client' and exists (
      select 1 from employees emp, projects p
      where emp.id = notes.employee_id
        and p.client_id = auth_client_id()
        and p.id::text in (select jsonb_array_elements_text(emp.project_ids))
    )
  );
drop policy if exists "client creates shared notes for assigned employees" on notes;
create policy "client creates shared notes for assigned employees" on notes for insert
  with check (
    auth_role() = 'client' and visibility = 'shared_with_client' and exists (
      select 1 from employees emp, projects p
      where emp.id = notes.employee_id
        and p.client_id = auth_client_id()
        and p.id::text in (select jsonb_array_elements_text(emp.project_ids))
    )
  );

-- accommodation_requests: admins full access; employees manage their own;
-- client users get read-only access when visible_to_client and the
-- employee is assigned to them.
drop policy if exists "admin manage accommodation requests" on accommodation_requests;
create policy "admin manage accommodation requests" on accommodation_requests for all
  using (exists (
    select 1 from employees e where e.id = accommodation_requests.employee_id
    and e.company_id = auth_company_id() and auth_role() = 'admin'
  ))
  with check (exists (
    select 1 from employees e where e.id = accommodation_requests.employee_id
    and e.company_id = auth_company_id() and auth_role() = 'admin'
  ));
drop policy if exists "employee manages own accommodation request" on accommodation_requests;
create policy "employee manages own accommodation request" on accommodation_requests for all
  using (employee_id = auth_employee_id())
  with check (employee_id = auth_employee_id());
drop policy if exists "client reads visible accommodation requests" on accommodation_requests;
create policy "client reads visible accommodation requests" on accommodation_requests for select
  using (
    auth_role() = 'client' and visible_to_client = true and exists (
      select 1 from employees emp, projects p
      where emp.id = accommodation_requests.employee_id
        and p.client_id = auth_client_id()
        and p.id::text in (select jsonb_array_elements_text(emp.project_ids))
    )
  );

grant execute on function auth_client_id() to authenticated;
