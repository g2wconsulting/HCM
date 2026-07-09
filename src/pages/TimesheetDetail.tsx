import { useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useApp } from '../lib/AppContext';
import { useAuth } from '../lib/AuthContext';
import { Badge, Button, Card, SectionLabel } from '../components/ui';
import { formatDate, formatDateShort, hours as fmtHours, downloadCsv } from '../lib/format';
import { SignaturePad, SignaturePreview } from '../components/SignaturePad';
import { ClockWidget } from '../components/ClockWidget';
import { uid } from '../lib/db';
import type { TimeEntry } from '../lib/types';

function daysOfWeek(weekStart: string): string[] {
  const start = new Date(weekStart + 'T00:00:00');
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start); d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

export function TimesheetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, updateTimesheet } = useApp();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const ts = data.timesheets.find(t => t.id === id);
  const [showSignEmployee, setShowSignEmployee] = useState(false);
  const [showSignApprover, setShowSignApprover] = useState(false);
  const [rejectionNote, setRejectionNote] = useState('');
  const [showReject, setShowReject] = useState(false);

  const employee = data.employees.find(e => e.id === ts?.employeeId);
  const days = useMemo(() => ts ? daysOfWeek(ts.weekStartDate) : [], [ts]);
  const projects = data.projects.filter(p => employee?.projectIds.includes(p.id));

  if (!ts || !employee) {
    return (
      <div>
        <p className="text-[var(--muted)]">Timesheet not found.</p>
        <Link to="/timesheets" className="text-[var(--accent)] underline">Back to timesheets</Link>
      </div>
    );
  }

  const entriesByDayProject = new Map<string, TimeEntry>();
  ts.entries.forEach(e => entriesByDayProject.set(`${e.date}__${e.projectId ?? 'none'}`, e));

  function getHours(date: string, projectId: string | null): number {
    const e = entriesByDayProject.get(`${date}__${projectId ?? 'none'}`);
    return e?.hours ?? 0;
  }

  function setHours(date: string, projectId: string | null, hoursVal: number) {
    const key = `${date}__${projectId ?? 'none'}`;
    const existing = entriesByDayProject.get(key);
    let nextEntries: TimeEntry[];
    if (existing) {
      nextEntries = ts!.entries.map(e => e.id === existing.id ? { ...e, hours: hoursVal } : e);
    } else {
      nextEntries = [...ts!.entries, { id: uid(), date, projectId, hours: hoursVal }];
    }
    nextEntries = nextEntries.filter(e => e.hours > 0);
    updateTimesheet(ts!.id, { entries: nextEntries });
  }

  const dailyTotals = days.map(d => ts.entries.filter(e => e.date === d).reduce((s, e) => s + e.hours, 0));
  const weekTotal = dailyTotals.reduce((s, h) => s + h, 0);
  const overtimeThreshold = data.companies[0].overtimeThresholdWeekly;
  const overtime = Math.max(0, weekTotal - overtimeThreshold);
  const regular = weekTotal - overtime;

  const editable = isAdmin ? ts.status !== 'paid' : (ts.status === 'draft' || ts.status === 'rejected');

  function submit() {
    if (weekTotal === 0) return;
    setShowSignEmployee(true);
  }

  function handleEmployeeSign(sig: any) {
    updateTimesheet(ts!.id, { status: 'submitted', submittedAt: new Date().toISOString(), employeeSignature: sig, rejectionReason: undefined });
    setShowSignEmployee(false);
  }

  function handleApproverSign(sig: any) {
    updateTimesheet(ts!.id, {
      status: 'approved', approvedAt: new Date().toISOString(), approverSignature: sig, approverName: sig.name,
    });
    setShowSignApprover(false);
  }

  function reject() {
    updateTimesheet(ts!.id, { status: 'rejected', rejectionReason: rejectionNote || 'Please review and resubmit.' });
    setShowReject(false);
    setRejectionNote('');
  }

  function exportCsv() {
    const rows: (string | number)[][] = [
      ['Employee', `${employee!.firstName} ${employee!.lastName}`],
      ['Week', `${formatDate(ts!.weekStartDate)} - ${formatDate(ts!.weekEndDate)}`],
      ['Status', ts!.status],
      [],
      ['Date', 'Project', 'Hours'],
    ];
    ts!.entries.forEach(e => {
      const proj = data.projects.find(p => p.id === e.projectId);
      rows.push([formatDate(e.date), proj?.name ?? 'Unassigned', e.hours]);
    });
    rows.push([]);
    rows.push(['Total hours', '', weekTotal]);
    rows.push(['Regular', '', regular]);
    rows.push(['Overtime', '', overtime]);
    downloadCsv(`timesheet-${employee!.lastName}-${ts!.weekStartDate}.csv`, rows);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/timesheets" className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">← Timesheets</Link>
          <h1 className="font-display text-3xl mt-1">{employee.firstName} {employee.lastName}</h1>
          <p className="text-[var(--ink-soft)] mt-1">Week of {formatDate(ts.weekStartDate)} – {formatDate(ts.weekEndDate)}</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={ts.status} />
          {isAdmin && ts.status !== 'paid' && (
            <select
              value={ts.status}
              onChange={e => updateTimesheet(ts.id, { status: e.target.value as any })}
              className="focus-ring rounded-md border border-[var(--border)] bg-white px-2 py-1.5 text-xs"
              title="Admin override: set status directly"
            >
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="paid">Paid</option>
            </select>
          )}
          <Button variant="secondary" onClick={exportCsv}>Export CSV</Button>
        </div>
      </div>

      {ts.status === 'rejected' && ts.rejectionReason && (
        <div className="rounded-md border border-[var(--bad)]/30 bg-[var(--bad-soft)] px-4 py-3 text-sm text-[var(--bad)]">
          <strong>Sent back for changes:</strong> {ts.rejectionReason}
        </div>
      )}

      {editable && !isAdmin && (
        <Card>
          <SectionLabel>Clock</SectionLabel>
          <ClockWidget employee={employee} timesheet={ts} />
          {ts.clockSessions.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[var(--border-soft)] space-y-1">
              {ts.clockSessions.map(s => {
                const proj = data.projects.find(p => p.id === s.projectId);
                return (
                  <div key={s.id} className="text-xs text-[var(--muted)] flex justify-between">
                    <span>{proj?.name ?? 'Unassigned'} · {formatDate(s.date)}</span>
                    <span className="tabular">{fmtHours(s.hours)} hrs</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      <Card className="!p-0 overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="border-b border-[var(--border)] text-xs uppercase tracking-wide text-[var(--muted)]">
              <th className="px-4 py-3 text-left font-semibold">Project</th>
              {days.map(d => <th key={d} className="px-3 py-3 text-center font-semibold">{formatDateShort(d)}</th>)}
              <th className="px-4 py-3 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {projects.map(p => {
              const rowTotal = days.reduce((s, d) => s + getHours(d, p.id), 0);
              return (
                <tr key={p.id} className="border-b border-[var(--border-soft)]">
                  <td className="px-4 py-2.5 font-medium">{p.name}</td>
                  {days.map(d => (
                    <td key={d} className="px-2 py-2 text-center">
                      <input
                        type="number" min={0} max={24} step={0.25}
                        disabled={!editable}
                        value={getHours(d, p.id) || ''}
                        onChange={e => setHours(d, p.id, parseFloat(e.target.value) || 0)}
                        placeholder="–"
                        className="focus-ring w-14 text-center tabular rounded border border-transparent hover:border-[var(--border)] disabled:bg-transparent bg-white px-1 py-1 text-sm"
                      />
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-right tabular font-medium">{fmtHours(rowTotal)}</td>
                </tr>
              );
            })}
            <tr className="bg-[var(--paper)]">
              <td className="px-4 py-2.5 font-semibold">Daily total</td>
              {dailyTotals.map((h, i) => (
                <td key={i} className="px-3 py-2.5 text-center tabular font-semibold">{h > 0 ? fmtHours(h) : '–'}</td>
              ))}
              <td className="px-4 py-2.5 text-right tabular font-semibold">{fmtHours(weekTotal)}</td>
            </tr>
          </tbody>
        </table>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        <Card><SectionLabel>Regular hours</SectionLabel><div className="font-display text-2xl tabular">{fmtHours(regular)}</div></Card>
        <Card><SectionLabel>Overtime hours</SectionLabel><div className="font-display text-2xl tabular text-[var(--pending)]">{fmtHours(overtime)}</div><div className="text-xs text-[var(--muted)] mt-1">over {overtimeThreshold}h/week</div></Card>
        <Card><SectionLabel>Total this week</SectionLabel><div className="font-display text-2xl tabular">{fmtHours(weekTotal)}</div></Card>
      </div>

      <Card>
        <SectionLabel>Signatures</SectionLabel>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="text-xs text-[var(--muted)] mb-2">Employee certification</div>
            {ts.employeeSignature ? <SignaturePreview sig={ts.employeeSignature} /> : <span className="text-sm text-[var(--muted)]">Not yet signed</span>}
          </div>
          <div>
            <div className="text-xs text-[var(--muted)] mb-2">Manager approval</div>
            {ts.approverSignature ? <SignaturePreview sig={ts.approverSignature} /> : <span className="text-sm text-[var(--muted)]">Not yet signed</span>}
          </div>
        </div>
      </Card>

      {showSignEmployee && (
        <SignaturePad defaultName={`${employee.firstName} ${employee.lastName}`} onSign={handleEmployeeSign} onCancel={() => setShowSignEmployee(false)} />
      )}
      {showSignApprover && isAdmin && (
        <SignaturePad defaultName="" onSign={handleApproverSign} onCancel={() => setShowSignApprover(false)} />
      )}
      {showReject && isAdmin && (
        <Card>
          <SectionLabel>Reason for sending back</SectionLabel>
          <textarea value={rejectionNote} onChange={e => setRejectionNote(e.target.value)} rows={3}
            className="focus-ring w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm" placeholder="e.g. Wednesday hours look off — please double-check." />
          <div className="flex gap-2 mt-3">
            <Button variant="danger" onClick={reject}>Send back to employee</Button>
            <Button variant="ghost" onClick={() => setShowReject(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      <div className="flex gap-3">
        {editable && (
          <Button onClick={submit} disabled={weekTotal === 0}>Sign &amp; submit for approval</Button>
        )}
        {ts.status === 'submitted' && isAdmin && !showSignApprover && (
          <>
            <Button onClick={() => setShowSignApprover(true)}>Approve &amp; sign</Button>
            <Button variant="secondary" onClick={() => setShowReject(true)}>Send back</Button>
          </>
        )}
        {ts.status === 'approved' && isAdmin && (
          <Button variant="secondary" onClick={() => navigate('/payroll')}>Go run payroll →</Button>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone = status === 'approved' || status === 'paid' ? 'good' : status === 'rejected' ? 'bad' : status === 'submitted' ? 'pending' : 'neutral';
  return <Badge tone={tone as any}>{status}</Badge>;
}
