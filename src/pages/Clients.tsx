import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../lib/AppContext';
import { Badge, Button, Card, inputClass } from '../components/ui';

export function Clients() {
  const { data, addClient, updateClient } = useApp();
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  function create() {
    if (!name.trim()) return;
    addClient({
      companyId: data.currentCompanyId!, name: name.trim(),
      contactName: contactName.trim() || undefined, contactEmail: contactEmail.trim() || undefined, active: true,
    } as any);
    setName(''); setContactName(''); setContactEmail(''); setShowNew(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl">Clients</h1>
          <p className="text-[var(--ink-soft)] mt-1">Companies you place employees with — each gets their own portal login.</p>
        </div>
        <Button onClick={() => setShowNew(v => !v)}>+ New client</Button>
      </div>

      {showNew && (
        <Card>
          <div className="grid grid-cols-3 gap-3">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Client company name" className={inputClass} />
            <input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Contact name (optional)" className={inputClass} />
            <input value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="Contact email (optional)" className={inputClass} />
          </div>
          <div className="flex gap-2 mt-3">
            <Button onClick={create}>Create client</Button>
            <Button variant="ghost" onClick={() => setShowNew(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-4">
        {data.clients.map(c => {
          const projectCount = data.projects.filter(p => p.clientId === c.id).length;
          const employeeCount = data.employees.filter(e =>
            e.projectIds.some(pid => data.projects.find(p => p.id === pid)?.clientId === c.id)
          ).length;
          return (
            <Card key={c.id}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium">{c.name}</div>
                  {c.contactName && <div className="text-xs text-[var(--muted)]">{c.contactName}</div>}
                </div>
                <Badge tone={c.active ? 'good' : 'neutral'}>{c.active ? 'active' : 'inactive'}</Badge>
              </div>
              <div className="mt-4 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-[var(--muted)]">Projects</span><span className="tabular">{projectCount}</span></div>
                <div className="flex justify-between"><span className="text-[var(--muted)]">People placed</span><span className="tabular">{employeeCount}</span></div>
                {c.contactEmail && <div className="flex justify-between"><span className="text-[var(--muted)]">Contact</span><span className="truncate max-w-[140px]">{c.contactEmail}</span></div>}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <Link to="/projects" className="focus-ring text-xs text-[var(--accent)] hover:underline">Manage projects →</Link>
                <button onClick={() => updateClient(c.id, { active: !c.active })} className="focus-ring text-xs text-[var(--muted)] hover:text-[var(--ink)] underline">
                  {c.active ? 'Deactivate' : 'Reactivate'}
                </button>
              </div>
            </Card>
          );
        })}
        {data.clients.length === 0 && !showNew && (
          <p className="text-sm text-[var(--muted)] col-span-3 py-6">No clients yet. Add one to start assigning employees and projects.</p>
        )}
      </div>

      <Card>
        <p className="text-sm text-[var(--ink-soft)]">
          To give a client their own portal login, create them here, then run the{' '}
          <code className="font-mono text-xs bg-[var(--paper)] px-1 py-0.5 rounded">scripts/create-client-login.mjs</code>{' '}
          script from the server (see the README) using this client's id, found in the Supabase Table Editor under the
          <code className="font-mono text-xs bg-[var(--paper)] px-1 py-0.5 rounded">clients</code> table.
        </p>
      </Card>
    </div>
  );
}
