import { Link } from 'react-router-dom';
import { useApp } from '../lib/AppContext';
import { Badge, Card } from '../components/ui';
import { formatDate, hours as fmtHours, exportTimesheetCsv } from '../lib/format';

export function PortalTimesheets() {
  const { data } = useApp();
  const myProjectIds = new Set(data.projects.map(p => p.id));
  const relevant = data.timesheets
    .filter(t => t.entries.some(e => e.projectId && myProjectIds.has(e.projectId)))
    .sort((a, b) => b.weekStartDate.localeCompare(a.weekStartDate));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Timesheets</h1>
        <p className="text-[var(--ink-soft)] mt-1">Hours logged against your projects.</p>
      </div>

      <Card className="!p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-[var(--muted)] border-b border-[var(--border)]">
              <th className="px-5 py-3 font-semibold">Employee</th>
              <th className="px-5 py-3 font-semibold">Week</th>
              <th className="px-5 py-3 font-semibold text-right">Hours</th>
              <th className="px-5 py-3 font-semibold">Internal status</th>
              <th className="px-5 py-3 font-semibold">Your approval</th>
              <th className="px-5 py-3"></th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {relevant.map(ts => {
              const emp = data.employees.find(e => e.id === ts.employeeId);
              const total = ts.entries.reduce((s, e) => s + e.hours, 0);
              return (
                <tr key={ts.id} className="border-b border-[var(--border-soft)] last:border-0 hover:bg-[var(--paper)]/60">
                  <td className="px-5 py-3 font-medium">{emp?.firstName} {emp?.lastName}</td>
                  <td className="px-5 py-3 text-[var(--ink-soft)]">{formatDate(ts.weekStartDate)} – {formatDate(ts.weekEndDate)}</td>
                  <td className="px-5 py-3 text-right tabular">{fmtHours(total)}</td>
                  <td className="px-5 py-3"><Badge tone={ts.status === 'approved' || ts.status === 'paid' ? 'good' : ts.status === 'submitted' ? 'pending' : 'neutral'}>{ts.status}</Badge></td>
                  <td className="px-5 py-3">
                    <Badge tone={ts.clientApprovedAt ? 'good' : 'pending'}>{ts.clientApprovedAt ? 'approved' : 'pending'}</Badge>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => emp && exportTimesheetCsv({ timesheet: ts, employeeName: `${emp.firstName} ${emp.lastName}`, employeeLastName: emp.lastName, projects: data.projects })}
                      className="focus-ring text-[var(--ink-soft)] hover:text-[var(--ink)] text-sm font-medium"
                    >
                      Export
                    </button>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link to={`/portal/timesheets/${ts.id}`} className="focus-ring text-[var(--accent)] font-medium hover:underline">Open →</Link>
                  </td>
                </tr>
              );
            })}
            {relevant.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-[var(--muted)]">No timesheets yet.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
