import type { Employee, Timesheet, PayrollLineItem, Company, PayrollRun } from './types';
import { computeFederalWithholding, computeStateWithholding, computeFica } from './taxEngine';

function rateForProject(employee: Employee, projectId: string | null): number {
  if (projectId) {
    const specific = employee.rates.find(r => r.projectId === projectId);
    if (specific) return specific.hourlyRate;
  }
  return employee.defaultHourlyRate;
}

/** Splits a set of daily hours (already grouped per timesheet week) into
 * regular vs overtime using a weekly threshold, then allocates the split
 * proportionally across the projects worked that week (for reporting). */
function splitRegularOvertime(totalWeekHours: number, threshold: number) {
  const regular = Math.min(totalWeekHours, threshold);
  const overtime = Math.max(0, totalWeekHours - threshold);
  return { regular, overtime };
}

export function computeYtdGrossBeforeRun(
  employeeId: string,
  allPriorFinalizedRuns: PayrollRun[],
): number {
  let total = 0;
  for (const run of allPriorFinalizedRuns) {
    if (run.status !== 'finalized') continue;
    const line = run.lineItems.find(l => l.employeeId === employeeId);
    if (line) total += line.grossPay;
  }
  return total;
}

export function computePayrollLineItem(params: {
  employee: Employee;
  company: Company;
  timesheets: Timesheet[]; // the (typically 2) approved weekly timesheets for this employee in the period
  ytdGrossBeforeThisPeriod: number;
}): PayrollLineItem {
  const { employee, company, timesheets, ytdGrossBeforeThisPeriod } = params;

  let regularHours = 0;
  let overtimeHours = 0;
  let grossRegularPay = 0;
  let grossOvertimePay = 0;
  const breakdownMap = new Map<string | null, { hours: number; amount: number }>();

  if (employee.payType === 'salary') {
    const perPeriod = (employee.salaryAnnual ?? 0) / 26;
    grossRegularPay = perPeriod;
    // still track hours for visibility if timesheets exist
    for (const ts of timesheets) {
      for (const entry of ts.entries) {
        regularHours += entry.hours;
        const key = entry.projectId;
        const existing = breakdownMap.get(key) ?? { hours: 0, amount: 0 };
        existing.hours += entry.hours;
        breakdownMap.set(key, existing);
      }
    }
  } else {
    for (const ts of timesheets) {
      const weekTotal = ts.entries.reduce((sum, e) => sum + e.hours, 0);
      const { regular, overtime } = splitRegularOvertime(weekTotal, company.overtimeThresholdWeekly);
      regularHours += regular;
      overtimeHours += overtime;

      // allocate regular/OT pay per entry proportionally to that entry's
      // share of the week's hours, using each entry's own project rate.
      const ratio = weekTotal > 0 ? regular / weekTotal : 0;
      for (const entry of ts.entries) {
        const rate = rateForProject(employee, entry.projectId);
        const entryRegularHours = entry.hours * ratio;
        const entryOvertimeHours = entry.hours - entryRegularHours;
        const regularAmount = entryRegularHours * rate;
        const overtimeAmount = entryOvertimeHours * rate * company.overtimeMultiplier;
        grossRegularPay += regularAmount;
        grossOvertimePay += overtimeAmount;

        const key = entry.projectId;
        const existing = breakdownMap.get(key) ?? { hours: 0, amount: 0 };
        existing.hours += entry.hours;
        existing.amount += regularAmount + overtimeAmount;
        breakdownMap.set(key, existing);
      }
    }
  }

  const grossPay = grossRegularPay + grossOvertimePay;

  const federalWithholding = computeFederalWithholding({
    grossPayPerPeriod: grossPay,
    filingStatus: employee.filingStatus,
    extraWithholdingPerPeriod: employee.federalAllowancesExtraWithholding,
    annualDependentsCredit: employee.dependentsCredit,
  });

  const stateWithholding = computeStateWithholding({
    grossPayPerPeriod: grossPay,
    state: employee.state,
  });

  const { socialSecurity, medicare, additionalMedicare } = computeFica({
    grossPayPerPeriod: grossPay,
    ytdGrossBeforeThisPeriod,
    filingStatus: employee.filingStatus,
  });

  const totalTaxes = federalWithholding + stateWithholding + socialSecurity + medicare + additionalMedicare;
  const netPay = grossPay - totalTaxes;

  return {
    employeeId: employee.id,
    timesheetIds: timesheets.map(t => t.id),
    regularHours: round2(regularHours),
    overtimeHours: round2(overtimeHours),
    grossRegularPay: round2(grossRegularPay),
    grossOvertimePay: round2(grossOvertimePay),
    grossPay: round2(grossPay),
    federalWithholding: round2(federalWithholding),
    stateWithholding: round2(stateWithholding),
    socialSecurity: round2(socialSecurity),
    medicare: round2(medicare),
    additionalMedicare: round2(additionalMedicare),
    totalTaxes: round2(totalTaxes),
    netPay: round2(netPay),
    breakdownByProject: Array.from(breakdownMap.entries()).map(([projectId, v]) => ({
      projectId, hours: round2(v.hours), amount: round2(v.amount),
    })),
  };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
