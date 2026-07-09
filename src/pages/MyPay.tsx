import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Button, Card, SectionLabel } from '../components/ui';
import { formatDate, money, hours as fmtHours } from '../lib/format';
import { useApp } from '../lib/AppContext';
import { useAuth } from '../lib/AuthContext';
import { buildPayStubPdf, buildW2Pdf, shareOrDownloadPdf } from '../lib/pdfExport';

interface StubRow {
  payroll_run_id: string;
  period_start: string;
  period_end: string;
  pay_date: string;
  status: string;
  line_item: any;
}

interface W2Row {
  employee_name: string;
  ssn: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  company_name: string;
  ein: string | null;
  company_address: string | null;
  state_withholding_account_number: string | null;
  state_unemployment_account_number: string | null;
  wages: number;
  federal_withholding: number;
  state_withholding: number;
  social_security_wages: number;
  social_security_tax: number;
  medicare_wages: number;
  medicare_tax: number;
}

export function MyPay() {
  const { data, company } = useApp();
  const { profile } = useAuth();
  const [stubs, setStubs] = useState<StubRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [w2Year, setW2Year] = useState(new Date().getFullYear());
  const [w2Status, setW2Status] = useState<string | null>(null);

  const me = data.employees.find(e => e.id === profile?.employeeId);

  useEffect(() => {
    supabase.rpc('my_pay_stubs').then(({ data, error }) => {
      if (error) setError(error.message);
      else setStubs((data as StubRow[]).sort((a, b) => b.period_end.localeCompare(a.period_end)));
    });
  }, []);

  async function downloadStubPdf(s: StubRow) {
    const doc = buildPayStubPdf({
      companyName: company.name,
      employeeName: me ? `${me.firstName} ${me.lastName}` : '',
      periodLabel: `${formatDate(s.period_start)} – ${formatDate(s.period_end)}`,
      payDate: s.pay_date,
      lineItem: s.line_item,
      projects: data.projects,
    });
    doc.save(`pay-stub-${s.period_start}-to-${s.period_end}.pdf`);
  }

  async function downloadW2() {
    setW2Status(null);
    const { data: rows, error } = await supabase.rpc('my_w2', { p_year: w2Year });
    if (error) { setW2Status(error.message); return; }
    const row = (rows as W2Row[])?.[0];
    if (!row || row.wages === 0) { setW2Status(`No finalized pay found for ${w2Year}.`); return; }
    const doc = buildW2Pdf({
      year: w2Year,
      employeeName: row.employee_name,
      ssn: row.ssn ?? undefined,
      employeeAddress: { line1: row.address_line1 ?? undefined, line2: row.address_line2 ?? undefined, city: row.city ?? undefined, state: row.state ?? undefined, zip: row.zip ?? undefined },
      companyName: row.company_name,
      ein: row.ein ?? undefined,
      companyAddress: row.company_address ?? undefined,
      stateWithholdingAccountNumber: row.state_withholding_account_number ?? undefined,
      stateUnemploymentAccountNumber: row.state_unemployment_account_number ?? undefined,
      wages: row.wages,
      federalWithholding: row.federal_withholding,
      stateWithholding: row.state_withholding,
      socialSecurityWages: row.social_security_wages,
      socialSecurityTax: row.social_security_tax,
      medicareWages: row.medicare_wages,
      medicareTax: row.medicare_tax,
    });
    await shareOrDownloadPdf(doc, `w2-${w2Year}.pdf`, `My ${w2Year} W-2`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">My pay</h1>
        <p className="text-[var(--ink-soft)] mt-1">Your pay stubs from finalized payroll runs.</p>
      </div>

      <Card className="max-w-xl">
        <SectionLabel>W-2</SectionLabel>
        <div className="flex items-center gap-2 mt-2">
          <input
            type="number" value={w2Year} onChange={e => setW2Year(parseInt(e.target.value, 10) || w2Year)}
            className="focus-ring w-24 rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          />
          <Button variant="secondary" onClick={downloadW2}>Download W-2 PDF</Button>
        </div>
        {w2Status && <p className="text-xs text-[var(--muted)] mt-2">{w2Status}</p>}
      </Card>

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
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={() => downloadStubPdf(s)}>Download PDF</Button>
                  <span className="stamp text-xs px-2 py-1 border-2 border-[var(--good)] text-[var(--good)] rounded">PAY STUB</span>
                </div>
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
