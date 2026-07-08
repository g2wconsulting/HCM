export function money(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function hours(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}

export function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateShort(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function downloadCsv(filename: string, rows: (string | number)[][]): void {
  const csv = rows.map(row => row.map(cell => {
    const s = String(cell ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename);
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function initials(first: string, last: string): string {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
}

export function exportTimesheetCsv(params: {
  timesheet: { weekStartDate: string; weekEndDate: string; status: string; entries: { date: string; projectId: string | null; hours: number }[] };
  employeeName: string;
  employeeLastName: string;
  projects: { id: string; name: string }[];
}): void {
  const { timesheet: ts, employeeName, employeeLastName, projects } = params;
  const rows: (string | number)[][] = [
    ['Employee', employeeName],
    ['Week', `${formatDate(ts.weekStartDate)} - ${formatDate(ts.weekEndDate)}`],
    ['Status', ts.status],
    [],
    ['Date', 'Project', 'Hours'],
  ];
  ts.entries.forEach(e => {
    const proj = projects.find(p => p.id === e.projectId);
    rows.push([formatDate(e.date), proj?.name ?? 'Unassigned', e.hours]);
  });
  const total = ts.entries.reduce((s, e) => s + e.hours, 0);
  rows.push([]);
  rows.push(['Total hours', '', total]);
  downloadCsv(`timesheet-${employeeLastName}-${ts.weekStartDate}.csv`, rows);
}
