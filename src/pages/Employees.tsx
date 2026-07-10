import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../lib/AppContext';
import { Badge, Button, Card, EmptyState, inputClass } from '../components/ui';
import { initials, money } from '../lib/format';
import type { Employee } from '../lib/types';

function mondayIso(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export function Employees() {
  const { data } = useApp();
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const thisWeekStart = mondayIso(new Date());
  const archivedCount = data.employees.filter(e => e.status === 'terminated').length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = showArchived ? data.employees : data.employees.filter(e => e.status !== 'terminated');
    if (!q) return base;
    return base.filter(emp => {
      const name = `${emp.firstName} ${emp.lastName}`.toLowerCase();
      const clientNames = emp.projectIds
        .map(pid => data.projects.find(p => p.id === pid))
        .map(p => (p?.clientId ? data.clients.find(c => c.id === p.clientId)?.name : undefined))
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return name.includes(q) || clientNames.includes(q) || emp.title.toLowerCase().includes(q);
    });
  }, [data.employees, data.projects, data.clients, search, showArchived]);

  const activeCount = data.employees.filter(e => e.status === 'active').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl">Employees</h1>
          <p className="text-[var(--ink-soft)] mt-1">{data.employees.length} people · {activeCount} active</p>
        </div>
        <Button onClick={() => setShowNew(true)}>+ Add employee</Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, title, or client…"
            className={inputClass + ' pl-9'}
          />
        </div>
        {archivedCount > 0 && (
          <label className="flex items-center gap-2 text-sm text-[var(--ink-soft)] whitespace-nowrap shrink-0">
            <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />
            Show archived ({archivedCount})
          </label>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {filtered.map(emp => {
          const primaryProject = data.projects.find(p => p.id === emp.projectIds[0]);
          const primaryClient = primaryProject?.clientId ? data.clients.find(c => c.id === primaryProject.clientId) : undefined;
          const rateForPrimary = primaryProject ? emp.rates.find(r => r.projectId === primaryProject.id)?.hourlyRate : undefined;
          const rate = rateForPrimary ?? emp.defaultHourlyRate;
          const hoursThisWeek = data.timesheets
            .filter(t => t.employeeId === emp.id && t.weekStartDate === thisWeekStart)
            .flatMap(t => t.entries)
            .reduce((s, e) => s + e.hours, 0);

          return (
            <Link key={emp.id} to={`/employees/${emp.id}`}>
              <Card className="interactive h-full">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[var(--accent-soft)] text-[var(--accent-dark)] flex items-center justify-center font-semibold text-sm">
                      {initials(emp.firstName, emp.lastName)}
                    </div>
                    <div>
                      <div className="font-medium">{emp.firstName} {emp.lastName}</div>
                      <div className="text-xs text-[var(--muted)]">{emp.title}</div>
                    </div>
                  </div>
                  <StatusBadge status={emp.status} />
                </div>
                <div className="mt-4 pt-3 border-t border-[var(--border-soft)] text-sm space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-[var(--muted)]">Placed at</span>
                    <span className="font-medium">{primaryClient?.name ?? 'Internal'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--muted)]">Rate</span>
                    <span className="tabular">{emp.payType === 'hourly' ? `${money(rate)}/hr` : `${money(emp.salaryAnnual ?? 0)}/yr`}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--muted)]">This week</span>
                    <span className="tabular">{hoursThisWeek ? `${hoursThisWeek}h` : '—'}</span>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <EmptyState
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /></svg>}
          title={search ? 'No employees match your search' : !showArchived && archivedCount > 0 ? 'No active employees' : 'No employees yet'}
          subtitle={search ? 'Try a different name, title, or client.' : !showArchived && archivedCount > 0 ? 'Check "Show archived" to see former employees.' : 'Add your first employee to get started.'}
        />
      )}

      {showNew && (
        <NewEmployeeModal
          onClose={() => setShowNew(false)}
          companyId={data.currentCompanyId!}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Employee['status'] }) {
  const tone = status === 'active' ? 'good' : status === 'onboarding' ? 'pending' : status === 'terminated' ? 'bad' : 'neutral';
  return <Badge tone={tone as any}>{status}</Badge>;
}

function NewEmployeeModal({ onClose, companyId }: { onClose: () => void; companyId: string }) {
  const { addEmployee, inviteUser } = useApp();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [title, setTitle] = useState('');
  const [payType, setPayType] = useState<'hourly' | 'salary'>('hourly');
  const [rate, setRate] = useState('50');
  const [state, setState] = useState('OR');
  const [sendInvite, setSendInvite] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!firstName || !lastName) return;
    setCreating(true);
    setError(null);
    const created = await addEmployee({
      companyId, firstName, lastName, email, title: title || 'Team Member',
      status: 'onboarding', payType, state: state as any, filingStatus: 'single',
      federalAllowancesExtraWithholding: 0, dependentsCredit: 0,
      defaultHourlyRate: payType === 'hourly' ? parseFloat(rate) || 0 : 0,
      salaryAnnual: payType === 'salary' ? parseFloat(rate) || 0 : undefined,
      hireDate: new Date().toISOString().slice(0, 10), rates: [], projectIds: [],
    } as any);
    if (!created) { setError('Could not create employee.'); setCreating(false); return; }

    if (sendInvite && email.trim()) {
      const res = await inviteUser({ type: 'employee', targetId: created.id, email: email.trim() });
      if (!res.success) {
        setError(`Employee created, but the invite failed to send: ${res.error}. You can invite them later from their profile.`);
        setCreating(false);
        return;
      }
    }
    setCreating(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-lg border border-[var(--border)] p-6 w-full max-w-md space-y-4">
        <h2 className="font-display text-xl">Add an employee</h2>
        <div className="grid grid-cols-2 gap-3">
          <input placeholder="First name" value={firstName} onChange={e => setFirstName(e.target.value)} className="focus-ring rounded-md border border-[var(--border)] px-3 py-2 text-sm" />
          <input placeholder="Last name" value={lastName} onChange={e => setLastName(e.target.value)} className="focus-ring rounded-md border border-[var(--border)] px-3 py-2 text-sm" />
        </div>
        <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="focus-ring w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm" />
        <input placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} className="focus-ring w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm" />
        <div className="grid grid-cols-3 gap-3">
          <select value={payType} onChange={e => setPayType(e.target.value as any)} className="focus-ring rounded-md border border-[var(--border)] px-3 py-2 text-sm">
            <option value="hourly">Hourly</option>
            <option value="salary">Salary</option>
          </select>
          <input placeholder={payType === 'hourly' ? 'Rate/hr' : 'Salary/yr'} value={rate} onChange={e => setRate(e.target.value)} className="focus-ring rounded-md border border-[var(--border)] px-3 py-2 text-sm" />
          <input placeholder="State (e.g. OR)" value={state} onChange={e => setState(e.target.value.toUpperCase())} maxLength={2} className="focus-ring rounded-md border border-[var(--border)] px-3 py-2 text-sm" />
        </div>
        <label className="flex items-center gap-2 text-sm text-[var(--ink-soft)]">
          <input type="checkbox" checked={sendInvite} onChange={e => setSendInvite(e.target.checked)} />
          Email them a login invite now (with W-4, I-9, and onboarding forms)
        </label>
        {error && <div className="rounded-lg bg-[var(--bad-soft)] border border-[var(--bad)]/20 px-3 py-2 text-sm text-[var(--bad)]">{error}</div>}
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={create} disabled={creating}>{creating ? 'Creating…' : 'Create employee'}</Button>
        </div>
      </div>
    </div>
  );
}
