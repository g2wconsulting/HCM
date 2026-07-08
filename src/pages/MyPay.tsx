import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Card, SectionLabel } from '../components/ui';
import { formatDate, money, hours as fmtHours } from '../lib/format';
import { useApp } from '../lib/AppContext';

interface StubRow {
  payroll_run_id: string;
  period_start: string;
  period_end: string;
  pay_date: string;
  status: string;
  line_item: any;
}

export function MyPay() {
  const { data } = useApp();
  const [stubs, setStubs] = useState<StubRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc('my_pay_stubs').then(({ data, error }) => {
      if (error) setError(error.message);
      else setStubs((data as StubRow[]).sort((a, b) => b.period_end.localeCompare(a.period_end)));
    });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">My pay</h1>
        <p className="text-[var(--ink-soft)] mt-1">Your pay stubs from finalized payroll runs.</p>
      </div>

      {error && <p className="text-sm text-[var(--bad)]">{error}</p>}
      {!stubs && !error && <p className="text-sm text-[var(--muted)]">Loading…</p>}
      {stubs && stubs.length === 0 && <p className="text-sm text-[var(--muted)]">No pay stubs yet.</p>}

      <div className="space-y-4">
        {stubs?.map(s => {
          const l = s.line_item;
          return (
            <Card key={s.payroll_run_id} className="max-w-xl">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="font-display text-lg">{formatDate(s.period_start)} – {formatDate(s.period_end)}</div>
                  <div className="text-xs text-[var(--muted)]">Pay date {formatDate(s.pay_date)} · {s.status}</div>
                </div>
                <span className="stamp text-xs px-2 py-1 border-2 border-[var(--good)] text-[var(--good)] rounded">PAY STUB</span>
              </div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm mb-3">
                <Row label="Regular hours" value={fmtHours(l.regularHours)} />
                <Row label="Overtime hours" value={fmtHours(l.overtimeHours)} />
                <Row label="Gross pay" value={money(l.grossPay)} bold />
              </div>
              <div className="border-t border-[var(--border-soft)] my-2" />
              <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm mb-3">
                <Row label="Federal withholding" value={`-${money(l.federalWithholding)}`} />
                <Row label="State withholding" value={`-${money(l.stateWithholding)}`} />
                <Row label="Social Security" value={`-${money(l.socialSecurity)}`} />
                <Row label="Medicare" value={`-${money(l.medicare)}`} />
                {l.additionalMedicare > 0 && <Row label="Additional Medicare" value={`-${money(l.additionalMedicare)}`} />}
              </div>
              <div className="border-t border-[var(--border-soft)] my-2" />
              <div className="flex justify-between text-base font-semibold">
                <span>Net pay</span>
                <span className="tabular text-[var(--good)]">{money(l.netPay)}</span>
              </div>
              {l.breakdownByProject?.length > 0 && (
                <div className="mt-4 pt-3 border-t border-dashed border-[var(--border)]">
                  <SectionLabel>Hours by project</SectionLabel>
                  {l.breakdownByProject.map((b: any) => {
                    const proj = data.projects.find(p => p.id === b.projectId);
                    return <Row key={String(b.projectId)} label={proj?.name ?? 'Unassigned'} value={`${fmtHours(b.hours)} hrs`} />;
                  })}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <>
      <span className={`text-[var(--ink-soft)] ${bold ? 'font-semibold text-[var(--ink)]' : ''}`}>{label}</span>
      <span className={`text-right tabular ${bold ? 'font-semibold' : ''}`}>{value}</span>
    </>
  );
}
