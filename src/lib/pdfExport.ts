import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Company, Employee, Project, Timesheet } from './types';
import { formatDate } from './format';

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
