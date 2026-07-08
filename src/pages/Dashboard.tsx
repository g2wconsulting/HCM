import { Link } from 'react-router-dom';
import { useApp } from '../lib/AppContext';
import { useAuth } from '../lib/AuthContext';
import { Badge, Card, SectionLabel, IconStat } from '../components/ui';
import { formatDate, money, exportTimesheetCsv } from '../lib/format';
import { PortalDashboard } from './PortalDashboard';
import { ClockWidget } from '../components/ClockWidget';

function mondayIso(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export function Dashboard() {
  const { data } = useApp();
  const { profile } = useAuth();
  const employees = data.employees;

  if (profile?.role === 'client') return <PortalDashboard />;

  if (profile?.role === 'employee') {
    const myEmployee = employees.find(e => e.id === profile.employeeId);
    const myTimesheets = data.timesheets.filter(t => t.employeeId === profile?.employeeId);
    const myDraftOrRejected = myTimesheets.filter(t => t.status === 'draft' || t.status === 'rejected');
    const myDocs = data.onboardingDocs.filter(d => d.employeeId === profile?.employeeId && d.required && d.status !== 'signed' && d.status !== 'waived');
    const thisWeekStart = mondayIso(new Date());
    const currentWeekTimesheet = myTimesheets.find(t => t.weekStartDate === thisWeekStart);
    return (
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-3xl">Welcome back.</h1>
          <p className="text-[var(--ink-soft)] mt-1">Here's what needs your attention.</p>
        </div>
        {myEmployee && (
          <Card>
            <SectionLabel>Clock</SectionLabel>
            <ClockWidget employee={myEmployee} timesheet={currentWeekTimesheet} />
          </Card>
        )}
        <div className="grid grid-cols-2 gap-4">
          <IconStat icon={<ClockGlyph />} tone="pending" label="Timesheets needing action" value={String(myDraftOrRejected.length)} sub="draft or sent back" subTone={myDraftOrRejected.length ? 'pending' : undefined} />
          <IconStat icon={<DocGlyph />} tone="bad" label="Onboarding documents outstanding" value={String(myDocs.length)} sub="required, unsigned" subTone={myDocs.length ? 'bad' : undefined} />
        </div>
        <Card>
          <SectionLabel>Your timesheets</SectionLabel>
          {myTimesheets.length === 0 ? <EmptyRow text="No timesheets yet." /> : (
            <ul className="divide-y divide-[var(--border-soft)]">
              {myTimesheets.slice(0, 5).map(ts => (
                <li key={ts.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">Week of {formatDate(ts.weekStartDate)}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone={ts.status === 'approved' || ts.status === 'paid' ? 'good' : ts.status === 'rejected' ? 'bad' : ts.status === 'submitted' ? 'pending' : 'neutral'}>{ts.status}</Badge>
                    <Link to={`/timesheets/${ts.id}`} className="focus-ring text-sm font-medium text-[var(--accent)] hover:underline">Open →</Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    );
  }

  const activeCount = employees.filter(e => e.status === 'active').length;
  const onboardingCount = employees.filter(e => e.status === 'onboarding').length;
  const pendingApproval = data.timesheets.filter(t => t.status === 'submitted');
  const lastRun = [...data.payrollRuns].sort((a, b) => b.periodEnd.localeCompare(a.periodEnd))[0];
  const outstandingDocs = data.onboardingDocs.filter(d => d.required && d.status !== 'signed' && d.status !== 'waived');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl">Good to see you.</h1>
        <p className="text-[var(--ink-soft)] mt-1">Here's where payroll stands this period.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <IconStat icon={<PeopleGlyph />} tone="accent" label="Active employees" value={String(activeCount)} sub={onboardingCount ? `${onboardingCount} onboarding` : 'All set'} subTone={onboardingCount ? 'pending' : 'good'} />
        <IconStat icon={<ClockGlyph />} tone="pending" label="Timesheets to approve" value={String(pendingApproval.length)} sub="awaiting manager sign-off" subTone={pendingApproval.length ? 'pending' : 'good'} />
        <IconStat icon={<DocGlyph />} tone="bad" label="Outstanding onboarding docs" value={String(outstandingDocs.length)} sub="required, unsigned" subTone={outstandingDocs.length ? 'bad' : 'good'} />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <SectionLabel>Needs your approval</SectionLabel>
          {pendingApproval.length === 0 ? (
            <EmptyRow text="Nothing waiting on you right now." />
          ) : (
            <ul className="divide-y divide-[var(--border-soft)]">
              {pendingApproval.map(ts => {
                const emp = employees.find(e => e.id === ts.employeeId);
                return (
                  <li key={ts.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">{emp?.firstName} {emp?.lastName}</div>
                      <div className="text-xs text-[var(--muted)]">Week of {formatDate(ts.weekStartDate)}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => emp && exportTimesheetCsv({ timesheet: ts, employeeName: `${emp.firstName} ${emp.lastName}`, employeeLastName: emp.lastName, projects: data.projects })}
                        className="focus-ring text-sm font-medium text-[var(--ink-soft)] hover:text-[var(--ink)]"
                      >
                        Export
                      </button>
                      <Link to={`/timesheets/${ts.id}`} className="focus-ring text-sm font-medium text-[var(--accent)] hover:underline">Review →</Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <SectionLabel>Onboarding in progress</SectionLabel>
          {employees.filter(e => e.status === 'onboarding').length === 0 ? (
            <EmptyRow text="No one is currently onboarding." />
          ) : (
            <ul className="divide-y divide-[var(--border-soft)]">
              {employees.filter(e => e.status === 'onboarding').map(emp => {
                const docs = data.onboardingDocs.filter(d => d.employeeId === emp.id);
                const done = docs.filter(d => d.status === 'signed' || d.status === 'waived').length;
                return (
                  <li key={emp.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">{emp.firstName} {emp.lastName}</div>
                      <div className="text-xs text-[var(--muted)]">{emp.title} · hired {formatDate(emp.hireDate)}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs tabular text-[var(--muted)]">{done}/{docs.length} docs</span>
                      <Link to={`/employees/${emp.id}`} className="focus-ring text-sm font-medium text-[var(--accent)] hover:underline">Open →</Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between mb-1">
          <SectionLabel>Most recent payroll run</SectionLabel>
          <Link to="/payroll" className="focus-ring text-sm font-medium text-[var(--accent)] hover:underline">View all →</Link>
        </div>
        {!lastRun ? (
          <EmptyRow text="No payroll has been run yet. Approve timesheets, then start a run from the Payroll tab." />
        ) : (
          <div className="flex items-center justify-between pt-2">
            <div>
              <div className="font-medium">{formatDate(lastRun.periodStart)} – {formatDate(lastRun.periodEnd)}</div>
              <div className="text-xs text-[var(--muted)] mt-0.5">Pay date {formatDate(lastRun.payDate)}</div>
            </div>
            <div className="flex items-center gap-6">
              <Metric label="Employees" value={String(lastRun.lineItems.length)} />
              <Metric label="Gross" value={money(lastRun.lineItems.reduce((s, l) => s + l.grossPay, 0))} />
              <Metric label="Net" value={money(lastRun.lineItems.reduce((s, l) => s + l.netPay, 0))} />
              <Badge tone={lastRun.status === 'finalized' ? 'good' : 'pending'}>{lastRun.status}</Badge>
              <Link to={`/payroll/${lastRun.id}`} className="focus-ring text-sm font-medium text-[var(--accent)] hover:underline">Open →</Link>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function glyphProps() {
  return { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
}
function PeopleGlyph() { return <svg {...glyphProps()}><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><circle cx="17.5" cy="9" r="2.3" /><path d="M15.8 14.3c2.4.3 4.2 2.4 4.2 5" /></svg>; }
function ClockGlyph() { return <svg {...glyphProps()}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>; }
function DocGlyph() { return <svg {...glyphProps()}><rect x="5" y="3" width="14" height="18" rx="1.5" /><path d="M8.5 8h7M8.5 12h7M8.5 16h4" /></svg>; }

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <div className="text-xs text-[var(--muted)]">{label}</div>
      <div className="font-medium tabular">{value}</div>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="text-sm text-[var(--muted)] py-4">{text}</p>;
}
