import { Link } from 'react-router-dom';
import { useApp } from '../lib/AppContext';
import { useAuth } from '../lib/AuthContext';
import { Badge, Card, SectionLabel, IconStat } from '../components/ui';
import { formatDate, money } from '../lib/format';
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

  const now = new Date();
  const thisMonthRuns = data.payrollRuns.filter(r => {
    const d = new Date(r.payDate + 'T00:00:00');
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const thisMonthGross = thisMonthRuns.reduce((s, r) => s + r.lineItems.reduce((s2, l) => s2 + l.grossPay, 0), 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl">Good to see you.</h1>
        <p className="text-[var(--ink-soft)] mt-1">Here's where payroll stands this period.</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <IconStat iconPosition="right" icon={<PeopleGlyph />} tone="accent" label="Active employees" value={String(activeCount)} sub={onboardingCount ? `${onboardingCount} onboarding` : 'All set'} subTone={onboardingCount ? 'pending' : 'good'} />
        <IconStat iconPosition="right" icon={<ClockGlyph />} tone="pending" label="Timesheets to approve" value={String(pendingApproval.length)} sub="awaiting sign-off" subTone={pendingApproval.length ? 'pending' : 'good'} />
        <IconStat iconPosition="right" icon={<DocGlyph />} tone="bad" label="Outstanding docs" value={String(outstandingDocs.length)} sub="required, unsigned" subTone={outstandingDocs.length ? 'bad' : 'good'} />
        <IconStat iconPosition="right" icon={<DollarGlyph />} tone="secondary" label="This month's payroll" value={money(thisMonthGross)} sub={thisMonthRuns.length ? `${thisMonthRuns.length} run${thisMonthRuns.length > 1 ? 's' : ''}` : 'No runs yet'} />
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
                const hrs = ts.entries.reduce((s, e) => s + e.hours, 0);
                return (
                  <li key={ts.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">{emp?.firstName} {emp?.lastName}</div>
                      <div className="text-xs text-[var(--muted)]">Week of {formatDate(ts.weekStartDate)}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm tabular text-[var(--ink-soft)]">{hrs}h</span>
                      <Badge tone="pending">pending</Badge>
                      <Link to={`/timesheets/${ts.id}`} className="focus-ring text-sm font-medium text-[var(--accent)] hover:underline">Review →</Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <SectionLabel>Onboarding</SectionLabel>
          {employees.filter(e => e.status === 'onboarding').length === 0 ? (
            <EmptyRow text="No one is currently onboarding." />
          ) : (
            <ul className="divide-y divide-[var(--border-soft)]">
              {employees.filter(e => e.status === 'onboarding').map(emp => {
                const docs = data.onboardingDocs.filter(d => d.employeeId === emp.id && d.required);
                const done = docs.filter(d => d.status === 'signed' || d.status === 'waived').length;
                const pct = docs.length ? Math.round((done / docs.length) * 100) : 0;
                const nextPending = docs.find(d => d.status !== 'signed' && d.status !== 'waived');
                return (
                  <li key={emp.id} className="py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div>
                        <div className="font-medium text-sm">{emp.firstName} {emp.lastName}</div>
                        <div className="text-xs text-[var(--muted)]">{emp.title}</div>
                      </div>
                      <Link to={`/employees/${emp.id}`} className="focus-ring text-sm font-medium text-[var(--accent)] hover:underline">Open →</Link>
                    </div>
                    <div className="h-1.5 rounded-full bg-[var(--border-soft)] overflow-hidden">
                      <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-[var(--muted)]">{nextPending ? `Pending: ${nextPending.name}` : 'All documents signed'}</span>
                      <span className="text-xs tabular text-[var(--muted)]">{pct}% complete</span>
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
          <div>
            <div className="flex items-center justify-between pt-2 mb-4">
              <div>
                <div className="font-medium">{formatDate(lastRun.periodStart)} – {formatDate(lastRun.periodEnd)}</div>
                <div className="text-xs text-[var(--muted)] mt-0.5">Pay date {formatDate(lastRun.payDate)}</div>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={lastRun.status === 'finalized' ? 'good' : 'pending'}>{lastRun.status}</Badge>
                <Link to={`/payroll/${lastRun.id}`} className="focus-ring text-sm font-medium text-[var(--accent)] hover:underline">Open →</Link>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4 pt-4 border-t border-[var(--border-soft)]">
              <Metric label="Employees paid" value={String(lastRun.lineItems.length)} />
              <Metric label="Total hours" value={lastRun.lineItems.reduce((s, l) => s + l.regularHours + l.overtimeHours, 0).toFixed(1)} />
              <Metric label="Gross payroll" value={money(lastRun.lineItems.reduce((s, l) => s + l.grossPay, 0))} />
              <Metric label="Net paid" value={money(lastRun.lineItems.reduce((s, l) => s + l.netPay, 0))} />
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
function DollarGlyph() { return <svg {...glyphProps()}><path d="M12 2v20M17 6.5c0-2-2-3-5-3s-5 1.3-5 3.2c0 4 10 2 10 6.5 0 2-2 3.3-5 3.3s-5-1.2-5-3.3" /></svg>; }

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold tracking-wide uppercase text-[var(--muted)]">{label}</div>
      <div className="font-medium tabular mt-0.5">{value}</div>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="text-sm text-[var(--muted)] py-4">{text}</p>;
}
