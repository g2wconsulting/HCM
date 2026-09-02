import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Company, Employee, Project, Timesheet } from './types';
import { formatDate, initials, money } from './format';
import { formatTimeLabel } from './timesheetParser';
import type { QuarterlySummary } from './quarterlyTax';

export function buildTimesheetRangePdf(params: {
  company: Company;
  employee: Employee;
  timesheets: Timesheet[]; // already filtered/sorted by weekStartDate
  projects: Project[];
  rangeStart: string;
  rangeEnd: string;
}): jsPDF {
  const { company, employee, timesheets, projects, rangeStart, rangeEnd } = params;
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const marginX = 48;
  let y = 56;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(company.name || 'Timesheet Report', marginX, y);
  y += 20;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(`${employee.firstName} ${employee.lastName} — ${employee.title || ''}`.trim(), marginX, y);
  y += 14;
  doc.text(`Period: ${formatDate(rangeStart)} – ${formatDate(rangeEnd)}`, marginX, y);
  y += 24;
  doc.setTextColor(20);

  let grandTotal = 0;

  timesheets.forEach((ts, idx) => {
    if (y > 680) { doc.addPage(); y = 56; }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`Week of ${formatDate(ts.weekStartDate)} – ${formatDate(ts.weekEndDate)}`, marginX, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(`Status: ${ts.status}`, marginX + 260, y);
    doc.setTextColor(20);
    y += 8;

    const body = ts.entries
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(e => {
        const proj = projects.find(p => p.id === e.projectId);
        return [formatDate(e.date), proj?.name ?? 'Unassigned', e.hours.toFixed(2)];
      });
    const weekTotal = ts.entries.reduce((s, e) => s + e.hours, 0);
    grandTotal += weekTotal;
    body.push(['', 'Week total', weekTotal.toFixed(2)]);

    autoTable(doc, {
      startY: y + 6,
      margin: { left: marginX, right: marginX },
      head: [['Date', 'Project', 'Hours']],
      body,
      styles: { fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: [33, 29, 24], textColor: 255 },
      columnStyles: { 2: { halign: 'right', cellWidth: 70 } },
      didParseCell: (data) => {
        if (data.row.index === body.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [242, 239, 230];
        }
      },
    });

    // @ts-expect-error - jspdf-autotable attaches this to the doc instance
    y = doc.lastAutoTable.finalY + 24;

    const empSig = ts.employeeSignature ? `Signed by ${ts.employeeSignature.name} on ${new Date(ts.employeeSignature.signedAt).toLocaleDateString()}` : 'Not yet signed';
    const apprSig = ts.approverSignature ? `Approved by ${ts.approverSignature.name} on ${new Date(ts.approverSignature.signedAt).toLocaleDateString()}` : 'Not yet approved';
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Employee: ${empSig}    |    Manager: ${apprSig}`, marginX, y);
    doc.setTextColor(20);
    y += idx < timesheets.length - 1 ? 20 : 8;
  });

  if (y > 650) { doc.addPage(); y = 56; }
  y += 20;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`Total hours for period: ${grandTotal.toFixed(2)}`, marginX, y);
  y += 40;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text('This document may be signed below to confirm accuracy for the full period covered.', marginX, y);
  y += 30;

  doc.line(marginX, y, marginX + 220, y);
  doc.text('Employee signature', marginX, y + 12);
  doc.line(marginX + 260, y, marginX + 420, y);
  doc.text('Date', marginX + 260, y + 12);
  y += 46;

  doc.line(marginX, y, marginX + 220, y);
  doc.text('Approved by', marginX, y + 12);
  doc.line(marginX + 260, y, marginX + 420, y);
  doc.text('Date', marginX + 260, y + 12);

  return doc;
}

export function pdfFileName(employee: Employee, rangeStart: string, rangeEnd: string): string {
  return `timesheets-${employee.lastName}-${rangeStart}-to-${rangeEnd}.pdf`;
}

function sanitizeFilename(s: string): string {
  return s.replace(/[/\\:*?"<>|]/g, '').trim();
}

function mmddyy(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}.${dd}.${yy}`;
}

/** "FirstName LastName Timesheet MM.DD.YY-MM.DD.YY.pdf", sanitized for
 * characters invalid in filenames. */
export function timecardPdfFileName(employee: { firstName: string; lastName: string }, weekStartDate: string, weekEndDate: string): string {
  const name = sanitizeFilename(`${employee.firstName} ${employee.lastName}`);
  return `${name} Timesheet ${mmddyy(weekStartDate)}-${mmddyy(weekEndDate)}.pdf`;
}

/** Renders one uploaded timecard as a one-page PDF matching the G2W
 * Consulting sample layout: header, employee block, regular hours, a
 * Daily Time Entries table (multi-punch days show a dotted separator
 * between punches, the date is never repeated), a Job Code & Allocation
 * Summary table, and Employee Verification / Supervisor Approval blocks
 * with signature + date once signed. No navigation/admin chrome — built
 * entirely from data, not a DOM screenshot, so it works the same in
 * Vercel production as it does locally. */
export function buildTimecardPdf(params: { company: Company; employee: Employee; timesheet: Timesheet }): jsPDF {
  const { company, employee, timesheet: ts } = params;
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const marginX = 40;
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 44;

  // Monogram
  doc.setFillColor(168, 97, 31); // --accent
  doc.circle(marginX + 16, y, 16, 'F');
  doc.setTextColor(255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(initials(employee.firstName, employee.lastName), marginX + 16, y + 4, { align: 'center' });

  doc.setTextColor(20);
  doc.setFontSize(18);
  doc.text('TIMECARD', marginX + 42, y - 2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(company.name || 'G2W Consulting', marginX + 42, y + 14);
  doc.setTextColor(20);
  y += 40;

  doc.setDrawColor(220);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 20;

  const empName = ts.employeeNameSnapshot || `${employee.firstName} ${employee.lastName}`;
  const empNumber = ts.employeeNumberSnapshot || employee.employeeNumber || '—';
  const colWidth = (pageWidth - marginX * 2) / 3;
  const fields: [string, string][] = [
    ['EMPLOYEE', empName],
    ['EMPLOYEE ID', empNumber],
    ['PAY PERIOD', `${formatDate(ts.weekStartDate)} – ${formatDate(ts.weekEndDate)}`],
  ];
  fields.forEach(([label, value], i) => {
    const x = marginX + i * colWidth;
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(label, x, y);
    doc.setFontSize(11);
    doc.setTextColor(20);
    doc.setFont('helvetica', 'bold');
    doc.text(value, x, y + 15);
    doc.setFont('helvetica', 'normal');
  });
  y += 20;
  doc.setFontSize(8);
  doc.setTextColor(140);
  doc.text('REGULAR HOURS', marginX, y + 20);
  doc.setFontSize(14);
  doc.setTextColor(168, 97, 31);
  doc.setFont('helvetica', 'bold');
  doc.text(`${(ts.regularHours ?? 0).toFixed(2)} HRS`, marginX, y + 35);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(20);
  y += 50;

  const entries = (ts.dailyEntries ?? []).slice().sort((a, b) => a.date.localeCompare(b.date));
  const body = entries.map(d => {
    const dateLabel = `${d.dayOfWeek}\n${formatDate(d.date)}`;
    let timeLabel = '—';
    if (d.punches.length > 0) {
      const lines: string[] = [];
      d.punches.forEach((p, i) => {
        if (i > 0) lines.push('· · · · · · · · · · · · ·');
        lines.push(`${formatTimeLabel(p.in)} – ${formatTimeLabel(p.out)}`);
      });
      timeLabel = lines.join('\n');
    }
    const jobLabel = d.status === 'WORK' && (d.jobCode || d.positionTitle)
      ? `${d.jobCode ?? ''}${d.jobCode && d.positionTitle ? '\n' : ''}${d.positionTitle ?? ''}`
      : '—';
    return [dateLabel, d.status, timeLabel, jobLabel, d.hours.toFixed(2)];
  });

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    head: [['DATE & DAY', 'STATUS', 'TIME IN / OUT', 'JOB CODE & POSITION', 'HOURS']],
    body,
    styles: { fontSize: 8.5, cellPadding: 5, valign: 'middle' },
    headStyles: { fillColor: [33, 29, 24], textColor: 255, fontSize: 7.5 },
    columnStyles: { 4: { halign: 'right', cellWidth: 50 } },
  });
  // @ts-expect-error - jspdf-autotable attaches this to the doc instance
  y = doc.lastAutoTable.finalY + 26;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('JOB CODE & ALLOCATION SUMMARY', marginX, y);
  y += 10;

  const summaryBody = (ts.jobCodeSummary ?? []).map(r => [
    r.department, r.jobCode, r.positionTitle, r.hours.toFixed(2), r.programs.toFixed(2), `${r.total.toFixed(2)} HRS`,
  ]);
  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    head: [['DEPARTMENT / PROJECT', 'JOB CODE', 'POSITION TITLE', 'HOURS', 'PROGRAMS', 'TOTAL']],
    body: summaryBody,
    styles: { fontSize: 8.5, cellPadding: 5 },
    headStyles: { fillColor: [33, 29, 24], textColor: 255, fontSize: 7.5 },
    columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
  });
  // @ts-expect-error
  y = doc.lastAutoTable.finalY + 28;

  const blockWidth = (pageWidth - marginX * 2 - 20) / 2;
  function approvalBlock(x: number, title: string, certifyText: string, sig?: { dataUrl?: string; name: string }, signedAt?: string) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(20);
    doc.text(title, x, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(110);
    const wrapped = doc.splitTextToSize(certifyText, blockWidth);
    doc.text(wrapped, x, y + 12);
    const afterText = y + 12 + wrapped.length * 9 + 12;
    doc.setDrawColor(180);
    doc.line(x, afterText, x + blockWidth, afterText);
    doc.setFontSize(7.5);
    doc.setTextColor(140);
    doc.text('Signature', x, afterText + 10);
    doc.text('Date', x + blockWidth - 90, afterText + 10);
    if (sig) {
      doc.setTextColor(20);
      if (sig.dataUrl) {
        try { doc.addImage(sig.dataUrl, 'PNG', x, afterText - 26, 100, 24); } catch { /* unsupported image, skip */ }
      } else {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(12);
        doc.text(sig.name, x, afterText - 6);
        doc.setFont('helvetica', 'normal');
      }
      if (signedAt) doc.text(new Date(signedAt).toLocaleDateString(), x + blockWidth - 90, afterText - 6);
    }
  }

  approvalBlock(
    marginX, 'EMPLOYEE VERIFICATION',
    'I certify that the hours logged above accurately represent the hours worked during this pay period.',
    ts.employeeSignature ? { dataUrl: ts.employeeSignature.dataUrl, name: ts.employeeSignature.name } : undefined,
    ts.employeeSignedAt,
  );
  approvalBlock(
    marginX + blockWidth + 20, 'SUPERVISOR APPROVAL',
    'I verify that the hours reported above are correct and approved for processing and billing.',
    ts.supervisorSignature ? { dataUrl: ts.supervisorSignature.dataUrl, name: ts.supervisorSignature.name } : undefined,
    ts.supervisorSignedAt,
  );

  return doc;
}

