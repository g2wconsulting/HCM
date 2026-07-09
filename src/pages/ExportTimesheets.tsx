import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApp } from '../lib/AppContext';
import { Badge, Button, Card, SectionLabel } from '../components/ui';
import { formatDate, hours as fmtHours } from '../lib/format';
import { buildTimesheetRangePdf, pdfFileName, shareOrDownloadPdf } from '../lib/pdfExport';

export function ExportTimesheets() {
  const [params] = useSearchParams();
  const { data, company } = useApp();
  const employeeId = params.get('employeeId') ?? '';
  const start = params.get('start') ?? '';
  const end = params.get('end') ?? '';
  const [status, setStatus] = useState<string | null>(null);

  const employee = data.employees.find(e => e.id === employeeId);

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
          <Button onClick={shareOrEmail}>Share / Email PDF</Button>
        </div>
      </div>

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

      <p className="text-xs text-[var(--muted)]">
        The PDF includes each week's hours by project, any in-app signatures already captured, and a blank
        signature block at the end for external e-signature if you're sending this out for a fresh signature.
      </p>
    </div>
  );
}
