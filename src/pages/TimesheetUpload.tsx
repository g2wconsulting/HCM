import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../lib/AppContext';
import { Badge, Button, Card, SectionLabel, inputClass } from '../components/ui';
import { formatDate, hours as fmtHours } from '../lib/format';
import { parseTimesheetFile, buildJobCodeSummary, reflowDailyEntries, type ParsedTimecardDraft } from '../lib/timesheetParser';
import type { DailyEntry, DailyStatus } from '../lib/types';

interface ReviewRow extends ParsedTimecardDraft {
  matchedEmployeeId: string | null;
  duplicateOfId: string | null;
  replaceExisting: boolean;
  skip: boolean;
}

export function TimesheetUpload() {
  const { data, importTimecards } = useApp();
  const navigate = useNavigate();
  const [step, setStep] = useState<'upload' | 'review' | 'done'>('upload');
  const [fileWarnings, setFileWarnings] = useState<string[]>([]);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ createdCount: number; updatedCount: number; errors: string[] } | null>(null);

  async function handleFile(file: File) {
    setParsing(true);
    setParseError(null);
    try {
      const result = await parseTimesheetFile(file);
      setFileWarnings(result.warnings);
      const reviewRows: ReviewRow[] = result.drafts.map(d => {
        const matched = matchEmployee(d, data.employees);
        const dup = matched
          ? data.timesheets.find(t => t.employeeId === matched && t.weekStartDate === d.payPeriodStart) ?? null
          : null;
        return { ...d, matchedEmployeeId: matched, duplicateOfId: dup?.id ?? null, replaceExisting: false, skip: false };
      });
      setRows(reviewRows);
      setStep('review');
    } catch (err: any) {
      setParseError(err?.message ?? 'Could not parse this file. Try an Excel/CSV export instead.');
    } finally {
      setParsing(false);
    }
  }

  function updateRow(key: string, patch: Partial<ReviewRow>) {
    setRows(prev => prev.map(r => {
      if (r.key !== key) return r;
      const next = { ...r, ...patch };
      const dup = next.matchedEmployeeId
        ? data.timesheets.find(t => t.employeeId === next.matchedEmployeeId && t.weekStartDate === next.payPeriodStart) ?? null
        : null;
      return { ...next, duplicateOfId: dup?.id ?? null, replaceExisting: dup ? next.replaceExisting : false };
    }));
  }
  function updateDay(key: string, date: string, patch: Partial<DailyEntry>) {
    setRows(prev => prev.map(r => {
      if (r.key !== key) return r;
      const dailyEntries = r.dailyEntries.map(d => d.date === date ? { ...d, ...patch } : d);
      const regularHours = Math.round(dailyEntries.reduce((s, d) => s + d.hours, 0) * 100) / 100;
      return { ...r, dailyEntries, regularHours };
    }));
  }
  function updatePayPeriod(key: string, field: 'payPeriodStart' | 'payPeriodEnd', value: string) {
    setRows(prev => prev.map(r => {
      if (r.key !== key) return r;
      const next = { ...r, [field]: value };
      const dailyEntries = reflowDailyEntries(r.dailyEntries, next.payPeriodStart, next.payPeriodEnd);
      const regularHours = Math.round(dailyEntries.reduce((s, d) => s + d.hours, 0) * 100) / 100;
      const dup = next.matchedEmployeeId
        ? data.timesheets.find(t => t.employeeId === next.matchedEmployeeId && t.weekStartDate === next.payPeriodStart) ?? null
        : null;
      return { ...next, dailyEntries, regularHours, duplicateOfId: dup?.id ?? null, replaceExisting: dup ? next.replaceExisting : false };
    }));
  }

  async function saveAll() {
    setSaving(true);
    const toSave = rows.filter(r => !r.skip && r.matchedEmployeeId);
    const result = await importTimecards(toSave.map(r => {
      const emp = data.employees.find(e => e.id === r.matchedEmployeeId)!;
      return {
        employeeId: r.matchedEmployeeId!,
        weekStartDate: r.payPeriodStart,
        weekEndDate: r.payPeriodEnd,
        dailyEntries: r.dailyEntries,
        regularHours: r.regularHours,
        jobCodeSummary: buildJobCodeSummary(r.dailyEntries),
        employeeNumberSnapshot: emp.employeeNumber || r.employeeNumberRaw || undefined,
        employeeNameSnapshot: `${emp.firstName} ${emp.lastName}`,
        replaceExistingId: r.replaceExisting ? r.duplicateOfId : null,
      };
    }));
    setSaving(false);
    setSaveResult(result);
    setStep('done');
  }

  if (step === 'done' && saveResult) {
    return (
      <div className="space-y-6">
        <Link to="/timesheets" className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">← Timesheets</Link>
        <Card className="text-center py-10">
          <div className="font-display text-2xl mb-2">Timecards created</div>
          <p className="text-[var(--ink-soft)]">
            {saveResult.createdCount} new, {saveResult.updatedCount} replaced
            {saveResult.errors.length > 0 && `, ${saveResult.errors.length} failed`}.
          </p>
          {saveResult.errors.length > 0 && (
            <div className="mt-4 text-sm text-[var(--bad)] space-y-1 text-left max-w-md mx-auto">
              {saveResult.errors.map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}
          <div className="mt-6 flex justify-center gap-2">
            <Button onClick={() => navigate('/timesheets')}>Go to Timesheets →</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/timesheets" className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">← Timesheets</Link>
        <h1 className="font-display text-3xl mt-1">Upload timesheet</h1>
        <p className="text-[var(--ink-soft)] mt-1">Upload a time report and we'll parse it into one draft timecard per employee for you to review.</p>
      </div>

      {step === 'upload' && (
        <Card>
          <SectionLabel>Step 1 — Upload file</SectionLabel>
          <label className="focus-ring block w-full rounded-lg border-2 border-dashed border-[var(--border)] py-12 text-center text-sm text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors cursor-pointer">
            {parsing ? 'Parsing…' : 'Click to choose a file (Excel, CSV, or PDF)'}
            <input
              type="file"
              accept=".xlsx,.xls,.csv,.pdf"
              className="hidden"
              disabled={parsing}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </label>
          {parseError && <p className="text-sm text-[var(--bad)] mt-3">{parseError}</p>}
          <p className="text-xs text-[var(--muted)] mt-3">
            Excel/CSV parses most reliably. PDF is best-effort — you'll get a chance to correct anything on the next screen either way.
          </p>
        </Card>
      )}

      {step === 'review' && (
        <div className="space-y-5">
          {fileWarnings.length > 0 && (
            <div className="rounded-lg border border-[var(--pending)]/30 bg-[var(--pending-soft)] px-4 py-3 text-sm text-[var(--pending)] space-y-1">
              {fileWarnings.map((w, i) => <div key={i}>{w}</div>)}
            </div>
          )}
          <div className="flex items-center justify-between">
            <SectionLabel>Step 2 — Review &amp; correct ({rows.length} employee{rows.length !== 1 ? 's' : ''} found)</SectionLabel>
            <Button variant="ghost" onClick={() => { setStep('upload'); setRows([]); }}>Start over</Button>
          </div>
          {rows.map(row => (
            <ReviewCard
              key={row.key}
              row={row}
              onUpdate={p => updateRow(row.key, p)}
              onUpdateDay={(date, p) => updateDay(row.key, date, p)}
              onUpdatePayPeriod={(field, value) => updatePayPeriod(row.key, field, value)}
            />
          ))}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => { setStep('upload'); setRows([]); }}>Cancel</Button>
            <Button onClick={saveAll} disabled={saving || rows.every(r => r.skip || !r.matchedEmployeeId)}>
              {saving ? 'Creating…' : `Create timecards →`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function matchEmployee(d: ParsedTimecardDraft, employees: { id: string; employeeNumber?: string; firstName: string; lastName: string }[]): string | null {
  if (d.employeeNumberRaw) {
    const byNumber = employees.find(e => e.employeeNumber && e.employeeNumber === d.employeeNumberRaw);
    if (byNumber) return byNumber.id;
  }
  const byName = employees.find(e => e.firstName.toLowerCase() === d.firstName.toLowerCase() && e.lastName.toLowerCase() === d.lastName.toLowerCase());
  return byName?.id ?? null;
}

const STATUS_OPTIONS: DailyStatus[] = ['WORK', 'OFF', 'HOLIDAY', 'PTO', 'SICK'];

function ReviewCard({ row, onUpdate, onUpdateDay, onUpdatePayPeriod }: {
  row: ReviewRow;
  onUpdate: (patch: Partial<ReviewRow>) => void;
  onUpdateDay: (date: string, patch: Partial<DailyEntry>) => void;
  onUpdatePayPeriod: (field: 'payPeriodStart' | 'payPeriodEnd', value: string) => void;
}) {
  const { data } = useApp();
  const [expanded, setExpanded] = useState(true);
  const employee = data.employees.find(e => e.id === row.matchedEmployeeId);
  const duplicate = row.duplicateOfId ? data.timesheets.find(t => t.id === row.duplicateOfId) : null;

  return (
    <Card className={row.skip ? 'opacity-50' : ''}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setExpanded(v => !v)} className="focus-ring text-[var(--muted)]">{expanded ? '▾' : '▸'}</button>
            <span className="font-medium">{row.firstName} {row.lastName}</span>
            <Badge tone={row.matchedEmployeeId ? 'good' : 'bad'}>{row.matchedEmployeeId ? 'matched' : 'unmatched'}</Badge>
            <span className="text-xs text-[var(--muted)] tabular">{fmtHours(row.regularHours)} hrs</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-[var(--muted)]">Pay period:</span>
            <input type="date" value={row.payPeriodStart} onChange={e => onUpdatePayPeriod('payPeriodStart', e.target.value)} className="rounded-md border border-[var(--border)] bg-white px-2 py-1 text-xs" />
            <span className="text-xs text-[var(--muted)]">to</span>
            <input type="date" value={row.payPeriodEnd} onChange={e => onUpdatePayPeriod('payPeriodEnd', e.target.value)} className="rounded-md border border-[var(--border)] bg-white px-2 py-1 text-xs" />
            <span className="text-xs text-[var(--muted)]">({formatDate(row.payPeriodStart)} – {formatDate(row.payPeriodEnd)})</span>
          </div>
          {!row.matchedEmployeeId && (
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-[var(--muted)]">Match to existing employee:</span>
                <select
                  value={row.matchedEmployeeId ?? ''}
                  onChange={e => onUpdate({ matchedEmployeeId: e.target.value || null, duplicateOfId: null })}
                  className="focus-ring rounded-md border border-[var(--border)] bg-white px-2 py-1 text-sm"
                >
                  <option value="">Select employee…</option>
                  {data.employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}{e.employeeNumber ? ` (${e.employeeNumber})` : ''}</option>)}
                </select>
                <span className="text-xs text-[var(--muted)]">or</span>
                <CreateEmployeeInline row={row} onCreated={id => onUpdate({ matchedEmployeeId: id, duplicateOfId: null })} />
              </div>
            </div>
          )}
          {duplicate && (
            <div className="mt-2 flex items-center gap-3 rounded-md bg-[var(--pending-soft)] border border-[var(--pending)]/25 px-3 py-2 text-xs text-[var(--pending)]">
              <span>A timecard already exists for {employee?.firstName} {employee?.lastName} for this pay period.</span>
              <label className="flex items-center gap-1.5 shrink-0">
                <input type="checkbox" checked={row.replaceExisting} onChange={e => onUpdate({ replaceExisting: e.target.checked })} />
                Replace it
              </label>
            </div>
          )}
          {row.warnings.length > 0 && (
            <div className="mt-2 space-y-0.5">
              {row.warnings.map((w, i) => <div key={i} className="text-xs text-[var(--bad)]">{w}</div>)}
            </div>
          )}
        </div>
        <label className="flex items-center gap-1.5 text-xs text-[var(--muted)] shrink-0">
          <input type="checkbox" checked={row.skip} onChange={e => onUpdate({ skip: e.target.checked })} />
          Skip
        </label>
      </div>

      {expanded && !row.skip && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs min-w-[720px]">
            <thead>
              <tr className="border-b border-[var(--border-soft)] text-left text-[var(--muted)]">
                <th className="py-2 pr-2 font-semibold">Date</th>
                <th className="py-2 pr-2 font-semibold">Status</th>
                <th className="py-2 pr-2 font-semibold">Punches</th>
                <th className="py-2 pr-2 font-semibold">Position (pay)</th>
                <th className="py-2 pr-2 font-semibold">Job code</th>
                <th className="py-2 pr-2 font-semibold">Position title</th>
                <th className="py-2 pr-2 font-semibold">Department</th>
                <th className="py-2 pr-2 font-semibold text-right">Hours</th>
              </tr>
            </thead>
            <tbody>
              {row.dailyEntries.map(d => (
                <tr key={d.date} className="border-b border-[var(--border-soft)] last:border-0">
                  <td className="py-2 pr-2 whitespace-nowrap">{d.dayOfWeek}<br /><span className="text-[var(--muted)]">{formatDate(d.date)}</span></td>
                  <td className="py-2 pr-2">
                    <select value={d.status} onChange={e => onUpdateDay(d.date, { status: e.target.value as DailyStatus })} className="rounded border border-[var(--border)] px-1 py-1">
                      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="py-2 pr-2">
                    {d.punches.length === 0 ? <span className="text-[var(--muted)]">—</span> : d.punches.map((p, i) => (
                      <div key={i} className="flex items-center gap-1 mb-1 last:mb-0">
                        <input type="time" value={p.in} onChange={e => {
                          const punches = d.punches.map((pp, ii) => ii === i ? { ...pp, in: e.target.value } : pp);
                          onUpdateDay(d.date, { punches });
                        }} className="rounded border border-[var(--border)] px-1 py-0.5" />
                        <span>–</span>
                        <input type="time" value={p.out} onChange={e => {
                          const punches = d.punches.map((pp, ii) => ii === i ? { ...pp, out: e.target.value } : pp);
                          onUpdateDay(d.date, { punches });
                        }} className="rounded border border-[var(--border)] px-1 py-0.5" />
                      </div>
                    ))}
                  </td>
                  <td className="py-2 pr-2">
                    <select
                      value={d.positionId ?? ''}
                      onChange={e => {
                        const pos = data.positions.find(p => p.id === e.target.value);
                        const dept = pos ? data.departments.find(dd => dd.id === pos.departmentId) : undefined;
                        onUpdateDay(d.date, {
                          positionId: pos?.id,
                          jobCode: pos ? pos.jobCode : d.jobCode,
                          positionTitle: pos ? pos.title : d.positionTitle,
                          department: dept ? dept.name : d.department,
                        });
                      }}
                      className="w-32 rounded border border-[var(--border)] px-1 py-1"
                    >
                      <option value="">— none —</option>
                      {data.departments.map(dept => (
                        <optgroup key={dept.id} label={dept.name}>
                          {data.positions.filter(p => p.departmentId === dept.id && p.active).map(p => (
                            <option key={p.id} value={p.id}>{p.title}{p.blockPayAmount != null ? ` ($${p.blockPayAmount} block)` : ''}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-2"><input value={d.jobCode ?? ''} onChange={e => onUpdateDay(d.date, { jobCode: e.target.value })} className="w-24 rounded border border-[var(--border)] px-1 py-1" /></td>
                  <td className="py-2 pr-2"><input value={d.positionTitle ?? ''} onChange={e => onUpdateDay(d.date, { positionTitle: e.target.value })} className="w-28 rounded border border-[var(--border)] px-1 py-1" /></td>
                  <td className="py-2 pr-2"><input value={d.department ?? ''} onChange={e => onUpdateDay(d.date, { department: e.target.value })} className="w-28 rounded border border-[var(--border)] px-1 py-1" /></td>
                  <td className="py-2 pr-2 text-right">
                    <input type="number" step={0.25} min={0} value={d.hours} onChange={e => onUpdateDay(d.date, { hours: parseFloat(e.target.value) || 0 })} className="w-16 text-right rounded border border-[var(--border)] px-1 py-1 tabular" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function CreateEmployeeInline({ row, onCreated }: { row: ReviewRow; onCreated: (employeeId: string) => void }) {
  const { data, addEmployee } = useApp();
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState(row.firstName);
  const [lastName, setLastName] = useState(row.lastName);
  const [employeeNumber, setEmployeeNumber] = useState(row.employeeNumberRaw);
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!firstName.trim() || !lastName.trim() || !email.trim()) { setError('First name, last name, and email are required.'); return; }
    setSaving(true);
    setError(null);
    const created = await addEmployee({
      companyId: data.currentCompanyId!, firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(),
      title: '', status: 'onboarding', payType: 'hourly', state: 'OR', filingStatus: 'single',
      federalAllowancesExtraWithholding: 0, defaultHourlyRate: 0, dependentsCredit: 0,
      hireDate: new Date().toISOString().slice(0, 10), rates: [], projectIds: [],
      employeeNumber: employeeNumber.trim() || undefined,
    } as any);
    setSaving(false);
    if (!created) { setError('Could not create the employee — check the browser console for details.'); return; }
    setOpen(false);
    onCreated(created.id);
  }

  if (!open) {
    return <button onClick={() => setOpen(true)} className="focus-ring text-xs text-[var(--accent)] hover:underline font-medium">+ Create new employee</button>;
  }

  return (
    <div className="w-full mt-1 rounded-lg border border-[var(--border)] bg-white p-3 space-y-2">
      <div className="grid grid-cols-4 gap-2">
        <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name" className={inputClass} />
        <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last name" className={inputClass} />
        <input value={employeeNumber} onChange={e => setEmployeeNumber(e.target.value)} placeholder="Employee # (optional)" className={inputClass} />
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email (required)" className={inputClass} />
      </div>
      {error && <p className="text-xs text-[var(--bad)]">{error}</p>}
      <p className="text-xs text-[var(--muted)]">Creates a minimal employee record (status: onboarding) — fill in pay rate, tax details, etc. on their profile afterward.</p>
      <div className="flex gap-2">
        <Button size="sm" onClick={create} disabled={saving}>{saving ? 'Creating…' : 'Create employee'}</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}
