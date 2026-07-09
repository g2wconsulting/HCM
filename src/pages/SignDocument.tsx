import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Button, Card, SectionLabel, Badge } from '../components/ui';
import { formatDate, hours as fmtHours } from '../lib/format';
import { SignaturePad } from '../components/SignaturePad';

interface WeekPayload {
  weekStartDate: string;
  weekEndDate: string;
  entries: { id: string; date: string; projectId: string | null; hours: number }[];
}
interface RequestPayload {
  id: string;
  employee_name: string;
  company_name: string;
  range_start: string;
  range_end: string;
  status: string;
  signed_at: string | null;
  weeks: WeekPayload[];
  projects: { id: string; name: string }[];
}

export function SignDocument() {
  const { token } = useParams();
  const [payload, setPayload] = useState<RequestPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signed, setSigned] = useState(false);
  const [showSign, setShowSign] = useState(false);

  useEffect(() => {
    if (!token) return;
    supabase.rpc('get_signature_request_public', { p_token: token }).then(({ data, error: err }) => {
      if (err || !data || data.length === 0) { setError('This link is invalid or has expired.'); return; }
      setPayload(data[0] as RequestPayload);
      if (data[0].status === 'sent') {
        supabase.rpc('mark_signature_request_viewed', { p_token: token });
      }
    });
  }, [token]);

  async function handleSign(sig: any) {
    if (!token) return;
    const { data, error: err } = await supabase.rpc('sign_signature_request_public', {
      p_token: token, p_signature: sig, p_signer_name: sig.name,
    });
    if (err || !data) { setError('Something went wrong saving your signature. Please try again.'); return; }
    setSigned(true);
    setShowSign(false);
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

  const alreadySigned = signed || payload.status === 'signed';
  const grandTotal = payload.weeks.reduce((s, w) => s + w.entries.reduce((s2, e) => s2 + e.hours, 0), 0);

  return (
    <div className="min-h-screen bg-[var(--paper)] py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <div className="font-display text-2xl">{payload.company_name}</div>
          <p className="text-[var(--muted)] text-sm mt-1">Timesheet review &amp; signature</p>
        </div>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-display text-xl">{payload.employee_name}</div>
              <div className="text-sm text-[var(--muted)]">{formatDate(payload.range_start)} – {formatDate(payload.range_end)}</div>
            </div>
            <Badge tone={alreadySigned ? 'good' : 'pending'}>{alreadySigned ? 'signed' : 'awaiting signature'}</Badge>
          </div>

          <div className="space-y-4">
            {payload.weeks.map(w => {
              const total = w.entries.reduce((s, e) => s + e.hours, 0);
              return (
                <div key={w.weekStartDate} className="border border-[var(--border-soft)] rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium">Week of {formatDate(w.weekStartDate)} – {formatDate(w.weekEndDate)}</div>
                    <div className="text-sm tabular font-medium">{fmtHours(total)} hrs</div>
                  </div>
                  <div className="space-y-1">
                    {w.entries.slice().sort((a, b) => a.date.localeCompare(b.date)).map(e => {
                      const proj = payload.projects.find(p => p.id === e.projectId);
                      return (
                        <div key={e.id} className="flex items-center justify-between text-xs text-[var(--muted)]">
                          <span>{formatDate(e.date)} — {proj?.name ?? 'Unassigned'}</span>
                          <span className="tabular">{fmtHours(e.hours)} hrs</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-between pt-4 mt-4 border-t border-[var(--border-soft)] font-semibold text-sm">
            <span>Total hours</span>
            <span className="tabular">{fmtHours(grandTotal)}</span>
          </div>
        </Card>

        {alreadySigned ? (
          <Card className="text-center">
            <p className="text-sm text-[var(--good)]">
              Signed{payload.signed_at ? ` on ${new Date(payload.signed_at).toLocaleDateString()}` : ''}. Thank you.
            </p>
          </Card>
        ) : showSign ? (
          <SignaturePad defaultName="" onSign={handleSign} onCancel={() => setShowSign(false)} />
        ) : (
          <Card>
            <SectionLabel>Confirm and sign</SectionLabel>
            <p className="text-sm text-[var(--ink-soft)] mb-3">
              By signing, you confirm the hours above are accurate for this period.
            </p>
            <Button onClick={() => setShowSign(true)}>Review &amp; sign</Button>
          </Card>
        )}
      </div>
    </div>
  );
}
