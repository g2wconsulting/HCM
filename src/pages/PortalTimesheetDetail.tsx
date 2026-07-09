import { Link, useParams } from 'react-router-dom';
import { useState } from 'react';
import { useApp } from '../lib/AppContext';
import { Button, Card, SectionLabel } from '../components/ui';
import { formatDate, hours as fmtHours, exportTimesheetCsv } from '../lib/format';
import { SignaturePad, SignaturePreview } from '../components/SignaturePad';

export function PortalTimesheetDetail() {
  const { id } = useParams();
  const { data, updateTimesheet } = useApp();
  const ts = data.timesheets.find(t => t.id === id);
  const employee = data.employees.find(e => e.id === ts?.employeeId);
  const [showSign, setShowSign] = useState(false);

  if (!ts || !employee) {
    return <div><p className="text-[var(--muted)]">Not found.</p><Link to="/portal/timesheets" className="text-[var(--accent)] underline">Back</Link></div>;
  }

  const myProjectIds = new Set(data.projects.map(p => p.id));
  const relevantEntries = ts.entries.filter(e => e.projectId && myProjectIds.has(e.projectId));
  const total = relevantEntries.reduce((s, e) => s + e.hours, 0);

  function approve(sig: any) {
    updateTimesheet(ts!.id, { clientApproval: sig, clientApprovedAt: new Date().toISOString() });
    setShowSign(false);
  }

  return (
    <div className="space-y-6">
      <Link to="/portal/timesheets" className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">← Timesheets</Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl">{employee.firstName} {employee.lastName}</h1>
          <p className="text-[var(--ink-soft)] mt-1">Week of {formatDate(ts.weekStartDate)} – {formatDate(ts.weekEndDate)}</p>
        </div>
        <Button variant="secondary" onClick={() => exportTimesheetCsv({ timesheet: ts, employeeName: `${employee.firstName} ${employee.lastName}`, employeeLastName: employee.lastName, projects: data.projects })}>
          Export CSV
        </Button>
      </div>

      <Card className="!p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-xs uppercase tracking-wide text-[var(--muted)]">
              <th className="px-4 py-3 text-left font-semibold">Date</th>
              <th className="px-4 py-3 text-left font-semibold">Project</th>
              <th className="px-4 py-3 text-right font-semibold">Hours</th>
            </tr>
          </thead>
          <tbody>
            {relevantEntries.map(e => {
              const proj = data.projects.find(p => p.id === e.projectId);
              return (
                <tr key={e.id} className="border-b border-[var(--border-soft)] last:border-0">
                  <td className="px-4 py-2.5">{formatDate(e.date)}</td>
                  <td className="px-4 py-2.5">{proj?.name}</td>
                  <td className="px-4 py-2.5 text-right tabular">{fmtHours(e.hours)}</td>
                </tr>
              );
            })}
            <tr className="bg-[var(--paper)]">
              <td className="px-4 py-2.5 font-semibold" colSpan={2}>Total</td>
              <td className="px-4 py-2.5 text-right tabular font-semibold">{fmtHours(total)}</td>
            </tr>
          </tbody>
        </table>
      </Card>

      <Card>
        <SectionLabel>Approval</SectionLabel>
        {ts.clientApproval ? (
          <SignaturePreview sig={ts.clientApproval} />
        ) : (
          <p className="text-sm text-[var(--muted)]">Not yet approved by you.</p>
        )}
      </Card>

      {showSign && <SignaturePad defaultName="" requireTitle onSign={approve} onCancel={() => setShowSign(false)} />}

      {!ts.clientApprovedAt && !showSign && (
        <Button onClick={() => setShowSign(true)}>Approve &amp; sign</Button>
      )}
    </div>
  );
}
