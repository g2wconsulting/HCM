-- Migration 004: External signature requests.
-- Lets an admin send a date range of an employee's timesheets to someone
-- outside the system (e.g. a client hiring manager) by email, for them to
-- review and sign via a public link — no login required. Signing marks
-- the underlying timesheets 'approved', which is what makes them eligible
-- for a payroll run. This is the approval mechanism for companies where
-- internal staff manage time but an external party approves it.

create table if not exists signature_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  timesheet_ids uuid[] not null,
  range_start date not null,
  range_end date not null,
  recipient_name text not null,
  recipient_email text not null,
  token text not null unique,
  status text not null default 'sent' check (status in ('sent', 'viewed', 'signed', 'declined')),
  signature jsonb,
  signed_at timestamptz,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table signature_requests enable row level security;

drop policy if exists "admin manage signature requests" on signature_requests;
create policy "admin manage signature requests" on signature_requests for all
  using (company_id = auth_company_id() and auth_role() = 'admin')
  with check (company_id = auth_company_id() and auth_role() = 'admin');

-- No direct policy for anonymous recipients — they interact only through
-- the two security-definer functions below, which expose the minimum
-- needed and nothing else (not even a raw SELECT on the table).

create or replace function get_signature_request_public(p_token text)
returns table (
  id uuid,
  employee_name text,
  company_name text,
  range_start date,
  range_end date,
  status text,
  signed_at timestamptz,
  weeks jsonb,
  projects jsonb
)
language sql stable security definer as $$
  select
    sr.id,
    e.first_name || ' ' || e.last_name,
    c.name,
    sr.range_start,
    sr.range_end,
    sr.status,
    sr.signed_at,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'weekStartDate', t.week_start_date,
        'weekEndDate', t.week_end_date,
        'entries', t.entries
      ) order by t.week_start_date)
      from timesheets t where t.id = any(sr.timesheet_ids)
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name))
      from projects p where p.company_id = sr.company_id
    ), '[]'::jsonb)
  from signature_requests sr
  join employees e on e.id = sr.employee_id
  join companies c on c.id = sr.company_id
  where sr.token = p_token
$$;

grant execute on function get_signature_request_public(text) to anon, authenticated;

create or replace function mark_signature_request_viewed(p_token text)
returns void
language sql security definer as $$
  update signature_requests set status = 'viewed'
  where token = p_token and status = 'sent'
$$;

grant execute on function mark_signature_request_viewed(text) to anon, authenticated;

create or replace function sign_signature_request_public(p_token text, p_signature jsonb, p_signer_name text)
returns boolean
language plpgsql security definer as $$
declare
  v_request signature_requests;
begin
  select * into v_request from signature_requests where token = p_token and status <> 'signed';
  if v_request.id is null then
    return false;
  end if;

  update signature_requests
  set status = 'signed', signature = p_signature, signed_at = now()
  where id = v_request.id;

  update timesheets
  set status = 'approved',
      approver_name = p_signer_name,
      approver_signature = p_signature,
      approved_at = now()
  where id = any(v_request.timesheet_ids)
    and status not in ('approved', 'paid');

  return true;
end;
$$;

grant execute on function sign_signature_request_public(text, jsonb, text) to anon, authenticated;
