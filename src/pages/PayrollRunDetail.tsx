import { Fragment, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApp } from '../lib/AppContext';
import { Badge, Button, Card, SectionLabel } from '../components/ui';
import { formatDate, money, hours as fmtHours, downloadCsv } from '../lib/format';

export function PayrollRunDetail() {
  const { id } = useParams();
  const { data, updatePayrollRun, updateTimesheet } = useApp();
  const run = data.payrollRuns.find(r => r.id === id);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!run) {
    return <div><p className="text-[var(--muted)]">Payroll run not found.</p><Link to="/payroll" className="text-[var(--accent)] underline">Back</Link></div>;
  }

  const totals = run.lineItems.reduce((acc, l) => ({
    gross: acc.gross + l.grossPay, taxes: acc.taxes + l.totalTaxes, net: acc.net + l.netPay,
    employerLiability: acc.employerLiability + (l.employerLiability?.total ?? 0),
  }), { gross: 0, taxes: 0, net: 0, employerLiability: 0 });

  function finalize() {
    updatePayrollRun(run!.id, { status: 'finalized', finalizedAt: new Date().toISOString() });
    run!.lineItems.forEach(l => l.timesheetIds.forEach(tsId => updateTimesheet(tsId, { status: 'paid' })));
  }

  function exportCsv() {
    const rows: (string | number)[][] = [
      ['Payroll run', `${formatDate(run!.periodStart)} - ${formatDate(run!.periodEnd)}`],
      ['Pay date', formatDate(run!.payDate)],
      ['Status', run!.status],
      [],
      [
        'Employee', 'Regular hrs', 'OT hrs', 'Gross', 'Federal WH', 'State WH', 'Social Security', 'Medicare', "Add'l Medicare", 'Total taxes', 'Net pay',
        'Employer SS match', 'Employer Medicare match', 'FUTA', 'SUTA', "Workers' comp", 'Total employer liability',
      ],
    ];
    run!.lineItems.forEach(l => {
      const emp = data.employees.find(e => e.id === l.employeeId);
      const el = l.employerLiability;
      rows.push([
        `${emp?.firstName} ${emp?.lastName}`, l.regularHours, l.overtimeHours, l.grossPay,
        l.federalWithholding, l.stateWithholding, l.socialSecurity, l.medicare, l.additionalMedicare, l.totalTaxes, l.netPay,
        el?.socialSecurity ?? 0, el?.medicare ?? 0, el?.futa ?? 0, el?.suta ?? 0, el?.workersComp ?? 0, el?.total ?? 0,
      ]);
    });
    rows.push([]);
    rows.push(['Totals', '', '', totals.gross, '', '', '', '', '', totals.taxes, totals.net, '', '', '', '', '', totals.employerLiability]);
    downloadCsv(`payroll-${run!.periodStart}-to-${run!.periodEnd}.csv`, rows);
  }

  return (
    <div className="space-y-6">
      <Link to="/payroll" className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">← Payroll</Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl">{formatDate(run.periodStart)} – {formatDate(run.periodEnd)}</h1>
          <p className="text-[var(--ink-soft)] mt-1">Pay date {formatDate(run.payDate)}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge tone={run.status === 'finalized' ? 'good' : 'pending'}>{run.status}</Badge>
          <Button variant="secondary" onClick={exportCsv}>Export CSV</Button>
          {run.status === 'draft' && <Button onClick={finalize}>Finalize &amp; mark paid</Button>}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card><SectionLabel>Total gross</SectionLabel><div className="font-display text-2xl tabular">{money(totals.gross)}</div></Card>
        <Card><SectionLabel>Total taxes withheld</SectionLabel><div className="font-display text-2xl tabular text-[var(--pending)]">{money(totals.taxes)}</div></Card>
        <Card><SectionLabel>Total net pay</SectionLabel><div className="font-display text-2xl tabular text-[var(--good)]">{money(totals.net)}</div></Card>
        <Card><SectionLabel>Employer liability</SectionLabel><div className="font-display text-2xl tabular">{money(totals.employerLiability)}</div><div className="text-xs text-[var(--muted)] mt-1">employer's cost, not withheld from pay</div></Card>
      </div>

      <Card className="!p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-[var(--muted)] border-b border-[var(--border)]">
              <th className="px-5 py-3 font-semibold">Employee</th>
              <th className="px-5 py-3 font-semibold text-right">Reg hrs</th>
              <th className="px-5 py-3 font-semibold text-right">OT hrs</th>
              <th className="px-5 py-3 font-semibold text-right">Gross</th>
              <th className="px-5 py-3 font-semibold text-right">Taxes</th>
              <th className="px-5 py-3 font-semibold text-right">Net pay</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {run.lineItems.map(l => {
              const emp = data.employees.find(e => e.id === l.employeeId);
              const isOpen = expanded === l.employeeId;
              return (
                <Fragment key={l.employeeId}>
                  <tr className="border-b border-[var(--border-soft)] hover:bg-[var(--paper)]/60 cursor-pointer" onClick={() => setExpanded(isOpen ? null : l.employeeId)}>
                    <td className="px-5 py-3 font-medium">{emp?.firstName} {emp?.lastName}</td>
                    <td className="px-5 py-3 text-right tabular">{fmtHours(l.regularHours)}</td>
                    <td className="px-5 py-3 text-right tabular">{fmtHours(l.overtimeHours)}</td>
                    <td className="px-5 py-3 text-right tabular">{money(l.grossPay)}</td>
                    <td className="px-5 py-3 text-right tabular text-[var(--pending)]">-{money(l.totalTaxes)}</td>
                    <td className="px-5 py-3 text-right tabular font-semibold">{money(l.netPay)}</td>
                    <td className="px-5 py-3 text-right text-[var(--muted)]">{isOpen ? '▲' : '▼'}</td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={7} className="px-5 pb-5 bg-[var(--paper)]/40">
                        <PayStub lineItem={l} employeeName={`${emp?.firstName} ${emp?.lastName}`} periodLabel={`${formatDate(run.periodStart)} – ${formatDate(run.periodEnd)}`} projects={data.projects} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function PayStub({ lineItem, employeeName, periodLabel, projects }: { lineItem: any; employeeName: string; periodLabel: string; projects: any[] }) {
  const l = lineItem;
  return (
    <div className="ledger-card p-5 max-w-xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="font-display text-lg">{employeeName}</div>
          <div className="text-xs text-[var(--muted)]">{periodLabel}</div>
        </div>
        <span className="stamp text-xs px-2 py-1 border-2 border-[var(--good)] text-[var(--good)] rounded">PAY STUB</span>
      </div>
      <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm mb-3">
        <Row label="Regular pay" value={money(l.grossRegularPay)} />
        <Row label="Overtime pay" value={money(l.grossOvertimePay)} />
        <Row label="Gross pay" value={money(l.grossPay)} bold />
      </div>
      <div className="border-t border-[var(--border-soft)] my-2" />
      <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm mb-3">
        <Row label="Federal withholding" value={`-${money(l.federalWithholding)}`} />
        <Row label="State withholding" value={`-${money(l.stateWithholding)}`} />
        <Row label="Social Security" value={`-${money(l.socialSecurity)}`} />
        <Row label="Medicare" value={`-${money(l.medicare)}`} />
        {l.additionalMedicare > 0 && <Row label="Additional Medicare" value={`-${money(l.additionalMedicare)}`} />}
        <Row label="Total taxes" value={`-${money(l.totalTaxes)}`} bold />
      </div>
      <div className="border-t border-[var(--border-soft)] my-2" />
      <div className="flex justify-between text-base font-semibold">
        <span>Net pay</span>
        <span className="tabular text-[var(--good)]">{money(l.netPay)}</span>
      </div>
      {l.breakdownByProject.length > 0 && (
        <div className="mt-4 pt-3 border-t border-dashed border-[var(--border)]">
          <div className="text-xs text-[var(--muted)] mb-1">Hours by project</div>
          {l.breakdownByProject.map((b: any) => {
            const proj = projects.find(p => p.id === b.projectId);
            return <Row key={String(b.projectId)} label={proj?.name ?? 'Unassigned'} value={`${fmtHours(b.hours)} hrs`} />;
          })}
        </div>
      )}
      {l.employerLiability && (
        <div className="mt-4 pt-3 border-t border-dashed border-[var(--border)]">
          <div className="text-xs text-[var(--muted)] mb-1">Employer liability (not withheld from employee's pay)</div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
            <Row label="Employer Social Security" value={money(l.employerLiability.socialSecurity)} />
            <Row label="Employer Medicare" value={money(l.employerLiability.medicare)} />
            <Row label="FUTA" value={money(l.employerLiability.futa)} />
            <Row label="SUTA" value={money(l.employerLiability.suta)} />
            <Row label="Workers' comp" value={money(l.employerLiability.workersComp)} />
            <Row label="Total employer liability" value={money(l.employerLiability.total)} bold />
          </div>
        </div>
      )}
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
