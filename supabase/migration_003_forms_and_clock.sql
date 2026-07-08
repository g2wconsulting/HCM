-- Migration 003: Clock in/out and custom form builder.
-- Run this in the Supabase SQL editor AFTER migration_002_client_portal.sql.

-- ---------------------------------------------------------------------------
-- Timesheets: clock in/out support alongside manual hour entry.
-- activeSession holds the currently-running punch (if any); clockSessions
-- is an audit trail of completed punches. Hours from a completed punch get
-- folded into the normal `entries` column (the source of truth payroll
-- reads from) — clock_sessions is supplementary, for transparency.
-- ---------------------------------------------------------------------------
alter table timesheets add column if not exists active_session jsonb;
alter table timesheets add column if not exists clock_sessions jsonb not null default '[]'::jsonb;

-- ---------------------------------------------------------------------------
-- Custom form templates (admin-designed) and submissions (filled by employees)
-- ---------------------------------------------------------------------------
create table if not exists form_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  description text,
  fields jsonb not null default '[]'::jsonb, -- [{id,label,type,required,options?}]
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists form_submissions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  template_id uuid not null references form_templates(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  responses jsonb not null default '{}'::jsonb, -- {fieldId: value}
  status text not null default 'pending' check (status in ('pending', 'submitted')),
  signature jsonb,
  visible_to_client boolean not null default false,
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);

alter table form_templates enable row level security;
alter table form_submissions enable row level security;

-- form_templates: admins manage; anyone in the company (employee/client) can
-- read templates — field definitions aren't sensitive, and employees need
-- to read them to render a form they've been assigned.
drop policy if exists "admin manage form templates" on form_templates;
create policy "admin manage form templates" on form_templates for all
  using (company_id = auth_company_id() and auth_role() = 'admin')
  with check (company_id = auth_company_id() and auth_role() = 'admin');
drop policy if exists "read form templates in company" on form_templates;
create policy "read form templates in company" on form_templates for select
  using (company_id = auth_company_id());

-- form_submissions: admins manage all within company; employees manage
-- (read + fill in + submit) only their own; clients get read-only access
-- when visible_to_client and the employee is assigned to them.
drop policy if exists "admin manage form submissions" on form_submissions;
create policy "admin manage form submissions" on form_submissions for all
  using (company_id = auth_company_id() and auth_role() = 'admin')
  with check (company_id = auth_company_id() and auth_role() = 'admin');
drop policy if exists "employee manages own form submissions" on form_submissions;
create policy "employee manages own form submissions" on form_submissions for all
  using (employee_id = auth_employee_id())
  with check (employee_id = auth_employee_id());
drop policy if exists "client reads visible form submissions" on form_submissions;
create policy "client reads visible form submissions" on form_submissions for select
  using (
    auth_role() = 'client' and visible_to_client = true and exists (
      select 1 from employees emp, projects p
      where emp.id = form_submissions.employee_id
        and p.client_id = auth_client_id()
        and p.id::text in (select jsonb_array_elements_text(emp.project_ids))
    )
  );
