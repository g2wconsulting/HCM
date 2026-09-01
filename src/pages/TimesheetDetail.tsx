import { useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useApp } from '../lib/AppContext';
import { useAuth } from '../lib/AuthContext';
import { Badge, Button, Card, SectionLabel, inputClass } from '../components/ui';
import { formatDate, formatDateShort, hours as fmtHours, downloadCsv, initials, money } from '../lib/format';
import { SignaturePad, SignaturePreview } from '../components/SignaturePad';
import { ClockWidget } from '../components/ClockWidget';
import { supabase } from '../lib/supabaseClient';
import { uid } from '../lib/db';
import { buildTimecardPdf, timecardPdfFileName } from '../lib/pdfExport';
import { formatTimeLabel, buildJobCodeSummary } from '../lib/timesheetParser';
import { STATUS_TONE, STATUS_LABEL, TimecardRowActions } from './Timesheets';
import type { TimeEntry, Timesheet, Employee } from '../lib/types';

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

  if ((ts.dailyEntries?.length ?? 0) > 0) {
    return <TimecardDetailView ts={ts} employee={employee} isAdmin={isAdmin} />;
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

      {isAdmin && ts.status !== 'paid' && (
        <SendForApprovalCard employeeId={employee.id} currentTimesheet={ts} clientApprovedAt={ts.clientApprovedAt} />
      )}

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <SectionLabel>Employee signature</SectionLabel>
          {ts.employeeSignature ? (
            <SignaturePreview sig={ts.employeeSignature} />
          ) : showSignEmployee ? (
            <SignaturePad defaultName={`${employee.firstName} ${employee.lastName}`} onSign={handleEmployeeSign} onCancel={() => setShowSignEmployee(false)} />
          ) : editable ? (
            <button
              onClick={() => weekTotal > 0 && setShowSignEmployee(true)}
              disabled={weekTotal === 0}
              className="focus-ring w-full rounded-lg border-2 border-dashed border-[var(--border)] py-8 text-center text-sm text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Click to sign &amp; submit for approval
            </button>
          ) : (
            <span className="text-sm text-[var(--muted)]">Not yet signed</span>
          )}
        </Card>

        <Card>
          <SectionLabel>{isAdmin ? 'Review actions' : 'Approval status'}</SectionLabel>
          {isAdmin ? (
            <div className="flex flex-col gap-2">
              {showSignApprover ? (
                <SignaturePad defaultName="" onSign={handleApproverSign} onCancel={() => setShowSignApprover(false)} />
              ) : showReject ? (
                <div className="space-y-3">
                  <textarea value={rejectionNote} onChange={e => setRejectionNote(e.target.value)} rows={3}
                    className={inputClass} placeholder="e.g. Wednesday hours look off — please double-check." />
                  <div className="flex gap-2">
                    <Button variant="danger" onClick={reject}>Send back to employee</Button>
                    <Button variant="ghost" onClick={() => setShowReject(false)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <>
                  <Button
                    variant={ts.status === 'submitted' ? 'primary' : 'secondary'}
                    disabled={ts.status !== 'submitted'}
                    onClick={() => setShowSignApprover(true)}
                    fullWidth
                  >
                    ✓ Approve timesheet
                  </Button>
                  <Button variant="secondary" disabled={ts.status !== 'submitted'} onClick={() => setShowReject(true)} fullWidth>
                    Request changes
                  </Button>
                  <Button variant="danger" disabled={ts.status !== 'submitted'} onClick={() => setShowReject(true)} fullWidth>
                    Reject
                  </Button>
                  {ts.approverSignature && (
                    <div className="pt-2 mt-1 border-t border-[var(--border-soft)]">
                      <SignaturePreview sig={ts.approverSignature} />
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--muted)]">Internal approval</span>
                <Badge tone={ts.approverSignature ? 'good' : 'neutral'}>{ts.approverSignature ? 'approved' : 'pending'}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--muted)]">External signature</span>
                <Badge tone={ts.clientApprovedAt ? 'good' : 'neutral'}>{ts.clientApprovedAt ? 'signed' : 'not sent'}</Badge>
              </div>
            </div>
          )}
        </Card>
      </div>

      {ts.status === 'approved' && isAdmin && (
        <Button variant="secondary" onClick={() => navigate('/payroll')}>Go run payroll →</Button>
      )}
    </div>
  );
}

