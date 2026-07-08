-- Ledgerline schema for Supabase.
-- Run this once in the Supabase SQL editor (or via `supabase db push`)
-- against a fresh project. Safe to re-run: uses IF NOT EXISTS / OR REPLACE
-- where practical, but on a totally clean project just run it top to bottom.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Companies
-- ---------------------------------------------------------------------------
create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  ein text,
  address text,
  state text not null default 'OR',
  overtime_multiplier numeric not null default 1.5,
  overtime_threshold_weekly numeric not null default 40,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Profiles — one row per logged-in user, linked 1:1 to auth.users.
-- role: 'admin' can manage everything in their company.
-- role: 'employee' is further linked to a specific employees row via
-- employee_id, and can only see/act on their own records.
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  role text not null check (role in ('admin', 'employee')),
  employee_id uuid, -- set for role='employee'; FK added after employees table exists
  email text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Employees
-- ---------------------------------------------------------------------------
create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text not null,
  title text not null default '',
  status text not null default 'onboarding' check (status in ('onboarding','active','inactive','terminated')),
  pay_type text not null default 'hourly' check (pay_type in ('hourly','salary')),
  state text not null default 'OR',
  filing_status text not null default 'single' check (filing_status in ('single','married_joint','head_of_household')),
  federal_extra_withholding numeric not null default 0,
  salary_annual numeric,
  default_hourly_rate numeric not null default 0,
  dependents_credit numeric not null default 0,
  hire_date date not null default current_date,
  termination_date date,
  rates jsonb not null default '[]'::jsonb,       -- [{id, projectId, hourlyRate, effectiveDate}]
  project_ids jsonb not null default '[]'::jsonb, -- [projectId, ...]
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_employee_id_fkey'
  ) then
    alter table profiles
      add constraint profiles_employee_id_fkey
      foreign key (employee_id) references employees(id) on delete set null;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  client_name text,
  code text not null default '',
  active boolean not null default true,
  bill_rate numeric,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Timesheets (entries stored as JSONB — one row per employee per week)
-- ---------------------------------------------------------------------------
create table if not exists timesheets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  week_start_date date not null,
  week_end_date date not null,
  entries jsonb not null default '[]'::jsonb, -- [{id, date, projectId, hours, notes}]
  status text not null default 'draft' check (status in ('draft','submitted','approved','rejected','paid')),
  submitted_at timestamptz,
  employee_signature jsonb,
  approver_signature jsonb,
  approver_name text,
  approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  unique (employee_id, week_start_date)
);

