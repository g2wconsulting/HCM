import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../lib/AppContext';
import { Badge, Button, Card } from '../components/ui';
import { initials, money } from '../lib/format';
import type { Employee } from '../lib/types';

export function Employees() {
  const { data, addEmployee } = useApp();
  const [showNew, setShowNew] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl">Employees</h1>
          <p className="text-[var(--ink-soft)] mt-1">Profiles, onboarding, projects, and pay rates.</p>
        </div>
        <Button onClick={() => setShowNew(true)}>+ Add employee</Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {data.employees.map(emp => {
          const docs = data.onboardingDocs.filter(d => d.employeeId === emp.id && d.required);
          const docsDone = docs.filter(d => d.status === 'signed' || d.status === 'waived').length;
          return (
            <Link key={emp.id} to={`/employees/${emp.id}`}>
              <Card className="hover:shadow-sm transition-shadow h-full">
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
                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="text-[var(--muted)]">{emp.payType === 'hourly' ? `${money(emp.defaultHourlyRate)}/hr` : `${money(emp.salaryAnnual ?? 0)}/yr`}</span>
                  <span className="text-xs tabular text-[var(--muted)]">{docsDone}/{docs.length} docs</span>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      {showNew && (
        <NewEmployeeModal
          onClose={() => setShowNew(false)}
          onCreate={(e) => { addEmployee(e); setShowNew(false); }}
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

function NewEmployeeModal({ onClose, onCreate, companyId }: { onClose: () => void; onCreate: (e: Omit<Employee, 'id' | 'createdAt'>) => void; companyId: string }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [title, setTitle] = useState('');
  const [payType, setPayType] = useState<'hourly' | 'salary'>('hourly');
  const [rate, setRate] = useState('50');
  const [state, setState] = useState('OR');

  function create() {
    if (!firstName || !lastName) return;
    onCreate({
      companyId, firstName, lastName, email, title: title || 'Team Member',
      status: 'onboarding', payType, state: state as any, filingStatus: 'single',
      federalAllowancesExtraWithholding: 0, dependentsCredit: 0,
      defaultHourlyRate: payType === 'hourly' ? parseFloat(rate) || 0 : 0,
      salaryAnnual: payType === 'salary' ? parseFloat(rate) || 0 : undefined,
      hireDate: new Date().toISOString().slice(0, 10), rates: [], projectIds: [],
    } as any);
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
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={create}>Create employee</Button>
        </div>
      </div>
    </div>
  );
}
