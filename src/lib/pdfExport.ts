import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Company, Employee, Project, SignatureRecord, Timesheet } from './types';
import { formatDate } from './format';

// jsPDF only ships core fonts (helvetica/times/courier) — it can't load the
// web fonts SignaturePad's typed mode uses (Fraunces, IBM Plex Mono,
// cursive), so we approximate: monospace-flavored fonts render as courier,
// everything else (serif/cursive) renders as an italic serif.
function typedSignatureFont(typedFont?: string): [string, string] {
  return typedFont?.toLowerCase().includes('mono') ? ['courier', 'normal'] : ['times', 'italic'];
}

/** Draws one signer's block (label, rendered signature, name/title/date) inside a column of width `w` starting at (x, y). Returns the block's height. */
function drawSignatureBlock(doc: jsPDF, x: number, y: number, w: number, label: string, sig?: SignatureRecord): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(label.toUpperCase(), x, y);
  doc.setTextColor(20);

  if (!sig) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.text('Not yet signed', x, y + 14);
    doc.setTextColor(20);
    return 24;
  }

  let cursorY = y + 8;
  if (sig.method === 'typed') {
    const [font, style] = typedSignatureFont(sig.typedFont);
    doc.setFont(font, style);
    doc.setFontSize(16);
    doc.text(sig.name, x, cursorY + 10);
    cursorY += 16;
  } else if (sig.dataUrl) {
    const maxW = Math.min(w, 130);
    const maxH = 32;
    const props = doc.getImageProperties(sig.dataUrl);
    const ratio = Math.min(maxW / props.width, maxH / props.height);
    const iw = props.width * ratio;
    const ih = props.height * ratio;
    doc.addImage(sig.dataUrl, props.fileType, x, cursorY, iw, ih);
    cursorY += ih + 4;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(110);
  const meta = [sig.name, sig.title, `Signed ${new Date(sig.signedAt).toLocaleDateString()}`].filter(Boolean).join(' · ');
  doc.text(meta, x, cursorY + 6);
  doc.setTextColor(20);
  return cursorY + 6 - y + 6;
}

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
    y = doc.lastAutoTable.finalY + 18;

    if (y > 620) { doc.addPage(); y = 56; }

    const colGap = 20;
    const colW = (doc.internal.pageSize.getWidth() - marginX * 2 - colGap) / 2;
    const empHeight = drawSignatureBlock(doc, marginX, y, colW, 'Employee', ts.employeeSignature);
    const apprHeight = drawSignatureBlock(doc, marginX + colW + colGap, y, colW, 'Approver', ts.approverSignature);
    y += Math.max(empHeight, apprHeight);

    if (ts.clientApproval) {
      y += 6;
      y += drawSignatureBlock(doc, marginX, y, colW * 2 + colGap, 'External / client approval', ts.clientApproval);
    }

    y += idx < timesheets.length - 1 ? 16 : 8;
  });

  if (y > 650) { doc.addPage(); y = 56; }
  y += 20;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`Total hours for period: ${grandTotal.toFixed(2)}`, marginX, y);
  y += 30;

  const anyUnsigned = timesheets.some(ts => !ts.employeeSignature || !ts.approverSignature);
  if (anyUnsigned) {
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
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(90);
    doc.text('All timesheets in this period have been signed as shown above.', marginX, y);
    doc.setTextColor(20);
  }

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