function SendForApprovalCard({
  employeeId, currentTimesheet, clientApprovedAt,
}: {
  employeeId: string; currentTimesheet: any; clientApprovedAt?: string;
}) {
  const { data, addSignatureRequest } = useApp();
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [rangeStart, setRangeStart] = useState(currentTimesheet.weekStartDate);
  const [rangeEnd, setRangeEnd] = useState(currentTimesheet.weekEndDate);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  function applyPreset(weeksBack: number) {
    const end = new Date(currentTimesheet.weekEndDate + 'T00:00:00');
    const start = new Date(currentTimesheet.weekStartDate + 'T00:00:00');
    start.setDate(start.getDate() - (weeksBack - 1) * 7);
    setRangeStart(start.toISOString().slice(0, 10));
    setRangeEnd(end.toISOString().slice(0, 10));
  }

  // Any timesheet whose week overlaps the chosen range counts — this
  // works regardless of how a given client's work week is defined,
  // since we're not assuming the range lines up to fixed week boundaries.
  const includedTimesheets = data.timesheets
    .filter((t: any) => t.employeeId === employeeId && t.weekEndDate >= rangeStart && t.weekStartDate <= rangeEnd)
    .sort((a: any, b: any) => a.weekStartDate.localeCompare(b.weekStartDate));
  const timesheetIds = includedTimesheets.map((t: any) => t.id);

  const pastRequests = data.signatureRequests.filter(r => r.timesheetIds.includes(currentTimesheet.id));
  const latest = pastRequests[pastRequests.length - 1];

  async function send() {
    if (!email.trim() || timesheetIds.length === 0) return;
    setSubmitting(true);
    setStatus(null);
    try {
      const created = await addSignatureRequest({
        employeeId, timesheetIds, rangeStart, rangeEnd,
        recipientName: name.trim() || email.trim(), recipientEmail: email.trim(),
      } as any);
      if (!created) { setStatus('Could not create the signature request — check the browser console for details.'); return; }

      const { error: fnErr } = await supabase.functions.invoke('send-signature-request', {
        body: { requestId: created.id, siteUrl: window.location.origin },
      });
      if (fnErr) {
        setStatus(`Saved, but the email failed to send: ${fnErr.message}. This usually means the send-signature-request Edge Function hasn't been deployed yet, or RESEND_API_KEY isn't set — see the README's "Sending timesheets out for external e-signature" section.`);
        return;
      }
      setStatus(`Sent to ${email.trim()}.`);
      setEmail(''); setName(''); setNote(''); setShowNote(false);
    } catch (err: any) {
      setStatus(`Something went wrong: ${err?.message ?? 'unknown error'}. This usually means the send-signature-request Edge Function hasn't been deployed yet — see the README's "Sending timesheets out for external e-signature" section.`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className="icon-chip bg-[var(--accent-soft)] text-[var(--accent-dark)] shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3h7v7M21 3 10 14M19 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6" /></svg>
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium">Send for external approval</div>
          <p className="text-sm text-[var(--muted)] mt-0.5">
            Send a secure signing link to a hiring manager — no Ledgerline account required. They sign with a real
            signature (drawn or uploaded) — no typed stand-in.
          </p>

          {clientApprovedAt ? (
            <div className="mt-3 flex items-center gap-2">
              <Badge tone="good">signed {formatDate(clientApprovedAt.slice(0, 10))}</Badge>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-[var(--muted)] shrink-0">Quick pick:</span>
                <button onClick={() => applyPreset(1)} className="focus-ring px-2.5 py-1 rounded-full text-xs font-medium border border-[var(--border)] text-[var(--ink-soft)] hover:bg-[var(--paper)]">This week</button>
                <button onClick={() => applyPreset(2)} className="focus-ring px-2.5 py-1 rounded-full text-xs font-medium border border-[var(--border)] text-[var(--ink-soft)] hover:bg-[var(--paper)]">2 weeks</button>
                <button onClick={() => applyPreset(3)} className="focus-ring px-2.5 py-1 rounded-full text-xs font-medium border border-[var(--border)] text-[var(--ink-soft)] hover:bg-[var(--paper)]">3 weeks</button>
                <button onClick={() => applyPreset(4)} className="focus-ring px-2.5 py-1 rounded-full text-xs font-medium border border-[var(--border)] text-[var(--ink-soft)] hover:bg-[var(--paper)]">4 weeks</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[var(--muted)]">From</label>
                  <input type="date" value={rangeStart} onChange={e => setRangeStart(e.target.value)} className={inputClass} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[var(--muted)]">To</label>
                  <input type="date" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)} className={inputClass} />
                </div>
              </div>
              <p className="text-xs text-[var(--muted)]">
                Covers any week overlapping this range — works whether this client's weeks run Mon–Sun or something
                else. <strong className="text-[var(--ink-soft)]">{timesheetIds.length} timesheet{timesheetIds.length !== 1 ? 's' : ''}</strong> matched.
              </p>
              <div className="flex gap-2">
                <input value={email} onChange={e => setEmail(e.target.value)} placeholder="hiringmanager@client.com" className={inputClass} />
                <Button onClick={send} disabled={submitting || !email.trim() || timesheetIds.length === 0}>
                  {submitting ? 'Sending…' : '↗ Send for approval'}
                </Button>
              </div>
              <button onClick={() => setShowNote(v => !v)} className="focus-ring text-xs text-[var(--muted)] hover:text-[var(--ink)]">
                {showNote ? '▾' : '▸'} Add a note to the recipient
              </button>
              {showNote && (
                <div className="space-y-2">
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="Recipient name (optional)" className={inputClass} />
                  <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Optional note…" className={inputClass} />
                </div>
              )}
              <p className="text-xs text-[var(--muted)]">
                Recipient gets a one-time secure link to review hours and sign — works like DocuSign, no account needed.
              </p>
            </div>
          )}
          {status && <p className="text-xs text-[var(--accent-dark)] mt-2">{status}</p>}
          {latest && !clientApprovedAt && (
            <p className="text-xs text-[var(--muted)] mt-2">Last sent to {latest.recipientEmail} · {latest.status}</p>
          )}
        </div>
      </div>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone = status === 'approved' || status === 'paid' ? 'good' : status === 'rejected' ? 'bad' : status === 'submitted' ? 'pending' : 'neutral';
  return <Badge tone={tone as any}>{status}</Badge>;
}

// Uploaded-timecard view — the G2W Consulting layout from the sample:
// header, employee block, regular hours, Daily Time Entries (same-day
// punches share one row with a dotted separator, date shown once),
// Job Code & Allocation Summary, and Employee Verification / Supervisor
// Approval blocks with signature + timestamp once signed.
function TimecardDetailView({ ts, employee, isAdmin }: { ts: Timesheet; employee: Employee; isAdmin: boolean }) {
  const { data, company, updateTimesheet } = useApp();
  const [supervisorName, setSupervisorName] = useState(ts.supervisorName ?? '');
  const [supervisorEmail, setSupervisorEmail] = useState(ts.supervisorEmail ?? '');
  const [savingSupervisor, setSavingSupervisor] = useState(false);

  const entries = (ts.dailyEntries ?? []).slice().sort((a, b) => a.date.localeCompare(b.date));
  // Positions (and their block pay) can only be reassigned before the
  // employee has signed — editing after either signature would silently
  // change what was already approved.
  const editablePositions = isAdmin && ts.status === 'draft';

  function setDayPosition(date: string, positionId: string) {
    const pos = data.positions.find(p => p.id === positionId);
    const dept = pos ? data.departments.find(d => d.id === pos.departmentId) : undefined;
    const dailyEntries = (ts.dailyEntries ?? []).map(d => d.date === date ? {
      ...d,
      positionId: pos?.id,
      jobCode: pos ? pos.jobCode : d.jobCode,
      positionTitle: pos ? pos.title : d.positionTitle,
      department: dept ? dept.name : d.department,
    } : d);
    updateTimesheet(ts.id, { dailyEntries, jobCodeSummary: buildJobCodeSummary(dailyEntries) });
  }

  function exportPdf() {
    const doc = buildTimecardPdf({ company, employee, timesheet: ts });
    doc.save(timecardPdfFileName(employee, ts.weekStartDate, ts.weekEndDate));
  }

  async function saveSupervisor() {
    setSavingSupervisor(true);
    await updateTimesheet(ts.id, { supervisorName: supervisorName.trim() || undefined, supervisorEmail: supervisorEmail.trim() || undefined });
    setSavingSupervisor(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link to="/timesheets" className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">← Timesheets</Link>
          <h1 className="font-display text-3xl mt-1">{employee.firstName} {employee.lastName}</h1>
          <p className="text-[var(--ink-soft)] mt-1">Pay period {formatDate(ts.weekStartDate)} – {formatDate(ts.weekEndDate)}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge tone={STATUS_TONE[ts.status]}>{STATUS_LABEL[ts.status] ?? ts.status}</Badge>
          {isAdmin && <TimecardRowActions ts={ts} employee={employee} />}
          <Button variant="secondary" onClick={exportPdf}>Export PDF</Button>
        </div>
      </div>

      <Card>
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-11 h-11 rounded-full bg-[var(--accent)] text-white flex items-center justify-center font-display text-sm shrink-0">
            {initials(employee.firstName, employee.lastName)}
          </div>
          <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-[var(--muted)]">Employee ID</div>
              <div className="font-medium mt-0.5">{ts.employeeNumberSnapshot || employee.employeeNumber || '—'}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-[var(--muted)]">Pay period</div>
              <div className="font-medium mt-0.5">{formatDate(ts.weekStartDate)} – {formatDate(ts.weekEndDate)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-[var(--muted)]">Regular hours</div>
              <div className="font-display text-xl tabular text-[var(--accent-dark)]">{fmtHours(ts.regularHours ?? 0)}</div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="!p-0 overflow-x-auto">
        <div className="px-5 pt-4"><SectionLabel>Daily time entries</SectionLabel></div>
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="border-b border-[var(--border)] text-xs uppercase tracking-wide text-[var(--muted)]">
              <th className="px-4 py-2.5 text-left font-semibold">Date &amp; day</th>
              <th className="px-3 py-2.5 text-left font-semibold">Status</th>
              <th className="px-3 py-2.5 text-left font-semibold">Time in / out</th>
              <th className="px-3 py-2.5 text-left font-semibold">Job code &amp; position</th>
              <th className="px-4 py-2.5 text-right font-semibold">Hours</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(d => (
              <tr key={d.date} className="border-b border-[var(--border-soft)] last:border-0 align-top">
                <td className="px-4 py-2.5 whitespace-nowrap">{d.dayOfWeek}<br /><span className="text-xs text-[var(--muted)]">{formatDate(d.date)}</span></td>
                <td className="px-3 py-2.5">{d.status}</td>
                <td className="px-3 py-2.5">
                  {d.punches.length === 0 ? <span className="text-[var(--muted)]">—</span> : d.punches.map((p, i) => (
                    <div key={i}>
                      {i > 0 && <div className="border-t border-dashed border-[var(--border)] my-1 w-28" />}
                      {formatTimeLabel(p.in)} – {formatTimeLabel(p.out)}
                    </div>
                  ))}
                </td>
                <td className="px-3 py-2.5">
                  {editablePositions && d.status === 'WORK' ? (
                    <select
                      value={d.positionId ?? ''}
                      onChange={e => setDayPosition(d.date, e.target.value)}
                      className="focus-ring rounded border border-[var(--border)] px-1.5 py-1 text-sm max-w-[220px]"
                    >
                      <option value="">{[d.jobCode, d.positionTitle].filter(Boolean).join(' · ') || '— pick position —'}</option>
                      {data.departments.map(dept => (
                        <optgroup key={dept.id} label={dept.name}>
                          {data.positions.filter(p => p.departmentId === dept.id && p.active).map(p => (
                            <option key={p.id} value={p.id}>{p.title}{p.blockPayAmount != null ? ` (${money(p.blockPayAmount)} block)` : ''}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  ) : (
                    d.status === 'WORK' ? [d.jobCode, d.positionTitle].filter(Boolean).join(' · ') || '—' : '—'
                  )}
                </td>
                <td className="px-4 py-2.5 text-right tabular">{fmtHours(d.hours)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {(ts.jobCodeSummary?.length ?? 0) > 0 && (
        <Card className="!p-0 overflow-x-auto">
          <div className="px-5 pt-4"><SectionLabel>Job code &amp; allocation summary</SectionLabel></div>
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-[var(--border)] text-xs uppercase tracking-wide text-[var(--muted)]">
                <th className="px-4 py-2.5 text-left font-semibold">Department / project</th>
                <th className="px-3 py-2.5 text-left font-semibold">Job code</th>
                <th className="px-3 py-2.5 text-left font-semibold">Position title</th>
                <th className="px-3 py-2.5 text-right font-semibold">Hours</th>
                <th className="px-3 py-2.5 text-right font-semibold">Programs</th>
                <th className="px-4 py-2.5 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {ts.jobCodeSummary!.map((r, i) => (
                <tr key={i} className="border-b border-[var(--border-soft)] last:border-0">
                  <td className="px-4 py-2.5">{r.department}</td>
                  <td className="px-3 py-2.5">{r.jobCode}</td>
                  <td className="px-3 py-2.5">{r.positionTitle}</td>
                  <td className="px-3 py-2.5 text-right tabular">{fmtHours(r.hours)}</td>
                  <td className="px-3 py-2.5 text-right tabular">{fmtHours(r.programs)}</td>
                  <td className="px-4 py-2.5 text-right tabular font-medium">{fmtHours(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {isAdmin && (
        <Card>
          <SectionLabel>Supervisor</SectionLabel>
          <p className="text-xs text-[var(--muted)] mb-3">Set who this timecard's "Send to supervisor" link goes to.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--muted)]">Name</label>
              <input value={supervisorName} onChange={e => setSupervisorName(e.target.value)} className={inputClass} placeholder="Supervisor name" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--muted)]">Email</label>
              <input type="email" value={supervisorEmail} onChange={e => setSupervisorEmail(e.target.value)} className={inputClass} placeholder="supervisor@company.com" />
            </div>
            <Button variant="secondary" onClick={saveSupervisor} disabled={savingSupervisor}>{savingSupervisor ? 'Saving…' : 'Save'}</Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <SectionLabel>Employee verification</SectionLabel>
          <p className="text-xs text-[var(--muted)] mb-2">I certify that the hours logged above accurately represent the hours worked during this pay period.</p>
          {ts.employeeSignature ? (
            <SignaturePreview sig={ts.employeeSignature} />
          ) : (
            <span className="text-sm text-[var(--muted)]">Not yet signed — send the employee their link to sign.</span>
          )}
        </Card>
        <Card>
          <SectionLabel>Supervisor approval</SectionLabel>
          <p className="text-xs text-[var(--muted)] mb-2">I verify that the hours reported above are correct and approved for processing and billing.</p>
          {ts.supervisorSignature ? (
            <SignaturePreview sig={ts.supervisorSignature} />
          ) : (
            <span className="text-sm text-[var(--muted)]">Not yet approved{ts.status === 'employee_approved' || ts.status === 'draft' ? ' — send the supervisor their link once the employee has signed.' : '.'}</span>
          )}
        </Card>
      </div>
    </div>
  );
}
