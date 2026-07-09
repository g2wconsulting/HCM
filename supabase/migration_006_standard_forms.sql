-- Migration 006: Standard forms (W-4, I-9, W-9) that always exist, get
-- auto-assigned to every new employee, and (for W-4) write results back
-- directly onto the employee record.

alter table form_templates add column if not exists standard_kind text
  check (standard_kind in ('w4', 'i9', 'w9') or standard_kind is null);
alter table form_templates add column if not exists auto_assign boolean not null default false;

-- Seed the three standard templates for every existing company that
-- doesn't already have them (safe to re-run).
do $$
declare
  c record;
begin
  for c in select id from companies loop
    if not exists (select 1 from form_templates where company_id = c.id and standard_kind = 'w4') then
      insert into form_templates (company_id, name, description, standard_kind, auto_assign, active, fields)
      values (c.id, 'Form W-4', 'Federal income tax withholding certificate', 'w4', true, true, '[
        {"id":"legal_name","label":"Legal name","type":"text","required":true},
        {"id":"ssn","label":"Social Security number","type":"text","required":true},
        {"id":"address","label":"Address","type":"text","required":true},
        {"id":"city_state_zip","label":"City, state, ZIP","type":"text","required":true},
        {"id":"filing_status","label":"Filing status","type":"select","required":true,"options":["Single or Married filing separately","Married filing jointly","Head of household"]},
        {"id":"multiple_jobs","label":"Multiple jobs or spouse works","type":"checkbox","required":false},
        {"id":"qualifying_children","label":"Qualifying children under 17","type":"number","required":false},
        {"id":"other_dependents","label":"Other dependents","type":"number","required":false},
        {"id":"other_income","label":"Other income (not from jobs)","type":"number","required":false},
        {"id":"deductions","label":"Deductions","type":"number","required":false},
        {"id":"extra_withholding","label":"Extra withholding per pay period","type":"number","required":false}
      ]'::jsonb);
    end if;

    if not exists (select 1 from form_templates where company_id = c.id and standard_kind = 'i9') then
      insert into form_templates (company_id, name, description, standard_kind, auto_assign, active, fields)
      values (c.id, 'Form I-9', 'Employment eligibility verification', 'i9', true, true, '[
        {"id":"last_name","label":"Last name","type":"text","required":true},
        {"id":"first_name","label":"First name","type":"text","required":true},
        {"id":"middle_initial","label":"Middle initial","type":"text","required":false},
        {"id":"other_last_names","label":"Other last names used","type":"text","required":false},
        {"id":"address","label":"Address","type":"text","required":true},
        {"id":"apt_number","label":"Apt number","type":"text","required":false},
        {"id":"city","label":"City","type":"text","required":true},
        {"id":"state","label":"State","type":"text","required":true},
        {"id":"zip","label":"ZIP code","type":"text","required":true},
        {"id":"date_of_birth","label":"Date of birth","type":"date","required":true},
        {"id":"ssn","label":"Social Security number","type":"text","required":true},
        {"id":"email","label":"Email","type":"text","required":false},
        {"id":"phone","label":"Phone","type":"text","required":false},
        {"id":"citizenship_status","label":"Citizenship / immigration status","type":"select","required":true,"options":["A citizen of the United States","A noncitizen national of the United States","A lawful permanent resident","A noncitizen authorized to work"]},
        {"id":"uscis_a_number","label":"USCIS / A-Number","type":"text","required":false},
        {"id":"work_auth_expiration","label":"Work authorization expiration date","type":"date","required":false}
      ]'::jsonb);
    end if;

    if not exists (select 1 from form_templates where company_id = c.id and standard_kind = 'w9') then
      insert into form_templates (company_id, name, description, standard_kind, auto_assign, active, fields)
      values (c.id, 'Form W-9', 'Request for taxpayer identification number', 'w9', false, true, '[
        {"id":"name","label":"Name","type":"text","required":true},
        {"id":"business_name","label":"Business name / disregarded entity name","type":"text","required":false},
        {"id":"tax_classification","label":"Federal tax classification","type":"select","required":true,"options":["Individual/sole proprietor","C Corporation","S Corporation","Partnership","Trust/estate","Limited liability company","Other"]},
        {"id":"llc_tax_classification","label":"LLC tax classification (C, S, or P)","type":"text","required":false},
        {"id":"exempt_payee_code","label":"Exempt payee code (if any)","type":"text","required":false},
        {"id":"address","label":"Address","type":"text","required":true},
        {"id":"city_state_zip","label":"City, state, ZIP","type":"text","required":true},
        {"id":"account_numbers","label":"Account number(s) (optional)","type":"text","required":false},
        {"id":"ssn_or_ein","label":"SSN or EIN","type":"text","required":true}
      ]'::jsonb);
    end if;
  end loop;
end $$;