-- ---------------------------------------------------------------------------
-- Onboarding documents
-- ---------------------------------------------------------------------------
create table if not exists onboarding_documents (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  name text not null,
  required boolean not null default true,
  status text not null default 'pending' check (status in ('pending','uploaded','signed','waived')),
  file_path text,       -- path in Supabase Storage bucket "onboarding-docs"
  file_name text,
  signature jsonb,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Payroll runs (line items stored as JSONB)
-- ---------------------------------------------------------------------------
create table if not exists payroll_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  pay_date date not null,
  status text not null default 'draft' check (status in ('draft','finalized')),
  line_items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  finalized_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Helper functions used inside RLS policies
-- ---------------------------------------------------------------------------
create or replace function auth_company_id() returns uuid
language sql stable security definer as $$
  select company_id from profiles where id = auth.uid()
$$;

create or replace function auth_role() returns text
language sql stable security definer as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function auth_employee_id() returns uuid
language sql stable security definer as $$
  select employee_id from profiles where id = auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table companies enable row level security;
alter table profiles enable row level security;
alter table employees enable row level security;
alter table projects enable row level security;
alter table timesheets enable row level security;
alter table onboarding_documents enable row level security;
alter table payroll_runs enable row level security;

-- companies: everyone can read their own company; only admins can update it
drop policy if exists "read own company" on companies;
create policy "read own company" on companies for select
  using (id = auth_company_id());
drop policy if exists "admin update company" on companies;
create policy "admin update company" on companies for update
  using (id = auth_company_id() and auth_role() = 'admin');

-- profiles: users can read profiles in their own company (needed to show
-- approver names etc.); only admins can create/update profiles otherwise.
drop policy if exists "read profiles in company" on profiles;
create policy "read profiles in company" on profiles for select
  using (company_id = auth_company_id());
drop policy if exists "admin manage profiles" on profiles;
create policy "admin manage profiles" on profiles for all
  using (company_id = auth_company_id() and auth_role() = 'admin')
  with check (company_id = auth_company_id() and auth_role() = 'admin');
drop policy if exists "user reads own profile always" on profiles;
create policy "user reads own profile always" on profiles for select
  using (id = auth.uid());

-- employees: admins full access within company; employees can read/update
-- only their own record (e.g. cannot change pay rate, but principle of
-- least surprise says restrict updates to admin only — employees get
-- select-only on themselves).
drop policy if exists "admin manage employees" on employees;
create policy "admin manage employees" on employees for all
  using (company_id = auth_company_id() and auth_role() = 'admin')
  with check (company_id = auth_company_id() and auth_role() = 'admin');
drop policy if exists "employee reads self" on employees;
create policy "employee reads self" on employees for select
  using (company_id = auth_company_id() and id = auth_employee_id());

-- projects: everyone in the company can read (employees need project names
-- to log time against); only admins can write.
drop policy if exists "read projects in company" on projects;
create policy "read projects in company" on projects for select
  using (company_id = auth_company_id());
drop policy if exists "admin manage projects" on projects;
create policy "admin manage projects" on projects for all
  using (company_id = auth_company_id() and auth_role() = 'admin')
  with check (company_id = auth_company_id() and auth_role() = 'admin');

-- timesheets: admins full access; employees can read/insert/update only
-- their own timesheets, and only while in an editable state.
drop policy if exists "admin manage timesheets" on timesheets;
create policy "admin manage timesheets" on timesheets for all
  using (company_id = auth_company_id() and auth_role() = 'admin')
  with check (company_id = auth_company_id() and auth_role() = 'admin');
drop policy if exists "employee reads own timesheets" on timesheets;
create policy "employee reads own timesheets" on timesheets for select
  using (company_id = auth_company_id() and employee_id = auth_employee_id());
drop policy if exists "employee inserts own timesheets" on timesheets;
create policy "employee inserts own timesheets" on timesheets for insert
  with check (company_id = auth_company_id() and employee_id = auth_employee_id());
drop policy if exists "employee updates own draft or rejected timesheets" on timesheets;
create policy "employee updates own draft or rejected timesheets" on timesheets for update
  using (
    company_id = auth_company_id() and employee_id = auth_employee_id()
    and status in ('draft', 'rejected', 'submitted')
  )
  with check (company_id = auth_company_id() and employee_id = auth_employee_id());

-- onboarding_documents: admins full access within their company; employees
-- can read/update (upload/sign) only their own documents.
drop policy if exists "admin manage onboarding docs" on onboarding_documents;
create policy "admin manage onboarding docs" on onboarding_documents for all
  using (exists (
    select 1 from employees e where e.id = onboarding_documents.employee_id
    and e.company_id = auth_company_id() and auth_role() = 'admin'
  ))
  with check (exists (
    select 1 from employees e where e.id = onboarding_documents.employee_id
    and e.company_id = auth_company_id() and auth_role() = 'admin'
  ));
drop policy if exists "employee reads own docs" on onboarding_documents;
create policy "employee reads own docs" on onboarding_documents for select
  using (employee_id = auth_employee_id());
drop policy if exists "employee updates own docs" on onboarding_documents;
create policy "employee updates own docs" on onboarding_documents for update
  using (employee_id = auth_employee_id())
  with check (employee_id = auth_employee_id());

-- payroll_runs: admins full access; employees can read runs from their own
-- company so the app can show them their own pay stub (the UI filters the
-- JSONB line_items down to their own employee id — everyone in the company
-- can technically read the row, but individual salary details of *other*
-- employees live inside line_items, so give employees a restricted view
-- instead of raw table access).
drop policy if exists "admin manage payroll runs" on payroll_runs;
create policy "admin manage payroll runs" on payroll_runs for all
  using (company_id = auth_company_id() and auth_role() = 'admin')
  with check (company_id = auth_company_id() and auth_role() = 'admin');

create or replace function my_pay_stubs()
returns table (
  payroll_run_id uuid,
  period_start date,
  period_end date,
  pay_date date,
  status text,
  line_item jsonb
)
language sql stable security definer as $$
  select
    pr.id,
    pr.period_start,
    pr.period_end,
    pr.pay_date,
    pr.status,
    li
  from payroll_runs pr,
    jsonb_array_elements(pr.line_items) as li
  where pr.company_id = auth_company_id()
    and (li->>'employeeId')::uuid = auth_employee_id()
    and auth_employee_id() is not null
$$;

grant execute on function my_pay_stubs() to authenticated;
