-- Migration 008: Departments and Positions.
--
-- Adds a Client -> Department -> Position hierarchy for classifying
-- timecard work (replacing free-text "Department/Project" and "Job Code
-- & Position" with real, reusable records an admin manages), and a
-- per-Position "block pay" override: when set, an employee logging time
-- against that position is paid a flat amount for the day regardless of
-- actual hours clocked (their real hours still show on the timecard for
-- attendance) — for clients who schedule fixed-length blocks (e.g. an
-- 8-hour block) rather than paying strict hourly.
--
-- Additive only. Existing Projects/Clients and the free-text department/
-- jobCode/positionTitle fields on daily_entries are untouched — a
-- DailyEntry can optionally reference a position_id now, but doesn't have
-- to; imported data that doesn't match a real position just stays as
-- plain text, same as before this migration.

create table if not exists departments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists positions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  department_id uuid not null references departments(id) on delete cascade,
  title text not null,
  job_code text not null default '',
  block_pay_amount numeric, -- flat $ paid per block when set; null = normal hourly pay for this position
  block_pay_hours numeric,  -- the block's nominal length (e.g. 8) — shown on the timecard, not used in pay math
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table departments enable row level security;
alter table positions enable row level security;

drop policy if exists "admin manage departments" on departments;
create policy "admin manage departments" on departments for all
  using (company_id = auth_company_id() and auth_role() = 'admin')
  with check (company_id = auth_company_id() and auth_role() = 'admin');
drop policy if exists "read departments in company" on departments;
create policy "read departments in company" on departments for select
  using (company_id = auth_company_id());

drop policy if exists "admin manage positions" on positions;
create policy "admin manage positions" on positions for all
  using (company_id = auth_company_id() and auth_role() = 'admin')
  with check (company_id = auth_company_id() and auth_role() = 'admin');
drop policy if exists "read positions in company" on positions;
create policy "read positions in company" on positions for select
  using (company_id = auth_company_id());

-- Let a DailyEntry (inside timesheets.daily_entries jsonb) reference a
-- real position by id — purely additive metadata read by the frontend
-- and by payroll's block-pay lookup; the jsonb shape itself already
-- allows arbitrary extra keys, so no column change is needed on
-- timesheets, just documenting the convention here:
--   daily_entries[].positionId?: uuid  -- references positions(id)
