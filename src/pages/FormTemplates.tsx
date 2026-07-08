import { useState } from 'react';
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl">Forms</h1>
          <p className="text-[var(--ink-soft)] mt-1">Build custom forms — assign them to employees from their profile.</p>
        </div>
        <Button onClick={() => setShowNew(true)}>+ New form</Button>
      </div>

      {showNew && <TemplateEditor onDone={() => setShowNew(false)} />}

      <div className="grid grid-cols-2 gap-4">
        {data.formTemplates.map(tpl => (
          <Card key={tpl.id}>
            {editingId === tpl.id ? (
              <TemplateEditor existing={tpl} onDone={() => setEditingId(null)} />
            ) : (
              <>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium">{tpl.name}</div>
                    {tpl.description && <div className="text-xs text-[var(--muted)] mt-0.5">{tpl.description}</div>}
                  </div>
                  <Badge tone={tpl.active ? 'good' : 'neutral'}>{tpl.active ? 'active' : 'archived'}</Badge>
                </div>
                <div className="text-xs text-[var(--muted)] mt-3">{tpl.fields.length} field{tpl.fields.length !== 1 ? 's' : ''}</div>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" variant="secondary" onClick={() => setEditingId(tpl.id)}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => updateFormTemplate(tpl.id, { active: !tpl.active })}>
                    {tpl.active ? 'Archive' : 'Reactivate'}
                  </Button>
                </div>
              </>
            )}
          </Card>
        ))}
        {data.formTemplates.length === 0 && !showNew && (
          <p className="text-sm text-[var(--muted)] col-span-2 py-6">No forms yet. Create one to get started.</p>
        )}
      </div>
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
