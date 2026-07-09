import { useState } from 'react';
import { useApp } from '../lib/AppContext';
import { Badge, Button, Card, inputClass } from '../components/ui';
import { money } from '../lib/format';

export function Projects() {
  const { data, addProject, updateProject } = useApp();
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [billRate, setBillRate] = useState('');
  const [budget, setBudget] = useState('');

  function create() {
    if (!name.trim()) return;
    const client = data.clients.find(c => c.id === clientId);
    addProject({
      companyId: data.currentCompanyId!, name: name.trim(), clientId: clientId || null,
      clientName: client?.name, code: name.trim().slice(0, 6).toUpperCase(), active: true,
      billRate: billRate ? parseFloat(billRate) : undefined,
      budget: budget ? parseFloat(budget) : undefined,
    } as any);
    setName(''); setClientId(''); setBillRate(''); setBudget(''); setShowNew(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl">Projects</h1>
          <p className="text-[var(--ink-soft)] mt-1">{data.projects.length} projects across {data.clients.length} client{data.clients.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => setShowNew(v => !v)}>+ New project</Button>
      </div>

      {showNew && (
        <Card>
          <div className="grid grid-cols-4 gap-3">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Project name" className={inputClass} />
            <select value={clientId} onChange={e => setClientId(e.target.value)} className={inputClass}>
              <option value="">No client (internal)</option>
              {data.clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input value={billRate} onChange={e => setBillRate(e.target.value)} placeholder="Bill rate $/hr" className={inputClass} />
            <input value={budget} onChange={e => setBudget(e.target.value)} placeholder="Budget $ (optional)" className={inputClass} />
          </div>
          <div className="flex gap-2 mt-3">
            <Button onClick={create}>Create</Button>
            <Button variant="ghost" onClick={() => setShowNew(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4">
        {data.projects.map(p => {
          const assignedCount = data.employees.filter(e => e.projectIds.includes(p.id)).length;
          const hoursLogged = data.timesheets.flatMap(t => t.entries).filter(e => e.projectId === p.id).reduce((s, e) => s + e.hours, 0);
          const client = data.clients.find(c => c.id === p.clientId);
          const spent = p.billRate != null ? hoursLogged * p.billRate : undefined;
          const pct = p.budget && spent != null ? Math.min(100, Math.round((spent / p.budget) * 100)) : null;
          const overBudget = pct !== null && spent! > p.budget!;
          return (
            <Card key={p.id}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-[var(--muted)]">{client ? client.name : 'Internal'}</div>
                </div>
                <Badge tone={p.active ? 'good' : 'neutral'}>{p.active ? 'active' : 'archived'}</Badge>
              </div>

              {p.budget != null && spent != null ? (
                <div className="mt-4">
                  <div className="h-1.5 rounded-full bg-[var(--border-soft)] overflow-hidden">
                    <div className={`h-full rounded-full ${overBudget ? 'bg-[var(--bad)]' : 'bg-[var(--accent)]'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between mt-1.5 text-sm">
                    <span className="tabular font-medium">{money(spent)} spent</span>
                    <span className="text-[var(--muted)]">of {money(p.budget)}</span>
                  </div>
                </div>
              ) : (
                <div className="mt-4 text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-[var(--muted)]">Team</span><span>{assignedCount} people</span></div>
                  <div className="flex justify-between"><span className="text-[var(--muted)]">Hours logged</span><span className="tabular">{hoursLogged.toFixed(1)}</span></div>
                  {p.billRate != null && <div className="flex justify-between"><span className="text-[var(--muted)]">Bill rate</span><span className="tabular">{money(p.billRate)}/hr</span></div>}
                </div>
              )}

              <button onClick={() => updateProject(p.id, { active: !p.active })} className="focus-ring mt-3 text-xs text-[var(--muted)] hover:text-[var(--ink)] underline">
                {p.active ? 'Archive project' : 'Reactivate project'}
              </button>
            </Card>
          );
        })}
        {data.projects.length === 0 && <p className="text-sm text-[var(--muted)] col-span-2 py-6">No projects yet.</p>}
      </div>
    </div>
  );
}
