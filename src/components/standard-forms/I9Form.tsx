import { inputClass } from '../ui';
import type { FormResponses } from './W4Form';

export function I9Form({
  responses, onChange, readOnly,
}: {
  responses: FormResponses;
  onChange?: (id: string, value: string | number | boolean) => void;
  readOnly?: boolean;
}) {
  const v = (id: string) => responses[id];
  const set = (id: string, val: string | number | boolean) => onChange?.(id, val);
  const status = v('citizenship_status') as string | undefined;
  const needsAuthDetails = status === 'A lawful permanent resident' || status === 'A noncitizen authorized to work';

  if (readOnly) {
    return (
      <div className="space-y-3 text-sm">
        <Row label="Name" value={`${v('first_name') ?? ''} ${v('middle_initial') ?? ''} ${v('last_name') ?? ''}`} />
        <Row label="Address" value={`${v('address') ?? ''} ${v('apt_number') ?? ''}, ${v('city') ?? ''}, ${v('state') ?? ''} ${v('zip') ?? ''}`} />
        <Row label="Date of birth" value={v('date_of_birth')} />
        <Row label="SSN" value={v('ssn')} />
        <Row label="Citizenship status" value={status} />
        {needsAuthDetails && <Row label="USCIS / A-Number" value={v('uscis_a_number')} />}
        {status === 'A noncitizen authorized to work' && <Row label="Work authorization expires" value={v('work_auth_expiration')} />}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="font-display text-lg">Form I-9 — Section 1</div>
        <p className="text-xs text-[var(--muted)]">Employment Eligibility Verification. Employee information and attestation — complete no later than your first day of work.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Last name"><input value={(v('last_name') as string) ?? ''} onChange={e => set('last_name', e.target.value)} className={inputClass} /></Field>
        <Field label="First name"><input value={(v('first_name') as string) ?? ''} onChange={e => set('first_name', e.target.value)} className={inputClass} /></Field>
        <Field label="Middle initial"><input value={(v('middle_initial') as string) ?? ''} onChange={e => set('middle_initial', e.target.value)} className={inputClass} /></Field>
      </div>
      <Field label="Other last names used" hint="if any"><input value={(v('other_last_names') as string) ?? ''} onChange={e => set('other_last_names', e.target.value)} className={inputClass} /></Field>

      <div className="grid grid-cols-4 gap-3">
        <div className="col-span-2"><Field label="Address"><input value={(v('address') as string) ?? ''} onChange={e => set('address', e.target.value)} className={inputClass} /></Field></div>
        <Field label="Apt #"><input value={(v('apt_number') as string) ?? ''} onChange={e => set('apt_number', e.target.value)} className={inputClass} /></Field>
        <Field label="City"><input value={(v('city') as string) ?? ''} onChange={e => set('city', e.target.value)} className={inputClass} /></Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="State"><input value={(v('state') as string) ?? ''} onChange={e => set('state', e.target.value)} className={inputClass} /></Field>
        <Field label="ZIP code"><input value={(v('zip') as string) ?? ''} onChange={e => set('zip', e.target.value)} className={inputClass} /></Field>
        <Field label="Date of birth"><input type="date" value={(v('date_of_birth') as string) ?? ''} onChange={e => set('date_of_birth', e.target.value)} className={inputClass} /></Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Social Security number"><input value={(v('ssn') as string) ?? ''} onChange={e => set('ssn', e.target.value)} className={inputClass} /></Field>
        <Field label="Email"><input value={(v('email') as string) ?? ''} onChange={e => set('email', e.target.value)} className={inputClass} /></Field>
        <Field label="Phone"><input value={(v('phone') as string) ?? ''} onChange={e => set('phone', e.target.value)} className={inputClass} /></Field>
      </div>

      <div className="pt-2">
        <div className="font-medium text-sm mb-2">Attestation of citizenship / immigration status</div>
        <div className="space-y-2">
          {['A citizen of the United States', 'A noncitizen national of the United States', 'A lawful permanent resident', 'A noncitizen authorized to work'].map(opt => (
            <label key={opt} className="flex items-center gap-2 text-sm">
              <input type="radio" name="citizenship_status" checked={status === opt} onChange={() => set('citizenship_status', opt)} />
              {opt}
            </label>
          ))}
        </div>
      </div>

      {needsAuthDetails && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="USCIS / A-Number"><input value={(v('uscis_a_number') as string) ?? ''} onChange={e => set('uscis_a_number', e.target.value)} className={inputClass} /></Field>
          {status === 'A noncitizen authorized to work' && (
            <Field label="Work authorization expiration date"><input type="date" value={(v('work_auth_expiration') as string) ?? ''} onChange={e => set('work_auth_expiration', e.target.value)} className={inputClass} /></Field>
          )}
        </div>
      )}

      <p className="text-xs text-[var(--muted)] pt-2">
        I attest, under penalty of perjury, that the information above is true and correct — signed below.
        Section 2 (employer review of identity/work authorization documents) will be completed by your employer.
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
