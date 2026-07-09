-- Migration 007: Employer-side payroll tax liability (FICA match, FUTA,
-- SUTA, workers' comp) rate/account configuration on companies, plus a
-- restricted employee_tax_info table (SSN + home address) and a
-- security-definer RPC for employee self-service W-2 downloads. Safe to
-- re-run.

alter table companies add column if not exists futa_rate numeric not null default 0.006;
alter table companies add column if not exists futa_wage_base numeric not null default 7000;
alter table companies add column if not exists suta_rate numeric not null default 0;
alter table companies add column if not exists suta_wage_base numeric not null default 7000;
alter table companies add column if not exists workers_comp_rate numeric not null default 0; -- per $100 of gross pay
alter table companies add column if not exists state_withholding_account_number text;
alter table companies add column if not exists state_unemployment_account_number text;
alter table companies add column if not exists workers_comp_policy_number text;

-- ---------------------------------------------------------------------------
-- employee_tax_info — SSN + home address for W-2 generation. Kept in its own
-- table (rather than on `employees`, which is bulk-fetched into every admin
-- and client-portal session today) so this sensitive data is only ever
-- queried one employee at a time, scoped by RLS to an admin or the employee
-- themselves — never to the client-portal role.
-- ---------------------------------------------------------------------------
create table if not exists employee_tax_info (
  employee_id uuid primary key references employees(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  ssn text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  zip text,
  updated_at timestamptz not null default now()
);

alter table employee_tax_info enable row level security;

drop policy if exists "admin manage employee tax info" on employee_tax_info;
create policy "admin manage employee tax info" on employee_tax_info for all
  using (company_id = auth_company_id() and auth_role() = 'admin')
  with check (company_id = auth_company_id() and auth_role() = 'admin');

drop policy if exists "employee reads own tax info" on employee_tax_info;
create policy "employee reads own tax info" on employee_tax_info for select
  using (company_id = auth_company_id() and employee_id = auth_employee_id());

-- ---------------------------------------------------------------------------
-- my_w2(year) — mirrors the my_pay_stubs() pattern: aggregates the calling
-- employee's own finalized payroll runs for the given year, joined with
-- their tax info and their company's identifiers, entirely server-side so
-- no bulk employee_tax_info or payroll_runs data ever needs to reach the
-- client for this to work.
-- ---------------------------------------------------------------------------
create or replace function my_w2(p_year int)
returns table (
  employee_name text,
  ssn text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  zip text,
  company_name text,
  ein text,
  company_address text,
  state_withholding_account_number text,
  state_unemployment_account_number text,
  wages numeric,
  federal_withholding numeric,
  state_withholding numeric,
  social_security_wages numeric,
  social_security_tax numeric,
  medicare_wages numeric,
  medicare_tax numeric
)
language sql stable security definer as $$
  with my_lines as (
    select li
    from payroll_runs pr, jsonb_array_elements(pr.line_items) as li
    where pr.company_id = auth_company_id()
      and pr.status = 'finalized'
      and extract(year from pr.pay_date) = p_year
      and auth_employee_id() is not null
      and (li->>'employeeId')::uuid = auth_employee_id()
  ),
  totals as (
    select
      coalesce(sum((li->>'grossPay')::numeric), 0) as wages,
      coalesce(sum((li->>'federalWithholding')::numeric), 0) as federal_withholding,
      coalesce(sum((li->>'stateWithholding')::numeric), 0) as state_withholding,
      coalesce(sum((li->>'socialSecurity')::numeric), 0) as social_security_tax,
      coalesce(sum((li->>'medicare')::numeric + coalesce((li->>'additionalMedicare')::numeric, 0)), 0) as medicare_tax
    from my_lines
  )
  select
    e.first_name || ' ' || e.last_name,
    ti.ssn, ti.address_line1, ti.address_line2, ti.city, ti.state, ti.zip,
    c.name, c.ein, c.address,
    c.state_withholding_account_number, c.state_unemployment_account_number,
    t.wages, t.federal_withholding, t.state_withholding,
    t.wages, t.social_security_tax,
    t.wages, t.medicare_tax
  from employees e
  join companies c on c.id = e.company_id
  left join employee_tax_info ti on ti.employee_id = e.id
  cross join totals t
  where e.id = auth_employee_id()
$$;

grant execute on function my_w2(int) to authenticated;
