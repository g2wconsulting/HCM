-- Migration 007: Uploaded timecards — richer per-day entries (multiple
-- clock in/out punches, job code, position, department), a two-stage
-- employee-then-supervisor approval pipeline with individual secure
-- links, and an audit trail of sends/approvals.
--
-- Additive only: existing columns, the legacy weekly hours-grid flow, and
-- the existing signature_requests/bulk e-signature flow are untouched.
-- A timesheet row with a non-empty daily_entries array is rendered by the
-- app as a "timecard" (the new G2W layout); one without it keeps using
-- the existing hours-grid UI exactly as before.

-- ---------------------------------------------------------------------------
-- employees: human-readable ID used for import matching + display
-- ---------------------------------------------------------------------------
alter table employees add column if not exists employee_number text;

-- ---------------------------------------------------------------------------
-- timesheets: daily entries with punches, job-code summary snapshot,
-- supervisor + audit fields, secure per-recipient link tokens, and the
-- expanded approval-pipeline statuses.
-- ---------------------------------------------------------------------------
alter table timesheets add column if not exists daily_entries jsonb not null default '[]'::jsonb;
-- [{date, dayOfWeek, status:'WORK'|'OFF'|'HOLIDAY'|'PTO'|'SICK', punches:[{in,out}], jobCode, positionTitle, department, hours}]

alter table timesheets add column if not exists regular_hours numeric;
alter table timesheets add column if not exists job_code_summary jsonb not null default '[]'::jsonb;
-- [{department, jobCode, positionTitle, hours, programs, total}]

alter table timesheets add column if not exists employee_number_snapshot text;
alter table timesheets add column if not exists employee_name_snapshot text;

alter table timesheets add column if not exists supervisor_name text;
alter table timesheets add column if not exists supervisor_email text;
alter table timesheets add column if not exists send_log jsonb not null default '[]'::jsonb;
-- append-only audit trail: [{type:'employee'|'supervisor', action:'sent'|'resent', at, byProfileId}]

alter table timesheets add column if not exists employee_signed_at timestamptz;
alter table timesheets add column if not exists supervisor_signature jsonb;
alter table timesheets add column if not exists supervisor_signed_at timestamptz;

alter table timesheets add column if not exists employee_link_token text;
alter table timesheets add column if not exists supervisor_link_token text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'timesheets_employee_link_token_key') then
    alter table timesheets add constraint timesheets_employee_link_token_key unique (employee_link_token);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'timesheets_supervisor_link_token_key') then
    alter table timesheets add constraint timesheets_supervisor_link_token_key unique (supervisor_link_token);
  end if;
end $$;

-- Expand the status pipeline. Existing values (draft/submitted/approved/
-- rejected/paid) stay valid and keep powering the legacy flow untouched;
-- the new values are only ever used on timecards created via upload.
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'timesheets_status_check') then
    alter table timesheets drop constraint timesheets_status_check;
  end if;
  alter table timesheets add constraint timesheets_status_check check (status in (
    'draft', 'submitted', 'approved', 'rejected', 'paid',
    'sent_to_employee', 'employee_approved', 'sent_to_supervisor', 'supervisor_approved', 'completed'
  ));
end $$;

create index if not exists timesheets_employee_link_token_idx on timesheets (employee_link_token) where employee_link_token is not null;
create index if not exists timesheets_supervisor_link_token_idx on timesheets (supervisor_link_token) where supervisor_link_token is not null;

-- ---------------------------------------------------------------------------
-- Public, token-based access for the employee and the supervisor.
-- No RLS SELECT policy is added for anon — access goes only through these
-- two security-definer functions, same pattern as signature_requests.
-- A token resolves to exactly one timesheets row (its own unique column),
-- so it can never be used to open a different employee's timecard.
-- ---------------------------------------------------------------------------
create or replace function get_timecard_by_token(p_token text)
returns table (
  id uuid,
  role text,
  company_name text,
  employee_name text,
  employee_number text,
  week_start_date date,
  week_end_date date,
  regular_hours numeric,
  daily_entries jsonb,
  job_code_summary jsonb,
  status text,
  employee_signature jsonb,
  employee_signed_at timestamptz,
  supervisor_signature jsonb,
  supervisor_signed_at timestamptz,
  supervisor_name text
)
language sql stable security definer as $$
  select
    t.id,
    case when t.employee_link_token = p_token then 'employee' else 'supervisor' end,
    c.name,
    coalesce(t.employee_name_snapshot, e.first_name || ' ' || e.last_name),
    coalesce(t.employee_number_snapshot, e.employee_number),
    t.week_start_date,
    t.week_end_date,
    t.regular_hours,
    t.daily_entries,
    t.job_code_summary,
    t.status,
    t.employee_signature,
    t.employee_signed_at,
    t.supervisor_signature,
    t.supervisor_signed_at,
    t.supervisor_name
  from timesheets t
  join employees e on e.id = t.employee_id
  join companies c on c.id = t.company_id
  where t.employee_link_token = p_token or t.supervisor_link_token = p_token
$$;

grant execute on function get_timecard_by_token(text) to anon, authenticated;

-- Idempotent: calling this twice (double click, page reload after signing)
-- is a no-op the second time — it only applies when the row is still at
-- the stage that token is allowed to act on.
create or replace function sign_timecard_by_token(p_token text, p_signature jsonb)
returns table (status text)
language plpgsql security definer as $$
declare
  v_row timesheets;
begin
  select * into v_row from timesheets
  where employee_link_token = p_token or supervisor_link_token = p_token;

  if v_row.id is null then
    return;
  end if;

  if v_row.employee_link_token = p_token then
    if v_row.status = 'sent_to_employee' then
      update timesheets
      set employee_signature = p_signature, employee_signed_at = now(), status = 'employee_approved'
      where id = v_row.id;
    end if;
  else
    if v_row.status = 'sent_to_supervisor' then
      update timesheets
      set supervisor_signature = p_signature, supervisor_signed_at = now(), status = 'completed'
      where id = v_row.id;
    end if;
  end if;

  return query select t.status from timesheets t where t.id = v_row.id;
end;
$$;

grant execute on function sign_timecard_by_token(text, jsonb) to anon, authenticated;
