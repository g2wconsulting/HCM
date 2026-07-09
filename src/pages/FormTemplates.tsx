import { Fragment, useState } from 'react';
import { useApp } from '../lib/AppContext';
import { Badge, Button, Card, Field, SectionLabel, inputClass } from '../components/ui';
import { uid } from '../lib/db';
import type { FormField, FormFieldType, FormTemplate } from '../lib/types';

const FIELD_TYPES: { value: FormFieldType; label: string }[] = [
  { value: 'text', label: 'Short text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'select', label: 'Dropdown' },
];

export function FormTemplates() {
  const { data, updateFormTemplate } = useApp();
  const [showNew, setShowNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl">Forms</h1>
          <p className="text-[var(--ink-soft)] mt-1">{data.formTemplates.length} custom form{data.formTemplates.length !== 1 ? 's' : ''} · build your own fields</p>
        </div>
        <Button onClick={() => setShowNew(true)}>+ New form</Button>
      </div>

      {showNew && <TemplateEditor onDone={() => setShowNew(false)} />}
      {editingId && <TemplateEditor existing={data.formTemplates.find(t => t.id === editingId)} onDone={() => setEditingId(null)} />}

      <Card className="!p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-[var(--muted)] border-b border-[var(--border)]">
              <th className="px-5 py-3 font-semibold">Form name</th>
              <th className="px-5 py-3 font-semibold text-right">Fields</th>
              <th className="px-5 py-3 font-semibold text-right">Responses</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {data.formTemplates.map(tpl => {
              const responseCount = data.formSubmissions.filter(s => s.templateId === tpl.id && s.status === 'submitted').length;
              const isPreviewing = previewId === tpl.id;
              return (
                <Fragment key={tpl.id}>
                  <tr className="border-b border-[var(--border-soft)] last:border-0 hover:bg-[var(--paper)]/60">
                    <td className="px-5 py-3">
                      <div className="font-medium">{tpl.name}</div>
                      {tpl.description && <div className="text-xs text-[var(--muted)]">{tpl.description}</div>}
                    </td>
                    <td className="px-5 py-3 text-right tabular">{tpl.fields.length}</td>
                    <td className="px-5 py-3 text-right tabular font-medium">{responseCount}</td>
                    <td className="px-5 py-3"><Badge tone={tpl.active ? 'good' : 'neutral'}>{tpl.active ? 'active' : 'archived'}</Badge></td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <Button size="sm" variant="secondary" onClick={() => setPreviewId(isPreviewing ? null : tpl.id)}>
                          {isPreviewing ? 'Close' : 'Preview'}
                        </Button>
                        <Button size="sm" onClick={() => setEditingId(tpl.id)}>Edit</Button>
                      </div>
                    </td>
                  </tr>
                  {isPreviewing && (
                    <tr>
                      <td colSpan={5} className="px-5 py-4 bg-[var(--paper)]/40">
                        <div className="space-y-1.5 max-w-md">
                          {tpl.fields.map(f => (
                            <div key={f.id} className="flex items-center justify-between text-sm">
                              <span className="text-[var(--ink-soft)]">{f.label || '(untitled field)'}{f.required && <span className="text-[var(--bad)]"> *</span>}</span>
                              <span className="text-xs text-[var(--muted)] uppercase tracking-wide">{f.type}</span>
                            </div>
                          ))}
                          <button onClick={() => updateFormTemplate(tpl.id, { active: !tpl.active })} className="focus-ring text-xs text-[var(--muted)] hover:text-[var(--ink)] underline mt-2">
                            {tpl.active ? 'Archive this form' : 'Reactivate this form'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {data.formTemplates.length === 0 && !showNew && (
              <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-[var(--muted)]">No forms yet. Create one to get started.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function TemplateEditor({ existing, onDone }: { existing?: FormTemplate; onDone: () => void }) {
  const { addFormTemplate, updateFormTemplate } = useApp();
  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [fields, setFields] = useState<FormField[]>(existing?.fields ?? []);

  function addField() {
    setFields([...fields, { id: uid(), label: '', type: 'text', required: true }]);
  }
  function updateField(id: string, patch: Partial<FormField>) {
    setFields(fields.map(f => f.id === id ? { ...f, ...patch } : f));
  }
  function removeField(id: string) {
    setFields(fields.filter(f => f.id !== id));
  }

  async function save() {
    if (!name.trim() || fields.length === 0) return;
    if (existing) {
      await updateFormTemplate(existing.id, { name: name.trim(), description: description.trim() || undefined, fields });
    } else {
      await addFormTemplate({ companyId: '', name: name.trim(), description: description.trim() || undefined, fields, active: true } as any);
    }
    onDone();
  }

  return (
    <Card>
      <SectionLabel>{existing ? 'Edit form' : 'New form'}</SectionLabel>
      <div className="space-y-3">
        <Field label="Form name">
          <input value={name} onChange={e => setName(e.target.value)} className={inputClass} placeholder="e.g. Equipment Request" />
        </Field>
        <Field label="Description (optional)">
          <input value={description} onChange={e => setDescription(e.target.value)} className={inputClass} />
        </Field>

        <div className="space-y-2">
          <SectionLabel>Fields</SectionLabel>
          {fields.map(f => (
            <div key={f.id} className="border border-[var(--border-soft)] rounded-lg p-3 space-y-2">
              <div className="grid grid-cols-[1fr_140px_auto] gap-2 items-center">
                <input value={f.label} onChange={e => updateField(f.id, { label: e.target.value })} placeholder="Field label" className={inputClass} />
                <select value={f.type} onChange={e => updateField(f.id, { type: e.target.value as FormFieldType })} className={inputClass}>
                  {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <button onClick={() => removeField(f.id)} className="focus-ring text-xs text-[var(--bad)] hover:underline px-2">Remove</button>
              </div>
              {f.type === 'select' && (
                <input
                  value={(f.options ?? []).join(', ')}
                  onChange={e => updateField(f.id, { options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                  placeholder="Options, comma separated"
                  className={inputClass}
                />
              )}
              <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
                <input type="checkbox" checked={f.required} onChange={e => updateField(f.id, { required: e.target.checked })} />
                Required
              </label>
            </div>
          ))}
          <button onClick={addField} className="focus-ring text-sm text-[var(--accent)] hover:underline">+ Add field</button>
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={save}>{existing ? 'Save changes' : 'Create form'}</Button>
          <Button variant="ghost" onClick={onDone}>Cancel</Button>
        </div>
      </div>
    </Card>
  );
}
