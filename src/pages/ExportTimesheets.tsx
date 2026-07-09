import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApp } from '../lib/AppContext';
import { Badge, Button, Card, SectionLabel, inputClass } from '../components/ui';
import { formatDate, hours as fmtHours } from '../lib/format';
import { buildTimesheetRangePdf, pdfFileName, shareOrDownloadPdf } from '../lib/pdfExport';
import { supabase } from '../lib/supabaseClient';

export function ExportTimesheets() {
  const [params] = useSearchParams();
  const { data, company } = useApp();
  const employeeId = params.get('employeeId') ?? '';
  const start = params.get('start') ?? '';
  const end = params.get('end') ?? '';
  const [status, setStatus] = useState<string | null>(null);
  const [showSendModal, setShowSendModal] = useState(false);

  const employee = data.employees.find(e => e.id === employeeId);
  const pastRequests = data.signatureRequests
    .filter(r => r.employeeId === employeeId && r.rangeStart === start && r.rangeEnd === end)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const timesheets = useMemo(() => {
    return data.timesheets
      .filter(t => t.employeeId === employeeId && t.weekEndDate >= start && t.weekStartDate <= end)
      .sort((a, b) => a.weekStartDate.localeCompare(b.weekStartDate));
  }, [data.timesheets, employeeId, start, end]);

  const grandTotal = timesheets.reduce((s, t) => s + t.entries.reduce((s2, e) => s2 + e.hours, 0), 0);

  if (!employee) {
    return <div><p className="text-[var(--muted)]">Employee not found.</p><Link to="/timesheets" className="text-[var(--accent)] underline">Back</Link></div>;
  }

  function generate() {
    if (!employee) throw new Error('employee not found');
    return buildTimesheetRangePdf({
      company, employee, timesheets, projects: data.projects, rangeStart: start, rangeEnd: end,
    });
  }

  function download() {
    if (!employee) return;
    const doc = generate();
    doc.save(pdfFileName(employee, start, end));
  }

  async function shareOrEmail() {
    if (!employee) return;
    setStatus(null);
    const doc = generate();
    const filename = pdfFileName(employee, start, end);
    const result = await shareOrDownloadPdf(doc, filename, `Timesheets for ${employee.firstName} ${employee.lastName}, ${formatDate(start)} – ${formatDate(end)}`);
    if (result === 'shared') {
      setStatus('Shared — pick your email app (or any app) from the share sheet.');
    } else {
      setStatus("Your browser can't attach files directly, so the PDF downloaded instead — attach it to an email yourself.");
      const subject = encodeURIComponent(`Timesheets — ${employee.firstName} ${employee.lastName}`);
      const body = encodeURIComponent(`Attached: timesheets for ${formatDate(start)} – ${formatDate(end)}.\n\n(Attach ${filename} from your downloads before sending.)`);
      window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
    }
  }

  return (
    <div className="space-y-6">
      <Link to="/timesheets" className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">← Timesheets</Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl">Export timesheets</h1>
          <p className="text-[var(--ink-soft)] mt-1">
            {employee.firstName} {employee.lastName} · {formatDate(start)} – {formatDate(end)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={download}>Download PDF</Button>
          <Button variant="secondary" onClick={shareOrEmail}>Share / Email PDF</Button>
          <Button onClick={() => setShowSendModal(true)}>Send for e-signature</Button>
        </div>
      </div>

      {showSendModal && employee && (
        <SendForSignatureModal
          employeeId={employee.id}
          timesheetIds={timesheets.map(t => t.id)}
          rangeStart={start}
          rangeEnd={end}
          onClose={() => setShowSendModal(false)}
          onSent={(msg) => setStatus(msg)}
        />
      )}

      {status && (
        <div className="rounded-lg border border-[var(--accent)]/25 bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-dark)]">
          {status}
        </div>
      )}

      <Card>
        <SectionLabel>Preview</SectionLabel>
        {timesheets.length === 0 ? (
          <p className="text-sm text-[var(--muted)] py-4">No timesheets fall within this date range.</p>
        ) : (
          <div className="space-y-4 mt-2">
            {timesheets.map(ts => {
              const total = ts.entries.reduce((s, e) => s + e.hours, 0);
              return (
                <div key={ts.id} className="border border-[var(--border-soft)] rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">Week of {formatDate(ts.weekStartDate)} – {formatDate(ts.weekEndDate)}</div>
                    <div className="flex items-center gap-2">
                      <Badge tone={ts.status === 'approved' || ts.status === 'paid' ? 'good' : ts.status === 'submitted' ? 'pending' : 'neutral'}>{ts.status}</Badge>
                      <span className="text-sm tabular font-medium">{fmtHours(total)} hrs</span>
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="flex justify-between pt-2 border-t border-[var(--border-soft)] font-semibold text-sm">
              <span>Total for period</span>
              <span className="tabular">{fmtHours(grandTotal)} hrs</span>
            </div>
          </div>
        )}
      </Card>

      {pastRequests.length > 0 && (
        <Card>
          <SectionLabel>Signature requests for this range</SectionLabel>
          <div className="divide-y divide-[var(--border-soft)]">
            {pastRequests.map(r => (
              <div key={r.id} className="py-2.5 flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium">{r.recipientName}</div>
                  <div className="text-xs text-[var(--muted)]">{r.recipientEmail}</div>
                </div>
                <Badge tone={r.status === 'signed' ? 'good' : r.status === 'declined' ? 'bad' : 'pending'}>{r.status}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      <p className="text-xs text-[var(--muted)]">
        The PDF includes each week's hours by project, any in-app signatures already captured, and a blank
        signature block at the end for external e-signature if you're sending this out for a fresh signature.
      </p>
    </div>
  );
}

function SendForSignatureModal({
  employeeId, timesheetIds, rangeStart, rangeEnd, onClose, onSent,
}: {
  employeeId: string; timesheetIds: string[]; rangeStart: string; rangeEnd: string;
  onClose: () => void; onSent: (message: string) => void;
}) {
  const { addSignatureRequest } = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!name.trim() || !email.trim() || timesheetIds.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await addSignatureRequest({
        employeeId, timesheetIds, rangeStart, rangeEnd,
        recipientName: name.trim(), recipientEmail: email.trim(),
      } as any);
      if (!created) { setError('Could not create the signature request — check the browser console for details.'); return; }

      const { data: fnRes, error: fnErr } = await supabase.functions.invoke('send-signature-request', {
        body: { requestId: created.id, siteUrl: window.location.origin },
      });
      if (fnErr || (fnRes as any)?.error) {
        setError(`Request saved, but the email failed to send: ${fnErr?.message ?? (fnRes as any)?.error}. This usually means the send-signature-request Edge Function hasn't been deployed yet, or RESEND_API_KEY isn't set — see the README's "Sending timesheets out for external e-signature" section.`);
        return;
      }
      onSent(`Sent to ${name.trim()} at ${email.trim()}. You'll see their status update here once they view or sign.`);
      onClose();
    } catch (err: any) {
      setError(`Something went wrong: ${err?.message ?? 'unknown error'}. This usually means the send-signature-request Edge Function hasn't been deployed yet — see the README's "Sending timesheets out for external e-signature" section.`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl border border-[var(--border)] p-6 w-full max-w-sm space-y-4">
        <h2 className="font-display text-xl">Send for e-signature</h2>
        <p className="text-sm text-[var(--ink-soft)]">
          They'll get an email with a link to review these hours and sign — no login needed on their end.
          Signing marks these timesheets approved.
        </p>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-[var(--ink-soft)]">Recipient name</label>
          <input value={name} onChange={e => setName(e.target.value)} className={inputClass} placeholder="Hiring manager's name" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-[var(--ink-soft)]">Recipient email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} placeholder="them@theirclientcompany.com" />
        </div>
        {error && <div className="rounded-lg bg-[var(--bad-soft)] border border-[var(--bad)]/20 px-3 py-2 text-sm text-[var(--bad)]">{error}</div>}
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={send} disabled={submitting || !name.trim() || !email.trim()}>{submitting ? 'Sending…' : 'Send'}</Button>
        </div>
      </div>
    </div>
  );
}
