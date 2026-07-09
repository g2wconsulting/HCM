import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Company, Employee, Project, PayrollLineItem, SignatureRecord, Timesheet } from './types';
import { formatDate, money } from './format';

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

function textRow(doc: jsPDF, x: number, y: number, w: number, label: string, value: string, bold = false) {
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.text(label, x, y);
  doc.text(value, x + w, y, { align: 'right' });
}

export function buildPayStubPdf(params: {
  companyName: string;
  employeeName: string;
  periodLabel: string;
  payDate: string;
  lineItem: PayrollLineItem;
  projects: Project[];
}): jsPDF {
  const { companyName, employeeName, periodLabel, payDate, lineItem: l, projects } = params;
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const marginX = 48;
  const colW = 300;
  let y = 56;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(companyName || 'Pay Stub', marginX, y);
  doc.setFontSize(10);
  doc.text('PAY STUB', marginX + colW * 2 - 60, y);
  y += 22;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(60);
  doc.text(employeeName, marginX, y);
  y += 15;
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(`${periodLabel} · Pay date ${formatDate(payDate)}`, marginX, y);
  doc.setTextColor(20);
  y += 26;

  doc.setFontSize(10);
  textRow(doc, marginX, y, colW, 'Regular pay', money(l.grossRegularPay)); y += 16;
  textRow(doc, marginX, y, colW, 'Overtime pay', money(l.grossOvertimePay)); y += 16;
  textRow(doc, marginX, y, colW, 'Gross pay', money(l.grossPay), true); y += 20;

  doc.setDrawColor(210);
  doc.line(marginX, y - 10, marginX + colW, y - 10);

  textRow(doc, marginX, y, colW, 'Federal withholding', `-${money(l.federalWithholding)}`); y += 16;
  textRow(doc, marginX, y, colW, 'State withholding', `-${money(l.stateWithholding)}`); y += 16;
  textRow(doc, marginX, y, colW, 'Social Security', `-${money(l.socialSecurity)}`); y += 16;
  textRow(doc, marginX, y, colW, 'Medicare', `-${money(l.medicare)}`); y += 16;
  if (l.additionalMedicare > 0) { textRow(doc, marginX, y, colW, 'Additional Medicare', `-${money(l.additionalMedicare)}`); y += 16; }
  textRow(doc, marginX, y, colW, 'Total taxes', `-${money(l.totalTaxes)}`, true); y += 22;

  doc.line(marginX, y - 12, marginX + colW, y - 12);
  doc.setFontSize(13);
  textRow(doc, marginX, y, colW, 'Net pay', money(l.netPay), true);
  y += 30;

  if (l.breakdownByProject.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text('HOURS BY PROJECT', marginX, y);
    doc.setTextColor(20);
    y += 14;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    for (const b of l.breakdownByProject) {
      const proj = projects.find(p => p.id === b.projectId);
      textRow(doc, marginX, y, colW, proj?.name ?? 'Unassigned', `${b.hours.toFixed(2)} hrs`);
      y += 14;
    }
  }

  return doc;
}

export interface W2Data {
  year: number;
  employeeName: string;
  ssn?: string;
  employeeAddress: { line1?: string; line2?: string; city?: string; state?: string; zip?: string };
  companyName: string;
  ein?: string;
  companyAddress?: string;
  stateWithholdingAccountNumber?: string;
  stateUnemploymentAccountNumber?: string;
  wages: number;
  federalWithholding: number;
  stateWithholding: number;
  socialSecurityWages: number;
  socialSecurityTax: number;
  medicareWages: number;
  medicareTax: number;
}

export function buildW2Pdf(w: W2Data): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const marginX = 48;
  let y = 56;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(`${w.year} Wage and Tax Statement`, marginX, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text('Informational summary — not a laser-printed, SSA-approved substitute Form W-2. For official filing,', marginX, y);
  y += 12;
  doc.text('run these totals through a certified W-2 vendor or payroll tax service.', marginX, y);
  doc.setTextColor(20);
  y += 28;

  const employeeAddr = [w.employeeAddress.line1, w.employeeAddress.line2, [w.employeeAddress.city, w.employeeAddress.state, w.employeeAddress.zip].filter(Boolean).join(', ')]
    .filter(Boolean).join('\n');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Employer', marginX, y);
  doc.text('Employee', marginX + 300, y);
  y += 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text([w.companyName, w.companyAddress ?? '', w.ein ? `EIN: ${w.ein}` : ''].filter(Boolean), marginX, y);
  doc.text([w.employeeName, employeeAddr, w.ssn ? `SSN: ${w.ssn}` : ''].filter(Boolean), marginX + 300, y);
  y += 60;

  if (w.stateWithholdingAccountNumber || w.stateUnemploymentAccountNumber) {
    doc.setFontSize(9);
    doc.setTextColor(110);
    if (w.stateWithholdingAccountNumber) { doc.text(`State withholding account #: ${w.stateWithholdingAccountNumber}`, marginX, y); y += 12; }
    if (w.stateUnemploymentAccountNumber) { doc.text(`State unemployment account #: ${w.stateUnemploymentAccountNumber}`, marginX, y); y += 12; }
    doc.setTextColor(20);
    y += 10;
  }

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    head: [['Box', 'Description', 'Amount']],
    body: [
      ['1', 'Wages, tips, other compensation', money(w.wages)],
      ['2', 'Federal income tax withheld', money(w.federalWithholding)],
      ['3', 'Social Security wages', money(w.socialSecurityWages)],
      ['4', 'Social Security tax withheld', money(w.socialSecurityTax)],
      ['5', 'Medicare wages and tips', money(w.medicareWages)],
      ['6', 'Medicare tax withheld', money(w.medicareTax)],
      ['16', 'State wages, tips, etc.', money(w.wages)],
      ['17', 'State income tax withheld', money(w.stateWithholding)],
    ],
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [33, 29, 24], textColor: 255 },
    columnStyles: { 0: { cellWidth: 40 }, 2: { halign: 'right', cellWidth: 90 } },
  });

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
