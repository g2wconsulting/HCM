import { inputClass } from '../ui';
import type { FormResponses } from './W4Form';

export function W9Form({
  responses, onChange, readOnly,
}: {
  responses: FormResponses;
  onChange?: (id: string, value: string | number | boolean) => void;
  readOnly?: boolean;
}) {
  const v = (id: string) => responses[id];
  const set = (id: string, val: string | number | boolean) => onChange?.(id, val);
  const classification = v('tax_classification') as string | undefined;

  if (readOnly) {
    return (
      <div className="space-y-3 text-sm">
        <Row label="Name" value={v('name')} />
        <Row label="Business name" value={v('business_name')} />
        <Row label="Federal tax classification" value={classification} />
        {classification === 'Limited liability company' && <Row label="LLC classification" value={v('llc_tax_classification')} />}
        <Row label="Address" value={`${v('address') ?? ''}, ${v('city_state_zip') ?? ''}`} />
        <Row label="SSN or EIN" value={v('ssn_or_ein')} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="font-display text-lg">Form W-9</div>
        <p className="text-xs text-[var(--muted)]">Request for Taxpayer Identification Number and Certification.</p>
      </div>

      <Field label="Name" hint="as shown on your income tax return"><input value={(v('name') as string) ?? ''} onChange={e => set('name', e.target.value)} className={inputClass} /></Field>
      <Field label="Business name / disregarded entity name" hint="if different from above"><input value={(v('business_name') as string) ?? ''} onChange={e => set('business_name', e.target.value)} className={inputClass} /></Field>

      <div>
        <div className="text-sm font-medium text-[var(--ink-soft)] mb-2">Federal tax classification</div>
        <div className="grid grid-cols-2 gap-2">
          {['Individual/sole proprietor', 'C Corporation', 'S Corporation', 'Partnership', 'Trust/estate', 'Limited liability company', 'Other'].map(opt => (
            <label key={opt} className="flex items-center gap-2 text-sm">
              <input type="radio" name="tax_classification" checked={classification === opt} onChange={() => set('tax_classification', opt)} />
              {opt}
            </label>
          ))}
        </div>
      </div>
      {classification === 'Limited liability company' && (
        <Field label="LLC tax classification" hint="Enter C, S, or P"><input value={(v('llc_tax_classification') as string) ?? ''} onChange={e => set('llc_tax_classification', e.target.value)} className={inputClass} maxLength={1} /></Field>
      )}
      <Field label="Exempt payee code" hint="if any, leave blank if not applicable"><input value={(v('exempt_payee_code') as string) ?? ''} onChange={e => set('exempt_payee_code', e.target.value)} className={inputClass} /></Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Address"><input value={(v('address') as string) ?? ''} onChange={e => set('address', e.target.value)} className={inputClass} /></Field>
        <Field label="City, state, ZIP"><input value={(v('city_state_zip') as string) ?? ''} onChange={e => set('city_state_zip', e.target.value)} className={inputClass} /></Field>
      </div>
      <Field label="Account number(s)" hint="optional"><input value={(v('account_numbers') as string) ?? ''} onChange={e => set('account_numbers', e.target.value)} className={inputClass} /></Field>

      <div className="pt-2 border-t border-[var(--border-soft)]">
        <div className="text-sm font-medium text-[var(--ink-soft)] mb-2">Part I — Taxpayer Identification Number (TIN)</div>
        <Field label="Social Security number or Employer ID number"><input value={(v('ssn_or_ein') as string) ?? ''} onChange={e => set('ssn_or_ein', e.target.value)} className={inputClass} /></Field>
      </div>

      <p className="text-xs text-[var(--muted)] pt-2">
        Part II — Certification: under penalties of perjury, you certify the TIN above is correct and you're not
        subject to backup withholding, unless noted otherwise — signed below.
      </p>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-[var(--ink-soft)] font-medium">{label}</span>
      {hint && <span className="text-xs text-[var(--muted)]">{hint}</span>}
      {children}
    </label>
  );
}

function Row({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between border-b border-[var(--border-soft)] pb-1.5">
      <span className="text-[var(--muted)]">{label}</span>
      <span className="font-medium">{value ?? '—'}</span>
    </div>
  );
}
