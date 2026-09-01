import { useState } from 'react';
import { useApp } from '../lib/AppContext';
import { Badge, Button, Card, inputClass } from '../components/ui';
import { money } from '../lib/format';

export function Departments() {
  const { data, addDepartment } = useApp();
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function create() {
    if (!name.trim()) return;
    addDepartment({ companyId: data.currentCompanyId!, name: name.trim(), clientId: clientId || null, active: true } as any);
    setName(''); setClientId(''); setShowNew(false);
  }

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl">Departments</h1>
          <p className="text-[var(--ink-soft)] mt-1">
            {data.departments.length} department{data.departments.length !== 1 ? 's' : ''} · used to classify timecard work and assign block pay by position
          </p>
        </div>
        <Button onClick={() => setShowNew(v => !v)}>+ New department</Button>
      </div>

      {showNew && (
        <Card>
          <div className="grid grid-cols-3 gap-3">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Department name (e.g. FCS Teaching Museum)" className={inputClass} />
            <select value={clientId} onChange={e => setClientId(e.target.value)} className={inputClass}>
              <option value="">No client (internal)</option>
              {data.clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="flex gap-2">
              <Button onClick={create}>Create</Button>
              <Button variant="ghost" onClick={() => setShowNew(false)}>Cancel</Button>
            </div>
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {data.departments.map(d => {
          const client = data.clients.find(c => c.id === d.clientId);
          const positions = data.positions.filter(p => p.departmentId === d.id);
          const isOpen = expanded.has(d.id);
          return (
            <Card key={d.id} className="!p-0 overflow-hidden">
              <button onClick={() => toggle(d.id)} className="focus-ring w-full flex items-center justify-between px-5 py-3.5 hover:bg-[var(--paper)]/60 transition-colors">
                <div className="flex items-center gap-2">
                  <span className={`text-[var(--muted)] transition-transform ${isOpen ? 'rotate-90' : ''}`}>▸</span>
                  <span className="font-medium">{d.name}</span>
                  <span className="text-xs text-[var(--muted)]">{client ? client.name : 'Internal'}</span>
                  <Badge tone={d.active ? 'good' : 'neutral'}>{d.active ? 'active' : 'inactive'}</Badge>
                </div>
                <span className="text-xs text-[var(--muted)]">{positions.length} position{positions.length !== 1 ? 's' : ''}</span>
              </button>
              {isOpen && <PositionsPanel departmentId={d.id} positions={positions} />}
            </Card>
          );
        })}
        {data.departments.length === 0 && !showNew && (
          <p className="text-sm text-[var(--muted)] py-6">No departments yet. Add one to start classifying timecard work by job code and position.</p>
        )}
      </div>
    </div>
  );
}

function PositionsPanel({ departmentId, positions }: { departmentId: string; positions: { id: string; title: string; jobCode: string; blockPayAmount?: number; blockPayHours?: number; active: boolean }[] }) {
  const { data, addPosition, updatePosition } = useApp();
  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState('');
  const [jobCode, setJobCode] = useState('');
  const [blockPayAmount, setBlockPayAmount] = useState('');
  const [blockPayHours, setBlockPayHours] = useState('');

  function create() {
    if (!title.trim()) return;
    addPosition({
      companyId: data.currentCompanyId!, departmentId, title: title.trim(), jobCode: jobCode.trim().toUpperCase(),
      blockPayAmount: blockPayAmount ? parseFloat(blockPayAmount) : undefined,
      blockPayHours: blockPayHours ? parseFloat(blockPayHours) : undefined,
      active: true,
    } as any);
    setTitle(''); setJobCode(''); setBlockPayAmount(''); setBlockPayHours(''); setShowNew(false);
  }

  return (
    <div className="border-t border-[var(--border-soft)] px-5 py-4 space-y-3">
      {positions.map(p => (
        <div key={p.id} className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <span className="font-medium">{p.title}</span>
            {p.jobCode && <span className="text-xs text-[var(--muted)] font-mono">{p.jobCode}</span>}
            <Badge tone={p.active ? 'good' : 'neutral'}>{p.active ? 'active' : 'inactive'}</Badge>
          </div>
          <div className="flex items-center gap-3">
            {p.blockPayAmount != null ? (
              <span className="text-xs text-[var(--accent-dark)] tabular">
                {money(p.blockPayAmount)} flat{p.blockPayHours ? ` / ${p.blockPayHours}h block` : ''}
              </span>
            ) : (
              <span className="text-xs text-[var(--muted)]">hourly</span>
            )}
            <button onClick={() => updatePosition(p.id, { active: !p.active })} className="focus-ring text-xs text-[var(--muted)] hover:text-[var(--ink)] underline">
              {p.active ? 'Deactivate' : 'Reactivate'}
            </button>
          </div>
        </div>
      ))}
      {positions.length === 0 && !showNew && <p className="text-sm text-[var(--muted)]">No positions yet.</p>}

      {showNew ? (
        <div className="grid grid-cols-5 gap-2 items-end pt-2">
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Position title" className={inputClass} />
          <input value={jobCode} onChange={e => setJobCode(e.target.value)} placeholder="Job code" className={inputClass} />
          <input value={blockPayAmount} onChange={e => setBlockPayAmount(e.target.value)} placeholder="Block pay $ (optional)" className={inputClass} />
          <input value={blockPayHours} onChange={e => setBlockPayHours(e.target.value)} placeholder="Block hours (optional)" className={inputClass} />
          <div className="flex gap-2">
            <Button size="sm" onClick={create}>Add</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowNew(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="secondary" onClick={() => setShowNew(true)}>+ Add position</Button>
      )}
      <p className="text-xs text-[var(--muted)] pt-1">
        Set a flat block pay amount when this client pays a fixed rate per scheduled block (e.g. $120 for an 8-hour
        block) regardless of actual hours clocked — leave it blank for normal hourly pay.
      </p>
    </div>
  );
}