export async function shareOrDownloadPdf(doc: jsPDF, filename: string, shareText: string): Promise<'shared' | 'downloaded'> {
  const blob = doc.output('blob');
  const file = new File([blob], filename, { type: 'application/pdf' });

  const nav = navigator as Navigator & { canShare?: (data: any) => boolean; share?: (data: any) => Promise<void> };
  if (nav.canShare && nav.share && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: filename, text: shareText });
      return 'shared';
    } catch {
      // user cancelled or share failed — fall through to download
    }
  }
  doc.save(filename);
  return 'downloaded';
}

/** A one-page worksheet of the figures Form 941 asks for, computed from
 * this company's finalized payroll runs for the quarter. This is a
 * computation aid to speed up manually preparing/filing the real return —
 * it is not the official IRS form and this app does not file or transmit
 * anything to the IRS. Every page carries that disclaimer prominently. */
export function buildQuarterlyTaxSummaryPdf(params: { company: Company; summary: QuarterlySummary }): jsPDF {
  const { company, summary: s } = params;
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const marginX = 48;
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 56;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(company.name || 'Quarterly Federal Tax Summary', marginX, y);
  y += 20;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(90);
  doc.text(`Quarterly Federal Tax Summary — Q${s.quarter} ${s.year} (${formatDate(s.quarterStart)} – ${formatDate(s.quarterEnd)})`, marginX, y);
  y += 22;
  doc.setTextColor(20);

  doc.setFillColor(255, 245, 225);
  doc.setDrawColor(230, 190, 130);
  const boxH = 46;
  doc.roundedRect(marginX, y, pageWidth - marginX * 2, boxH, 4, 4, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('NOT AN OFFICIAL IRS FORM', marginX + 10, y + 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const disclaimer = doc.splitTextToSize(
    'This is a worksheet computed from payroll runs finalized in this app, matching Form 941 line numbering to speed up preparing the real return. Verify every figure — including current-year IRS Pub 15 rates/wage bases — before filing. This app does not e-file or transmit anything to the IRS or any state agency.',
    pageWidth - marginX * 2 - 20,
  );
  doc.text(disclaimer, marginX + 10, y + 28);
  y += boxH + 26;

  const rows: [string, string, string][] = [
    ['1', 'Number of employees who received wages this quarter', String(s.employeeCount)],
    ['2', 'Wages, tips, and other compensation', money(s.totalWages)],
    ['3', 'Federal income tax withheld', money(s.federalIncomeTaxWithheld)],
    ['5a', 'Taxable Social Security wages (col. 1) / tax at 12.4% (col. 2)', `${money(s.socialSecurityWages)} / ${money(s.socialSecurityTax)}`],
    ['5c', 'Taxable Medicare wages (col. 1) / tax at 2.9% (col. 2)', `${money(s.medicareWages)} / ${money(s.medicareTax)}`],
    ['5d', 'Additional Medicare tax withheld (employee-only, 0.9%)', money(s.additionalMedicareTax)],
    ['6', 'Total taxes before adjustments (3 + 5a + 5c + 5d)', money(s.totalTaxesBeforeAdjustments)],
  ];

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    head: [['Line', 'Description', 'Amount']],
    body: rows,
    styles: { fontSize: 9.5, cellPadding: 6 },
    headStyles: { fillColor: [33, 29, 24], textColor: 255 },
    columnStyles: { 0: { cellWidth: 36 }, 2: { halign: 'right', cellWidth: 170 } },
    didParseCell: (data) => {
      if (data.row.index === rows.length - 1) { data.cell.styles.fontStyle = 'bold'; data.cell.styles.fillColor = [242, 239, 230]; }
    },
  });
  // @ts-expect-error - jspdf-autotable attaches this to the doc instance
  y = doc.lastAutoTable.finalY + 24;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Payroll runs included', marginX, y);
  y += 8;
  autoTable(doc, {
    startY: y + 6,
    margin: { left: marginX, right: marginX },
    head: [['Pay date', 'Period']],
    body: s.runsIncluded.map(r => [formatDate(r.payDate), `${formatDate(r.periodStart)} – ${formatDate(r.periodEnd)}`]),
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [33, 29, 24], textColor: 255 },
  });
  if (s.runsIncluded.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text('No finalized payroll runs fall within this quarter.', marginX, y + 20);
  }

  return doc;
}
