// Aggregates finalized payroll runs into the figures Form 941 (Employer's
// Quarterly Federal Tax Return) asks for. This is a computation aid, not
// a filing mechanism — see the disclaimer rendered with it in the UI/PDF.
// Actually transmitting a return to the IRS requires either paper filing
// or an IRS-authorized e-file path; this app does neither.

import type { PayrollRun } from './types';
import { FICA } from './taxEngine';

export interface QuarterlySummary {
  year: number;
  quarter: 1 | 2 | 3 | 4;
  quarterStart: string;
  quarterEnd: string;
  employeeCount: number; // distinct employees paid during the quarter
  totalWages: number; // Line 2
  federalIncomeTaxWithheld: number; // Line 3
  socialSecurityWages: number; // Line 5a, column 1 (back-derived from tax withheld)
  socialSecurityTax: number; // Line 5a, column 2 (employee + employer, i.e. withheld x2)
  medicareWages: number; // Line 5c, column 1
  medicareTax: number; // Line 5c, column 2 (employee + employer)
  additionalMedicareTax: number; // Line 5d (employee-only, no employer match)
  totalTaxesBeforeAdjustments: number; // Line 6
  runsIncluded: { id: string; periodStart: string; periodEnd: string; payDate: string }[];
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function computeQuarterlySummary(payrollRuns: PayrollRun[], year: number, quarter: 1 | 2 | 3 | 4): QuarterlySummary {
  const startMonth = (quarter - 1) * 3;
  const quarterStart = new Date(year, startMonth, 1);
  const quarterEnd = new Date(year, startMonth + 3, 0);
  const inRange = (iso: string) => {
    const d = new Date(iso + 'T00:00:00');
    return d >= quarterStart && d <= quarterEnd;
  };

  const runs = payrollRuns.filter(r => r.status === 'finalized' && inRange(r.payDate));

  const employeeIds = new Set<string>();
  let totalWages = 0, federalIncomeTaxWithheld = 0, ssWithheld = 0, medicareWithheld = 0, addlMedicare = 0;
  for (const run of runs) {
    for (const l of run.lineItems) {
      if (l.grossPay <= 0) continue;
      employeeIds.add(l.employeeId);
      totalWages += l.grossPay;
      federalIncomeTaxWithheld += l.federalWithholding;
      ssWithheld += l.socialSecurity;
      medicareWithheld += l.medicare;
      addlMedicare += l.additionalMedicare;
    }
  }

  const socialSecurityTax = round2(ssWithheld * 2);
  const medicareTax = round2(medicareWithheld * 2);
  const socialSecurityWages = round2(ssWithheld / FICA.socialSecurityRate);
  const medicareWages = round2(medicareWithheld / FICA.medicareRate);
  const totalTaxesBeforeAdjustments = round2(federalIncomeTaxWithheld + socialSecurityTax + medicareTax + addlMedicare);

  return {
    year, quarter,
    quarterStart: quarterStart.toISOString().slice(0, 10), quarterEnd: quarterEnd.toISOString().slice(0, 10),
    employeeCount: employeeIds.size,
    totalWages: round2(totalWages),
    federalIncomeTaxWithheld: round2(federalIncomeTaxWithheld),
    socialSecurityWages, socialSecurityTax, medicareWages, medicareTax,
    additionalMedicareTax: round2(addlMedicare),
    totalTaxesBeforeAdjustments,
    runsIncluded: runs.map(r => ({ id: r.id, periodStart: r.periodStart, periodEnd: r.periodEnd, payDate: r.payDate })),
  };
}
