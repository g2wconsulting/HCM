import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../lib/AppContext';
import { useAuth } from '../lib/AuthContext';
import { Badge, Button, Card, EmptyState, inputClass } from '../components/ui';
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
  const navigate = useNavigate();
  const isAdmin = profile?.role === 'admin';
  const [filter, setFilter] = useState<'all' | TimesheetStatus>('all');
  const [employeeFilter, setEmployeeFilter] = useState<string>('all');
  const [showNew, setShowNew] = useState(false);
  const [showExport, setShowExport] = useState(false);

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

  async function createTimesheet(employeeId: string, weekStartInput: string) {
    const monday = mondayOf(new Date(weekStartInput + 'T00:00:00'));
    const weekStart = isoDate(monday);
    const existing = data.timesheets.find(t => t.employeeId === employeeId && t.weekStartDate === weekStart);
    if (existing) { navigate(`/timesheets/${existing.id}`); setShowNew(false); return; }
    const end = new Date(monday); end.setDate(end.getDate() + 6);
    const created = await addTimesheet({
      companyId: data.currentCompanyId!, employeeId,
      weekStartDate: weekStart, weekEndDate: isoDate(end),
      entries: [], status: 'draft',
    } as any);
    setShowNew(false);
    if (created) navigate(`/timesheets/${created.id}`);
  }

  // Employees (non-admin) get a one-click shortcut for their own current week.
  function startMyWeek() {
    if (!profile?.employeeId) return;
    createTimesheet(profile.employeeId, isoDate(new Date()));
  }
  const myCurrentWeekExists = profile?.employeeId
    ? data.timesheets.some(t => t.employeeId === profile.employeeId && t.weekStartDate === isoDate(mondayOf(new Date())))
    : true;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl">Timesheets</h1>
          <p className="text-[var(--ink-soft)] mt-1">Weekly hours, submitted for biweekly payroll approval.</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && <Button variant="secondary" onClick={() => setShowExport(true)}>Export range to PDF</Button>}
          {isAdmin ? (
            <Button onClick={() => setShowNew(true)}>+ New timesheet</Button>
          ) : !myCurrentWeekExists && (
            <Button onClick={startMyWeek}>+ Start this week's timesheet</Button>
          )}
        </div>
      </div>

      {showNew && <NewTimesheetModal onClose={() => setShowNew(false)} onCreate={createTimesheet} />}
      {showExport && <ExportRangeModal onClose={() => setShowExport(false)} />}

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
                      CSV
                    </button>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link to={`/timesheets/${ts.id}`} className="focus-ring text-[var(--accent)] font-medium hover:underline">Open →</Link>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="p-0">
                <EmptyState
                  icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>}
                  title="No timesheets match these filters"
                  subtitle={isAdmin ? "Try a different status or employee, or create a new timesheet above." : "Try a different status, or start this week's timesheet above."}
                />
              </td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function NewTimesheetModal({ onClose, onCreate }: { onClose: () => void; onCreate: (employeeId: string, weekStart: string) => void }) {
  const { data } = useApp();
  const [employeeId, setEmployeeId] = useState(data.employees[0]?.id ?? '');
  const [weekStart, setWeekStart] = useState(isoDate(new Date()));

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl border border-[var(--border)] p-6 w-full max-w-sm space-y-4">
        <h2 className="font-display text-xl">New timesheet</h2>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-[var(--ink-soft)]">Employee</label>
          <select value={employeeId} onChange={e => setEmployeeId(e.target.value)} className={inputClass}>
            {data.employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-[var(--ink-soft)]">Any date in the week</label>
          <input type="date" value={weekStart} onChange={e => setWeekStart(e.target.value)} className={inputClass} />
          <span className="text-xs text-[var(--muted)]">We'll snap this to the Monday of that week.</span>
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onCreate(employeeId, weekStart)} disabled={!employeeId}>Create &amp; open</Button>
        </div>
      </div>
    </div>
  );
}

function ExportRangeModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { data } = useApp();
  const today = new Date();
  const fourWeeksAgo = new Date(today); fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
  const [employeeId, setEmployeeId] = useState(data.employees[0]?.id ?? '');
  const [start, setStart] = useState(isoDate(fourWeeksAgo));
  const [end, setEnd] = useState(isoDate(today));

  function go() {
    const params = new URLSearchParams({ employeeId, start, end });
    navigate(`/timesheets/export?${params.toString()}`);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl border border-[var(--border)] p-6 w-full max-w-sm space-y-4">
        <h2 className="font-display text-xl">Export timesheets to PDF</h2>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-[var(--ink-soft)]">Employee</label>
          <select value={employeeId} onChange={e => setEmployeeId(e.target.value)} className={inputClass}>
            {data.employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-[var(--ink-soft)]">From</label>
            <input type="date" value={start} onChange={e => setStart(e.target.value)} className={inputClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-[var(--ink-soft)]">To</label>
            <input type="date" value={end} onChange={e => setEnd(e.target.value)} className={inputClass} />
          </div>
        </div>
        <p className="text-xs text-[var(--muted)]">Covers every week that overlaps this range — one week or several.</p>
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={go} disabled={!employeeId}>Continue →</Button>
        </div>
      </div>
    </div>
  );
}
