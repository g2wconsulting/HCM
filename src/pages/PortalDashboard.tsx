import { Link } from 'react-router-dom';
import { useApp } from '../lib/AppContext';
import { Badge, Card, SectionLabel } from '../components/ui';
import { formatDate } from '../lib/format';

export function PortalDashboard() {
  const { data } = useApp();
  const myProjectIds = new Set(data.projects.map(p => p.id));
  const myEmployees = data.employees.filter(e => e.projectIds.some(id => myProjectIds.has(id)));
  const pendingApproval = data.timesheets.filter(t =>
    t.status === 'approved' && !t.clientApprovedAt &&
    t.entries.some(e => e.projectId && myProjectIds.has(e.projectId))
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl">Welcome back.</h1>
        <p className="text-[var(--ink-soft)] mt-1">Your placed employees and their timesheets.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <div className="text-xs font-semibold tracking-wide uppercase text-[var(--muted)]">Your team</div>
          <div className="font-display text-3xl mt-1 tabular">{myEmployees.length}</div>
          <div className="text-xs mt-1 text-[var(--muted)]">people placed with you</div>
        </Card>
        <Card>
          <div className="text-xs font-semibold tracking-wide uppercase text-[var(--muted)]">Timesheets to review</div>
          <div className="font-display text-3xl mt-1 tabular">{pendingApproval.length}</div>
          <div className="text-xs mt-1 text-[var(--pending)]">{pendingApproval.length ? 'awaiting your approval' : 'all caught up'}</div>
        </Card>
      </div>

      <Card>
        <SectionLabel>Needs your approval</SectionLabel>
        {pendingApproval.length === 0 ? (
          <p className="text-sm text-[var(--muted)] py-4">Nothing waiting on you right now.</p>
        ) : (
          <ul className="divide-y divide-[var(--border-soft)]">
            {pendingApproval.map(ts => {
              const emp = data.employees.find(e => e.id === ts.employeeId);
              return (
                <li key={ts.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{emp?.firstName} {emp?.lastName}</div>
                    <div className="text-xs text-[var(--muted)]">Week of {formatDate(ts.weekStartDate)}</div>
                  </div>
                  <Link to={`/portal/timesheets/${ts.id}`} className="focus-ring text-sm font-medium text-[var(--accent)] hover:underline">Review →</Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <SectionLabel>Your team</SectionLabel>
        {myEmployees.length === 0 ? (
          <p className="text-sm text-[var(--muted)] py-4">No one has been placed with you yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--border-soft)]">
            {myEmployees.map(emp => (
              <li key={emp.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">{emp.firstName} {emp.lastName}</div>
                  <div className="text-xs text-[var(--muted)]">{emp.title}</div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={emp.status === 'active' ? 'good' : 'neutral'}>{emp.status}</Badge>
                  <Link to={`/portal/employees/${emp.id}`} className="focus-ring text-sm font-medium text-[var(--accent)] hover:underline">View →</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
