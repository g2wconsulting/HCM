import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Button, Card, SectionLabel, Badge } from '../components/ui';
import { formatDate, hours as fmtHours } from '../lib/format';
import { SignaturePad } from '../components/SignaturePad';
import { formatTimeLabel } from '../lib/timesheetParser';
import type { DailyEntry, JobCodeSummaryRow } from '../lib/types';

interface TimecardPayload {
  id: string;
  role: 'employee' | 'supervisor';
  company_name: string;
  employee_name: string;
  employee_number: string | null;
  week_start_date: string;
  week_end_date: string;
  regular_hours: number | null;
  daily_entries: DailyEntry[];
  job_code_summary: JobCodeSummaryRow[];
  status: string;
  employee_signature: any;
  employee_signed_at: string | null;
  supervisor_signature: any;
  supervisor_signed_at: string | null;
  supervisor_name: string | null;
}

// Public, unauthenticated page a token-holder lands on. A token resolves
// to exactly one timecard's row via a unique column, so this can never be
// used to view or sign a different employee's timecard.
export function TimecardSign() {
  const { token } = useParams();
  const [payload, setPayload] = useState<TimecardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSign, setShowSign] = useState(false);
  const [justSigned, setJustSigned] = useState(false);

  useEffect(() => {
    if (!token) return;
    supabase.rpc('get_timecard_by_token', { p_token: token }).then(({ data, error: err }) => {
      if (err || !data || data.length === 0) { setError('This link is invalid or has expired.'); return; }
      setPayload(data[0] as TimecardPayload);
    });
  }, [token]);

  async function handleSign(sig: any) {
    if (!token) return;
    const { data, error: err } = await supabase.rpc('sign_timecard_by_token', { p_token: token, p_signature: sig });
    if (err || !data || data.length === 0) { setError('Something went wrong saving your signature. Please try again.'); return; }
    setJustSigned(true);
    setShowSign(false);
    setPayload(prev => prev ? { ...prev, status: data[0].status } : prev);
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-[var(--paper)]">
        <div className="ledger-card p-6 max-w-sm text-center text-sm text-[var(--bad)]">{error}</div>
      </div>
    );
  }
  if (!payload) {
    return <div className="min-h-screen flex items-center justify-center text-[var(--muted)] text-sm">Loading…</div>;
  }

  const role = payload.role;
  const canSignNow = (role === 'employee' && payload.status === 'sent_to_employee')
    || (role === 'supervisor' && payload.status === 'sent_to_supervisor');
  const alreadySignedThisStage = (role === 'employee' && !!payload.employee_signed_at)
    || (role === 'supervisor' && !!payload.supervisor_signed_at);
  const waitingOnEmployee = role === 'supervisor' && payload.status === 'sent_to_employee';
  const entries = (payload.daily_entries ?? []).slice().sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="min-h-screen bg-[var(--paper)] py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center">
          <div className="font-display text-2xl">{payload.company_name}</div>
          <p className="text-[var(--muted)] text-sm mt-1">TIMECARD — {role === 'employee' ? 'employee review & signature' : 'supervisor approval'}</p>
        </div>

        <Card>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <div className="font-display text-xl">{payload.employee_name}</div>
              <div className="text-sm text-[var(--muted)]">
                {payload.employee_number ? `ID ${payload.employee_number} · ` : ''}
                {formatDate(payload.week_start_date)} – {formatDate(payload.week_end_date)}
              </div>
            </div>
            <Badge tone={payload.status === 'completed' ? 'good' : 'pending'}>{payload.status.replace(/_/g, ' ')}</Badge>
          </div>

          <div className="mb-4">
            <SectionLabel>Regular hours</SectionLabel>
            <div className="font-display text-2xl tabular">{fmtHours(payload.regular_hours ?? 0)}</div>
          </div>

          <SectionLabel>Daily time entries</SectionLabel>
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="border-b border-[var(--border-soft)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
                  <th className="py-2 px-1 font-semibold">Date &amp; day</th>
                  <th className="py-2 px-1 font-semibold">Status</th>
                  <th className="py-2 px-1 font-semibold">Time in / out</th>
                  <th className="py-2 px-1 font-semibold">Job code &amp; position</th>
                  <th className="py-2 px-1 font-semibold text-right">Hours</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(d => (
                  <tr key={d.date} className="border-b border-[var(--border-soft)] last:border-0 align-top">
                    <td className="py-2 px-1 whitespace-nowrap">{d.dayOfWeek}<br /><span className="text-xs text-[var(--muted)]">{formatDate(d.date)}</span></td>
                    <td className="py-2 px-1">{d.status}</td>
                    <td className="py-2 px-1">
                      {d.punches.length === 0 ? '—' : d.punches.map((p, i) => (
                        <div key={i}>
                          {i > 0 && <div className="border-t border-dashed border-[var(--border)] my-1 w-24" />}
                          {formatTimeLabel(p.in)} – {formatTimeLabel(p.out)}
                        </div>
                      ))}
                    </td>
                    <td className="py-2 px-1">{d.status === 'WORK' ? [d.jobCode, d.positionTitle].filter(Boolean).join(' · ') || '—' : '—'}</td>
                    <td className="py-2 px-1 text-right tabular">{fmtHours(d.hours)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {payload.job_code_summary.length > 0 && (
            <div className="mt-5">
              <SectionLabel>Job code &amp; allocation summary</SectionLabel>
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-sm min-w-[480px]">
                  <thead>
                    <tr className="border-b border-[var(--border-soft)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
                      <th className="py-2 px-1 font-semibold">Department</th>
                      <th className="py-2 px-1 font-semibold">Job code</th>
                      <th className="py-2 px-1 font-semibold">Position</th>
                      <th className="py-2 px-1 font-semibold text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payload.job_code_summary.map((r, i) => (
                      <tr key={i} className="border-b border-[var(--border-soft)] last:border-0">
                        <td className="py-2 px-1">{r.department}</td>
                        <td className="py-2 px-1">{r.jobCode}</td>
                        <td className="py-2 px-1">{r.positionTitle}</td>
                        <td className="py-2 px-1 text-right tabular">{fmtHours(r.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="mt-5 pt-4 border-t border-[var(--border-soft)] grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs uppercase tracking-wide text-[var(--muted)] mb-1">Employee verification</div>
              {payload.employee_signed_at ? (
                <span className="text-[var(--good)]">Signed {new Date(payload.employee_signed_at).toLocaleDateString()}</span>
              ) : <span className="text-[var(--muted)]">Not yet signed</span>}
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-[var(--muted)] mb-1">Supervisor approval</div>
              {payload.supervisor_signed_at ? (
                <span className="text-[var(--good)]">Approved {new Date(payload.supervisor_signed_at).toLocaleDateString()}</span>
              ) : <span className="text-[var(--muted)]">Not yet approved</span>}
            </div>
          </div>
        </Card>

        {alreadySignedThisStage || justSigned ? (
          <Card className="text-center">
            <p className="text-sm text-[var(--good)]">
              {role === 'employee' ? 'Signed' : 'Approved'}. Thank you.
            </p>
          </Card>
        ) : waitingOnEmployee ? (
          <Card className="text-center">
            <p className="text-sm text-[var(--muted)]">Waiting on the employee to sign first — you'll be able to approve once they have.</p>
          </Card>
        ) : !canSignNow ? (
          <Card className="text-center">
            <p className="text-sm text-[var(--muted)]">This timecard isn't ready for your {role === 'employee' ? 'signature' : 'approval'} right now.</p>
          </Card>
        ) : showSign ? (
          <SignaturePad defaultName={role === 'employee' ? payload.employee_name : (payload.supervisor_name ?? '')} onSign={handleSign} onCancel={() => setShowSign(false)} allowedModes={['drawn', 'uploaded']} />
        ) : (
          <Card>
            <SectionLabel>{role === 'employee' ? 'Confirm and sign' : 'Confirm and approve'}</SectionLabel>
            <p className="text-sm text-[var(--ink-soft)] mb-3">
              {role === 'employee'
                ? 'By signing, you confirm the hours above are accurate for this pay period.'
                : 'By approving, you confirm these hours are correct and approved for processing and billing.'}
            </p>
            <Button onClick={() => setShowSign(true)}>Review &amp; {role === 'employee' ? 'sign' : 'approve'}</Button>
          </Card>
        )}
      </div>
    </div>
  );
}
