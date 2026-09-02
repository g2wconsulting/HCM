import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../lib/AppContext';
import { Button, Card, SectionLabel } from '../components/ui';
import { formatDate, money } from '../lib/format';
import { computeQuarterlySummary } from '../lib/quarterlyTax';
import { buildQuarterlyTaxSummaryPdf } from '../lib/pdfExport';

function currentQuarter(): 1 | 2 | 3 | 4 {
  return (Math.floor(new Date().getMonth() / 3) + 1) as 1 | 2 | 3 | 4;
}

export function QuarterlyTaxSummary() {
  const { data, company } = useApp();
  const [year, setYear] = useState(new Date().getFullYear());
  const [quarter, setQuarter] = useState<1 | 2 | 3 | 4>(currentQuarter());

  const summary = useMemo(() => computeQuarterlySummary(data.payrollRuns, year, quarter), [data.payrollRuns, year, quarter]);

  function download() {
    const doc = buildQuarterlyTaxSummaryPdf({ company, summary });
    doc.save(`quarterly-tax-summary-${year}-Q${quarter}.pdf`);
  }

  return (
    <div className="space-y-6">
      <Link to="/payroll" className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">← Payroll</Link>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl">Quarterly tax summary</h1>
          <p className="text-[var(--ink-soft)] mt-1">Form 941 worksheet, computed from finalized payroll runs.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={quarter} onChange={e => setQuarter(Number(e.target.value) as 1 | 2 | 3 | 4)} className="focus-ring rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm">
            <option value={1}>Q1 (Jan–Mar)</option>
            <option value={2}>Q2 (Apr–Jun)</option>
            <option value={3}>Q3 (Jul–Sep)</option>
            <option value={4}>Q4 (Oct–Dec)</option>
          </select>
          <input type="number" value={year} onChange={e => setYear(parseInt(e.target.value) || year)} className="focus-ring rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm w-24" />
          <Button variant="secondary" onClick={download}>Download PDF</Button>
        </div>
      </div>

      <div className="rounded-lg border border-[var(--pending)]/30 bg-[var(--pending-soft)] px-4 py-3 text-sm text-[var(--pending)]">
        <strong>Not an official IRS form.</strong> These figures are computed from payroll runs finalized in this app to
        speed up preparing the real Form 941 — verify everything, including current-year IRS rates, before filing.
        This app does not e-file or transmit anything to the IRS or any state agency; you'll still file through the
        IRS's own system (or your usual filing method) using these numbers.
      </div>

      <Card className="!p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-[var(--muted)] border-b border-[var(--border)]">
              <th className="px-5 py-3 font-semibold w-16">Line</th>
              <th className="px-5 py-3 font-semibold">Description</th>
              <th className="px-5 py-3 font-semibold text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <TaxRow line="1" label="Employees paid this quarter" value={String(summary.employeeCount)} />
            <TaxRow line="2" label="Wages, tips, and other compensation" value={money(summary.totalWages)} />
            <TaxRow line="3" label="Federal income tax withheld" value={money(summary.federalIncomeTaxWithheld)} />
            <TaxRow line="5a" label="Taxable Social Security wages" value={money(summary.socialSecurityWages)} sub={`tax (12.4%): ${money(summary.socialSecurityTax)}`} />
            <TaxRow line="5c" label="Taxable Medicare wages" value={money(summary.medicareWages)} sub={`tax (2.9%): ${money(summary.medicareTax)}`} />
            <TaxRow line="5d" label="Additional Medicare tax withheld (employee-only)" value={money(summary.additionalMedicareTax)} />
            <TaxRow line="6" label="Total taxes before adjustments" value={money(summary.totalTaxesBeforeAdjustments)} bold />
          </tbody>
        </table>
      </Card>

      <Card>
        <SectionLabel>Payroll runs included</SectionLabel>
        {summary.runsIncluded.length === 0 ? (
          <p className="text-sm text-[var(--muted)] py-2">No finalized payroll runs fall within this quarter.</p>
        ) : (
          <div className="divide-y divide-[var(--border-soft)]">
            {summary.runsIncluded.map(r => (
              <div key={r.id} className="py-2 flex items-center justify-between text-sm">
                <span>{formatDate(r.periodStart)} – {formatDate(r.periodEnd)}</span>
                <span className="text-[var(--muted)]">paid {formatDate(r.payDate)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function TaxRow({ line, label, value, sub, bold }: { line: string; label: string; value: string; sub?: string; bold?: boolean }) {
  return (
    <tr className={`border-b border-[var(--border-soft)] last:border-0 ${bold ? 'bg-[var(--paper)]' : ''}`}>
      <td className={`px-5 py-3 tabular ${bold ? 'font-semibold' : 'text-[var(--muted)]'}`}>{line}</td>
      <td className={`px-5 py-3 ${bold ? 'font-semibold' : ''}`}>
        {label}
        {sub && <div className="text-xs text-[var(--muted)] mt-0.5">{sub}</div>}
      </td>
      <td className={`px-5 py-3 text-right tabular ${bold ? 'font-semibold' : ''}`}>{value}</td>
    </tr>
  );
}
