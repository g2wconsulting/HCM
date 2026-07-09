import { inputClass } from '../ui';

export type FormResponses = Record<string, string | number | boolean>;

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-[var(--ink-soft)] font-medium">{label}</span>
      {hint && <span className="text-xs text-[var(--muted)]">{hint}</span>}
      {children}
    </label>
  );
}

function StepHeader({ n, title }: { n: string; title: string }) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <div className="w-6 h-6 rounded-full bg-[var(--ink)] text-white text-xs font-semibold flex items-center justify-center shrink-0">{n}</div>
      <div className="font-medium text-sm">{title}</div>
    </div>
  );
}

export function W4Form({
  responses, onChange, readOnly,
}: {
  responses: FormResponses;
  onChange?: (id: string, value: string | number | boolean) => void;
  readOnly?: boolean;
}) {
  const v = (id: string) => responses[id];
  const set = (id: string, val: string | number | boolean) => onChange?.(id, val);

  const qualifyingChildren = Number(v('qualifying_children')) || 0;
  const otherDependents = Number(v('other_dependents')) || 0;
  const computedDependentsAmount = qualifyingChildren * 2000 + otherDependents * 500;

  if (readOnly) {
    return (
      <div className="space-y-3 text-sm">
        <Row label="Legal name" value={v('legal_name')} />
        <Row label="Address" value={`${v('address') ?? ''}, ${v('city_state_zip') ?? ''}`} />
        <Row label="Filing status" value={v('filing_status')} />
        <Row label="Multiple jobs / spouse works" value={v('multiple_jobs') ? 'Yes' : 'No'} />
        <Row label="Dependents credit" value={`$${computedDependentsAmount.toLocaleString()}`} />
        <Row label="Other income" value={v('other_income') ? `$${v('other_income')}` : '—'} />
        <Row label="Deductions" value={v('deductions') ? `$${v('deductions')}` : '—'} />
        <Row label="Extra withholding per pay period" value={v('extra_withholding') ? `$${v('extra_withholding')}` : '—'} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="font-display text-lg">Form W-4</div>
        <p className="text-xs text-[var(--muted)]">Employee's Withholding Certificate — determines federal income tax withheld from your pay.</p>
      </div>

      <StepHeader n="1" title="Personal information" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Legal name"><input value={(v('legal_name') as string) ?? ''} onChange={e => set('legal_name', e.target.value)} className={inputClass} /></Field>
        <Field label="Social Security number"><input value={(v('ssn') as string) ?? ''} onChange={e => set('ssn', e.target.value)} className={inputClass} /></Field>
        <Field label="Address"><input value={(v('address') as string) ?? ''} onChange={e => set('address', e.target.value)} className={inputClass} /></Field>
        <Field label="City, state, ZIP"><input value={(v('city_state_zip') as string) ?? ''} onChange={e => set('city_state_zip', e.target.value)} className={inputClass} /></Field>
      </div>
      <Field label="Filing status">
        <select value={(v('filing_status') as string) ?? ''} onChange={e => set('filing_status', e.target.value)} className={inputClass}>
          <option value="" disabled>Select…</option>
          <option>Single or Married filing separately</option>
          <option>Married filing jointly</option>
          <option>Head of household</option>
        </select>
      </Field>

      <StepHeader n="2" title="Multiple jobs or spouse works" />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={Boolean(v('multiple_jobs'))} onChange={e => set('multiple_jobs', e.target.checked)} />
        I have more than one job at a time, or my spouse also works
      </label>

      <StepHeader n="3" title="Claim dependents" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Qualifying children under 17" hint="× $2,000 each"><input type="number" value={(v('qualifying_children') as number) ?? ''} onChange={e => set('qualifying_children', parseFloat(e.target.value) || 0)} className={inputClass} /></Field>
        <Field label="Other dependents" hint="× $500 each"><input type="number" value={(v('other_dependents') as number) ?? ''} onChange={e => set('other_dependents', parseFloat(e.target.value) || 0)} className={inputClass} /></Field>
      </div>
      <p className="text-xs text-[var(--muted)]">Total dependents credit: <strong className="tabular">${computedDependentsAmount.toLocaleString()}</strong></p>

      <StepHeader n="4" title="Other adjustments (optional)" />
      <div className="grid grid-cols-3 gap-3">
        <Field label="Other income"><input type="number" value={(v('other_income') as number) ?? ''} onChange={e => set('other_income', parseFloat(e.target.value) || 0)} className={inputClass} /></Field>
        <Field label="Deductions"><input type="number" value={(v('deductions') as number) ?? ''} onChange={e => set('deductions', parseFloat(e.target.value) || 0)} className={inputClass} /></Field>
        <Field label="Extra withholding" hint="per paycheck"><input type="number" value={(v('extra_withholding') as number) ?? ''} onChange={e => set('extra_withholding', parseFloat(e.target.value) || 0)} className={inputClass} /></Field>
      </div>

      <StepHeader n="5" title="Sign" />
      <p className="text-xs text-[var(--muted)]">Under penalties of perjury, you declare this certificate is, to the best of your knowledge, true and correct — signed below.</p>
    </div>
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
