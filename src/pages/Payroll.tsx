import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../lib/AppContext';
import { Badge, Button, Card, SectionLabel } from '../components/ui';
import { formatDate, money } from '../lib/format';
import { computePayrollLineItem, computeYtdGrossBeforeRun } from '../lib/payroll';

export function Payroll() {
  const { data, addPayrollRun, company } = useApp();
  const navigate = useNavigate();
  const [payDate, setPayDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 5);
    return d.toISOString().slice(0, 10);
  });

  const approvedTimesheets = data.timesheets.filter(t => t.status === 'approved');
  const unpaidApproved = approvedTimesheets; // simplification: any approved & not yet in a run

  const eligibleEmployeeIds = useMemo(() => Array.from(new Set(unpaidApproved.map(t => t.employeeId))), [unpaidApproved]);

  async function createRun() {
    if (eligibleEmployeeIds.length === 0) return;
    const relevantTs = unpaidApproved;
    const periodStart = relevantTs.reduce((min, t) => t.weekStartDate < min ? t.weekStartDate : min, relevantTs[0].weekStartDate);
    const periodEnd = relevantTs.reduce((max, t) => t.weekEndDate > max ? t.weekEndDate : max, relevantTs[0].weekEndDate);

    const lineItems = eligibleEmployeeIds.map(empId => {
      const employee = data.employees.find(e => e.id === empId)!;
      const empTimesheets = relevantTs.filter(t => t.employeeId === empId);
      const ytd = computeYtdGrossBeforeRun(empId, data.payrollRuns);
      return computePayrollLineItem({ employee, company, timesheets: empTimesheets, ytdGrossBeforeThisPeriod: ytd });
    });

    const created = await addPayrollRun({
      companyId: data.currentCompanyId!, periodStart, periodEnd, payDate,
      status: 'draft', lineItems,
    } as any);
    if (created) navigate(`/payroll/${created.id}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Payroll</h1>
        <p className="text-[var(--ink-soft)] mt-1">Turn approved timesheets into a biweekly pay run.</p>
      </div>

      <Card>
        <SectionLabel>Start a new run</SectionLabel>
        {eligibleEmployeeIds.length === 0 ? (
          <p className="text-sm text-[var(--muted)] mt-2">No approved, unpaid timesheets yet. Approve timesheets first.</p>
        ) : (
          <div className="flex items-center justify-between mt-2">
            <div className="text-sm text-[var(--ink-soft)]">
              <strong className="text-[var(--ink)]">{eligibleEmployeeIds.length}</strong> employee{eligibleEmployeeIds.length !== 1 ? 's' : ''} with approved timesheets ready to pay.
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm text-[var(--muted)]">Pay date</label>
              <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className="focus-ring rounded-md border border-[var(--border)] px-3 py-1.5 text-sm" />
              <Button onClick={createRun}>Calculate payroll →</Button>
            </div>
          </div>
        )}
      </Card>

      <Card className="!p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-[var(--muted)] border-b border-[var(--border)]">
              <th className="px-5 py-3 font-semibold">Period</th>
              <th className="px-5 py-3 font-semibold">Pay date</th>
              <th className="px-5 py-3 font-semibold text-right">Employees</th>
              <th className="px-5 py-3 font-semibold text-right">Gross</th>
              <th className="px-5 py-3 font-semibold text-right">Net</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {[...data.payrollRuns].sort((a, b) => b.periodEnd.localeCompare(a.periodEnd)).map(run => (
              <tr key={run.id} className="border-b border-[var(--border-soft)] last:border-0 hover:bg-[var(--paper)]/60">
                <td className="px-5 py-3">{formatDate(run.periodStart)} – {formatDate(run.periodEnd)}</td>
                <td className="px-5 py-3 text-[var(--ink-soft)]">{formatDate(run.payDate)}</td>
                <td className="px-5 py-3 text-right tabular">{run.lineItems.length}</td>
                <td className="px-5 py-3 text-right tabular">{money(run.lineItems.reduce((s, l) => s + l.grossPay, 0))}</td>
                <td className="px-5 py-3 text-right tabular">{money(run.lineItems.reduce((s, l) => s + l.netPay, 0))}</td>
                <td className="px-5 py-3"><Badge tone={run.status === 'finalized' ? 'good' : 'pending'}>{run.status}</Badge></td>
                <td className="px-5 py-3 text-right"><Link to={`/payroll/${run.id}`} className="focus-ring text-[var(--accent)] font-medium hover:underline">Open →</Link></td>
              </tr>
            ))}
            {data.payrollRuns.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-[var(--muted)]">No payroll runs yet.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
