import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../lib/AppContext';
import { useAuth } from '../lib/AuthContext';
import { Badge, Button, Card } from '../components/ui';
import { formatDate, hours as fmtHours, exportTimesheetCsv } from '../lib/format';
import type { TimesheetStatus } from '../lib/types';

const STATUS_TONE: Record<TimesheetStatus, 'good' | 'bad' | 'pending' | 'neutral'> = {
  draft: 'neutral', submitted: 'pending', approved: 'good', rejected: 'bad', paid: 'neutral',
};

function mondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
function isoDate(d: Date) { return d.toISOString().slice(0, 10); }

export function Timesheets() {
  const { data, addTimesheet } = useApp();
  const { profile } = useAuth();
  const [filter, setFilter] = useState<'all' | TimesheetStatus>('all');
  const [employeeFilter, setEmployeeFilter] = useState<string>('all');

  const visibleTimesheets = useMemo(() => {
    if (profile?.role === 'employee') return data.timesheets.filter(t => t.employeeId === profile.employeeId);
    return data.timesheets;
  }, [data.timesheets, profile]);

  const rows = useMemo(() => {
    return visibleTimesheets
      .filter(t => filter === 'all' || t.status === filter)
      .filter(t => employeeFilter === 'all' || t.employeeId === employeeFilter)
      .sort((a, b) => b.weekStartDate.localeCompare(a.weekStartDate));
  }, [visibleTimesheets, filter, employeeFilter]);

  function startNewWeek(employeeId: string) {
    const thisMonday = mondayOf(new Date());
    const weekStart = isoDate(thisMonday);
    const existing = data.timesheets.find(t => t.employeeId === employeeId && t.weekStartDate === weekStart);
    if (existing) return;
    const end = new Date(thisMonday); end.setDate(end.getDate() + 6);
    addTimesheet({
      companyId: data.currentCompanyId!, employeeId,
      weekStartDate: weekStart, weekEndDate: isoDate(end),
      entries: [], status: 'draft',
    } as any);
  }

  const selectableEmployees = profile?.role === 'employee'
    ? data.employees.filter(e => e.id === profile.employeeId)
    : data.employees;

  const employeesWithoutCurrentWeek = selectableEmployees.filter(e => e.status === 'active' &&
    !data.timesheets.some(t => t.employeeId === e.id && t.weekStartDate === isoDate(mondayOf(new Date()))));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl">Timesheets</h1>
          <p className="text-[var(--ink-soft)] mt-1">Weekly hours, submitted for biweekly payroll approval.</p>
        </div>
        {employeesWithoutCurrentWeek.length > 0 && (
          <Button onClick={() => startNewWeek(employeesWithoutCurrentWeek[0].id)}>
            + Start this week's timesheet
          </Button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <select value={filter} onChange={e => setFilter(e.target.value as any)} className="focus-ring rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-sm">
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="submitted">Submitted</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="paid">Paid</option>
        </select>
        <select value={employeeFilter} onChange={e => setEmployeeFilter(e.target.value)} className="focus-ring rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-sm">
          <option value="all">All employees</option>
          {data.employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
        </select>
      </div>

      <Card className="!p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-[var(--muted)] border-b border-[var(--border)]">
              <th className="px-5 py-3 font-semibold">Employee</th>
              <th className="px-5 py-3 font-semibold">Week</th>
              <th className="px-5 py-3 font-semibold text-right">Hours</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3"></th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(ts => {
              const emp = data.employees.find(e => e.id === ts.employeeId);
              const total = ts.entries.reduce((s, e) => s + e.hours, 0);
              return (
                <tr key={ts.id} className="border-b border-[var(--border-soft)] last:border-0 hover:bg-[var(--paper)]/60">
                  <td className="px-5 py-3 font-medium">{emp?.firstName} {emp?.lastName}</td>
                  <td className="px-5 py-3 text-[var(--ink-soft)]">{formatDate(ts.weekStartDate)} – {formatDate(ts.weekEndDate)}</td>
                  <td className="px-5 py-3 text-right tabular">{fmtHours(total)}</td>
                  <td className="px-5 py-3"><Badge tone={STATUS_TONE[ts.status]}>{ts.status}</Badge></td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => emp && exportTimesheetCsv({ timesheet: ts, employeeName: `${emp.firstName} ${emp.lastName}`, employeeLastName: emp.lastName, projects: data.projects })}
                      className="focus-ring text-[var(--ink-soft)] hover:text-[var(--ink)] text-sm font-medium"
                      title="Export this timesheet as CSV"
                    >
                      Export
                    </button>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link to={`/timesheets/${ts.id}`} className="focus-ring text-[var(--accent)] font-medium hover:underline">Open →</Link>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-10 text-center text-[var(--muted)]">No timesheets match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
