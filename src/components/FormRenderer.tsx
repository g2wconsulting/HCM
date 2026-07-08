import { inputClass } from './ui';
import type { FormField, FormTemplate } from '../lib/types';

type Responses = Record<string, string | number | boolean>;

export function FormRenderer({
  template, responses, onChange, readOnly,
}: {
  template: FormTemplate;
  responses: Responses;
  onChange?: (fieldId: string, value: string | number | boolean) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="space-y-3">
      {template.fields.map(f => (
        <FieldRow key={f.id} field={f} value={responses[f.id]} onChange={onChange} readOnly={readOnly} />
      ))}
    </div>
  );
}

function FieldRow({
  field, value, onChange, readOnly,
}: {
  field: FormField;
  value: string | number | boolean | undefined;
  onChange?: (fieldId: string, value: string | number | boolean) => void;
  readOnly?: boolean;
}) {
  if (readOnly) {
    return (
      <div className="text-sm">
        <div className="text-xs text-[var(--muted)]">{field.label}</div>
        <div>{field.type === 'checkbox' ? (value ? 'Yes' : 'No') : (value ?? '—') as any}</div>
      </div>
    );
  }

  const label = (
    <span className="text-[var(--ink-soft)] font-medium">
      {field.label}{field.required && <span className="text-[var(--bad)]"> *</span>}
    </span>
  );

  if (field.type === 'textarea') {
    return (
      <label className="flex flex-col gap-1 text-sm">
        {label}
        <textarea rows={3} value={(value as string) ?? ''} onChange={e => onChange?.(field.id, e.target.value)} className={inputClass} />
      </label>
    );
  }
  if (field.type === 'checkbox') {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={Boolean(value)} onChange={e => onChange?.(field.id, e.target.checked)} />
        {field.label}{field.required && <span className="text-[var(--bad)]"> *</span>}
      </label>
    );
  }
  if (field.type === 'select') {
    return (
      <label className="flex flex-col gap-1 text-sm">
        {label}
        <select value={(value as string) ?? ''} onChange={e => onChange?.(field.id, e.target.value)} className={inputClass}>
          <option value="" disabled>Select…</option>
          {(field.options ?? []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      </label>
    );
  }
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <input
        type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
        value={(value as string | number) ?? ''}
        onChange={e => onChange?.(field.id, field.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
        className={inputClass}
      />
    </label>
  );
}
