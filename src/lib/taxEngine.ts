// Tax withholding engine.
//
// Uses the IRS Publication 15-T "annualized wages" percentage method as its
// basis: a paycheck's wages are annualized, tax is computed on the annual
// figure using progressive brackets, then divided back down to the pay
// period. This is the same style of calculation real payroll systems use
// for percentage-method withholding.
//
// IMPORTANT: Tax brackets and wage bases change every year (usually every
// January). The tables below reflect 2024 figures and are provided as a
// solid, realistic starting point — before running real payroll, an
// administrator should confirm figures against the current-year IRS
// Publication 15-T and their state's Department of Revenue tables, and
// update the tables in this file accordingly.

import type { FilingStatus, USState } from './types';

export const PAY_PERIODS_PER_YEAR = 26; // biweekly

// ---------------------------------------------------------------------------
// FICA (Social Security + Medicare) — federal, same for every state
// ---------------------------------------------------------------------------
export const FICA = {
  socialSecurityRate: 0.062,
  socialSecurityWageBase: 168_600, // 2024
  medicareRate: 0.0145,
  additionalMedicareRate: 0.009,
  additionalMedicareThreshold: {
    single: 200_000,
    married_joint: 250_000,
    head_of_household: 200_000,
  } as Record<FilingStatus, number>,
};

// ---------------------------------------------------------------------------
// Federal income tax — 2024 brackets (annual)
// ---------------------------------------------------------------------------
interface Bracket { upTo: number; rate: number }

const FEDERAL_BRACKETS_2024: Record<FilingStatus, Bracket[]> = {
  single: [
    { upTo: 11_600, rate: 0.10 },
    { upTo: 47_150, rate: 0.12 },
    { upTo: 100_525, rate: 0.22 },
    { upTo: 191_950, rate: 0.24 },
    { upTo: 243_725, rate: 0.32 },
    { upTo: 609_350, rate: 0.35 },
    { upTo: Infinity, rate: 0.37 },
  ],
  married_joint: [
    { upTo: 23_200, rate: 0.10 },
    { upTo: 94_300, rate: 0.12 },
    { upTo: 201_050, rate: 0.22 },
    { upTo: 383_900, rate: 0.24 },
    { upTo: 487_450, rate: 0.32 },
    { upTo: 731_200, rate: 0.35 },
    { upTo: Infinity, rate: 0.37 },
  ],
  head_of_household: [
    { upTo: 16_550, rate: 0.10 },
    { upTo: 63_100, rate: 0.12 },
    { upTo: 100_500, rate: 0.22 },
    { upTo: 191_950, rate: 0.24 },
    { upTo: 243_700, rate: 0.32 },
    { upTo: 609_350, rate: 0.35 },
    { upTo: Infinity, rate: 0.37 },
  ],
};

// Standard deduction, 2024, used in the annualized method (Pub 15-T Step 1).
const FEDERAL_STANDARD_DEDUCTION_2024: Record<FilingStatus, number> = {
  single: 14_600,
  married_joint: 29_200,
  head_of_household: 21_900,
};

function taxFromBrackets(annualTaxable: number, brackets: Bracket[]): number {
  if (annualTaxable <= 0) return 0;
  let tax = 0;
  let lower = 0;
  for (const b of brackets) {
    if (annualTaxable > lower) {
      const taxableInBand = Math.min(annualTaxable, b.upTo) - lower;
      tax += taxableInBand * b.rate;
      lower = b.upTo;
    } else break;
  }
  return tax;
}

export function computeFederalWithholding(params: {
  grossPayPerPeriod: number;
  filingStatus: FilingStatus;
  extraWithholdingPerPeriod: number; // W-4 4(c)
  annualDependentsCredit: number; // W-4 step 3 total
}): number {
  const { grossPayPerPeriod, filingStatus, extraWithholdingPerPeriod, annualDependentsCredit } = params;
  const annualizedWages = grossPayPerPeriod * PAY_PERIODS_PER_YEAR;
  const standardDeduction = FEDERAL_STANDARD_DEDUCTION_2024[filingStatus];
  const taxableIncome = Math.max(0, annualizedWages - standardDeduction);
  let annualTax = taxFromBrackets(taxableIncome, FEDERAL_BRACKETS_2024[filingStatus]);
  annualTax = Math.max(0, annualTax - annualDependentsCredit);
  const perPeriodTax = annualTax / PAY_PERIODS_PER_YEAR;
  return Math.max(0, perPeriodTax + extraWithholdingPerPeriod);
}

export function computeFica(params: {
  grossPayPerPeriod: number;
  ytdGrossBeforeThisPeriod: number;
  filingStatus: FilingStatus;
}): { socialSecurity: number; medicare: number; additionalMedicare: number } {
  const { grossPayPerPeriod, ytdGrossBeforeThisPeriod, filingStatus } = params;

  const ssRemainingRoom = Math.max(0, FICA.socialSecurityWageBase - ytdGrossBeforeThisPeriod);
  const ssTaxableThisPeriod = Math.min(grossPayPerPeriod, ssRemainingRoom);
  const socialSecurity = ssTaxableThisPeriod * FICA.socialSecurityRate;

  const medicare = grossPayPerPeriod * FICA.medicareRate;

  const threshold = FICA.additionalMedicareThreshold[filingStatus];
  const ytdAfter = ytdGrossBeforeThisPeriod + grossPayPerPeriod;
  let additionalMedicare = 0;
  if (ytdAfter > threshold) {
    const amountOverThreshold = Math.min(grossPayPerPeriod, ytdAfter - threshold);
    additionalMedicare = amountOverThreshold * FICA.additionalMedicareRate;
  }

  return { socialSecurity, medicare, additionalMedicare };
}

export function computeEmployerFica(params: {
  grossPayPerPeriod: number;
  ytdGrossBeforeThisPeriod: number;
}): { socialSecurity: number; medicare: number } {
  const { grossPayPerPeriod, ytdGrossBeforeThisPeriod } = params;
  const ssRemainingRoom = Math.max(0, FICA.socialSecurityWageBase - ytdGrossBeforeThisPeriod);
  const ssTaxableThisPeriod = Math.min(grossPayPerPeriod, ssRemainingRoom);
  return {
    socialSecurity: ssTaxableThisPeriod * FICA.socialSecurityRate,
    medicare: grossPayPerPeriod * FICA.medicareRate, // employer matches base Medicare only, never the 0.9% additional Medicare surtax
  };
}

export function computeFutaSuta(params: {
  grossPayPerPeriod: number;
  ytdGrossBeforeThisPeriod: number;
  futaRate: number;
  futaWageBase: number;
  sutaRate: number;
  sutaWageBase: number;
}): { futa: number; suta: number } {
  const { grossPayPerPeriod, ytdGrossBeforeThisPeriod, futaRate, futaWageBase, sutaRate, sutaWageBase } = params;
  const futaRoom = Math.max(0, futaWageBase - ytdGrossBeforeThisPeriod);
  const futa = Math.min(grossPayPerPeriod, futaRoom) * futaRate;

  const sutaRoom = Math.max(0, sutaWageBase - ytdGrossBeforeThisPeriod);
  const suta = Math.min(grossPayPerPeriod, sutaRoom) * sutaRate;

  return { futa, suta };
}

export function computeWorkersComp(grossPayPerPeriod: number, ratePer100: number): number {
  return (grossPayPerPeriod / 100) * ratePer100;
}

// ---------------------------------------------------------------------------
// State income tax — 2024, simplified single-taxpayer bracket tables.
// Every state is included. Progressive-tax states use bracket tables; flat
// tax states use a single rate; no-income-tax states are 0.
// These are simplified (no standard deduction/exemption modeling per state)
// so they're most accurate as an approximation — sufficient for demo/testing
// purposes and a strong starting scaffold for real configuration.
// ---------------------------------------------------------------------------
export type StateTaxConfig =
  | { kind: 'none' }
  | { kind: 'flat'; rate: number }
  | { kind: 'bracket'; brackets: Bracket[] };

export const STATE_TAX_TABLE_2024: Record<USState, StateTaxConfig> = {
  AK: { kind: 'none' }, FL: { kind: 'none' }, NV: { kind: 'none' }, NH: { kind: 'none' },
  SD: { kind: 'none' }, TN: { kind: 'none' }, TX: { kind: 'none' }, WA: { kind: 'none' }, WY: { kind: 'none' },

  CO: { kind: 'flat', rate: 0.044 },
  IL: { kind: 'flat', rate: 0.0495 },
  IN: { kind: 'flat', rate: 0.0305 },
  KY: { kind: 'flat', rate: 0.04 },
  MA: { kind: 'flat', rate: 0.05 },
  MI: { kind: 'flat', rate: 0.0425 },
  NC: { kind: 'flat', rate: 0.045 },
  PA: { kind: 'flat', rate: 0.0307 },
  UT: { kind: 'flat', rate: 0.0465 },
  DC: { kind: 'flat', rate: 0.0850 },

  CA: { kind: 'bracket', brackets: [
    { upTo: 10_412, rate: 0.01 }, { upTo: 24_684, rate: 0.02 }, { upTo: 38_959, rate: 0.04 },
    { upTo: 54_081, rate: 0.06 }, { upTo: 68_350, rate: 0.08 }, { upTo: 349_137, rate: 0.093 },
    { upTo: 418_961, rate: 0.103 }, { upTo: 698_271, rate: 0.113 }, { upTo: Infinity, rate: 0.123 },
  ]},
  NY: { kind: 'bracket', brackets: [
    { upTo: 8_500, rate: 0.04 }, { upTo: 11_700, rate: 0.045 }, { upTo: 13_900, rate: 0.0525 },
    { upTo: 80_650, rate: 0.055 }, { upTo: 215_400, rate: 0.06 }, { upTo: 1_077_550, rate: 0.0685 },
    { upTo: Infinity, rate: 0.0965 },
  ]},
  NJ: { kind: 'bracket', brackets: [
    { upTo: 20_000, rate: 0.014 }, { upTo: 35_000, rate: 0.0175 }, { upTo: 40_000, rate: 0.035 },
    { upTo: 75_000, rate: 0.05525 }, { upTo: 500_000, rate: 0.0637 }, { upTo: 1_000_000, rate: 0.0897 },
    { upTo: Infinity, rate: 0.1075 },
  ]},
  VA: { kind: 'bracket', brackets: [
    { upTo: 3_000, rate: 0.02 }, { upTo: 5_000, rate: 0.03 }, { upTo: 17_000, rate: 0.05 }, { upTo: Infinity, rate: 0.0575 },
  ]},
  GA: { kind: 'flat', rate: 0.0549 },
  MD: { kind: 'bracket', brackets: [
    { upTo: 1_000, rate: 0.02 }, { upTo: 2_000, rate: 0.03 }, { upTo: 3_000, rate: 0.04 },
    { upTo: 100_000, rate: 0.0475 }, { upTo: 125_000, rate: 0.05 }, { upTo: 150_000, rate: 0.0525 },
    { upTo: 250_000, rate: 0.055 }, { upTo: Infinity, rate: 0.0575 },
  ]},
  OH: { kind: 'bracket', brackets: [
    { upTo: 26_050, rate: 0 }, { upTo: 100_000, rate: 0.0275 }, { upTo: 115_300, rate: 0.035 }, { upTo: Infinity, rate: 0.035 },
  ]},
  AZ: { kind: 'flat', rate: 0.025 },
  MN: { kind: 'bracket', brackets: [
    { upTo: 31_690, rate: 0.0535 }, { upTo: 104_090, rate: 0.068 }, { upTo: 193_240, rate: 0.0785 }, { upTo: Infinity, rate: 0.0985 },
  ]},
  WI: { kind: 'bracket', brackets: [
    { upTo: 14_320, rate: 0.035 }, { upTo: 28_640, rate: 0.044 }, { upTo: 315_310, rate: 0.053 }, { upTo: Infinity, rate: 0.0765 },
  ]},
  MO: { kind: 'bracket', brackets: [
    { upTo: 1_273, rate: 0 }, { upTo: 2_546, rate: 0.02 }, { upTo: 3_819, rate: 0.025 }, { upTo: 5_092, rate: 0.03 },
    { upTo: 6_365, rate: 0.035 }, { upTo: 7_638, rate: 0.04 }, { upTo: 8_911, rate: 0.045 }, { upTo: Infinity, rate: 0.048 },
  ]},
  SC: { kind: 'bracket', brackets: [
    { upTo: 3_460, rate: 0 }, { upTo: 17_330, rate: 0.03 }, { upTo: Infinity, rate: 0.064 },
  ]},
  AL: { kind: 'bracket', brackets: [
    { upTo: 500, rate: 0.02 }, { upTo: 3_000, rate: 0.04 }, { upTo: Infinity, rate: 0.05 },
  ]},
  AR: { kind: 'bracket', brackets: [
    { upTo: 5_100, rate: 0.02 }, { upTo: 10_300, rate: 0.04 }, { upTo: Infinity, rate: 0.044 },
  ]},
  CT: { kind: 'bracket', brackets: [
    { upTo: 10_000, rate: 0.03 }, { upTo: 50_000, rate: 0.05 }, { upTo: 100_000, rate: 0.055 },
    { upTo: 200_000, rate: 0.06 }, { upTo: 250_000, rate: 0.065 }, { upTo: 500_000, rate: 0.069 }, { upTo: Infinity, rate: 0.0699 },
  ]},
  DE: { kind: 'bracket', brackets: [
    { upTo: 2_000, rate: 0 }, { upTo: 5_000, rate: 0.022 }, { upTo: 10_000, rate: 0.039 }, { upTo: 20_000, rate: 0.048 },
    { upTo: 25_000, rate: 0.052 }, { upTo: 60_000, rate: 0.0555 }, { upTo: Infinity, rate: 0.066 },
  ]},
  HI: { kind: 'bracket', brackets: [
    { upTo: 2_400, rate: 0.014 }, { upTo: 4_800, rate: 0.032 }, { upTo: 9_600, rate: 0.055 }, { upTo: 14_400, rate: 0.064 },
    { upTo: 19_200, rate: 0.068 }, { upTo: 24_000, rate: 0.072 }, { upTo: 36_000, rate: 0.076 }, { upTo: 48_000, rate: 0.079 },
    { upTo: 150_000, rate: 0.0825 }, { upTo: 175_000, rate: 0.09 }, { upTo: 200_000, rate: 0.10 }, { upTo: Infinity, rate: 0.11 },
  ]},
  ID: { kind: 'flat', rate: 0.058 },
  IA: { kind: 'flat', rate: 0.038 },
  KS: { kind: 'bracket', brackets: [
    { upTo: 15_000, rate: 0.031 }, { upTo: 30_000, rate: 0.0525 }, { upTo: Infinity, rate: 0.057 },
  ]},
  LA: { kind: 'bracket', brackets: [
    { upTo: 12_500, rate: 0.0185 }, { upTo: 50_000, rate: 0.035 }, { upTo: Infinity, rate: 0.0425 },
  ]},
  ME: { kind: 'bracket', brackets: [
    { upTo: 26_050, rate: 0.058 }, { upTo: 61_600, rate: 0.0675 }, { upTo: Infinity, rate: 0.0715 },
  ]},
  MS: { kind: 'flat', rate: 0.047 },
  MT: { kind: 'bracket', brackets: [
    { upTo: 20_500, rate: 0.047 }, { upTo: Infinity, rate: 0.059 },
  ]},
  NE: { kind: 'bracket', brackets: [
    { upTo: 3_700, rate: 0.0246 }, { upTo: 22_170, rate: 0.0351 }, { upTo: 35_730, rate: 0.0501 }, { upTo: Infinity, rate: 0.0584 },
  ]},
  NM: { kind: 'bracket', brackets: [
    { upTo: 5_500, rate: 0.017 }, { upTo: 11_000, rate: 0.032 }, { upTo: 16_000, rate: 0.047 },
    { upTo: 210_000, rate: 0.049 }, { upTo: Infinity, rate: 0.059 },
  ]},
  ND: { kind: 'bracket', brackets: [
    { upTo: 44_725, rate: 0 }, { upTo: 225_975, rate: 0.0195 }, { upTo: Infinity, rate: 0.025 },
  ]},
  OK: { kind: 'bracket', brackets: [
    { upTo: 1_000, rate: 0.0025 }, { upTo: 2_500, rate: 0.0075 }, { upTo: 3_750, rate: 0.0175 }, { upTo: 4_900, rate: 0.0275 },
    { upTo: 7_200, rate: 0.0375 }, { upTo: Infinity, rate: 0.0475 },
  ]},
  OR: { kind: 'bracket', brackets: [
    { upTo: 4_300, rate: 0.0475 }, { upTo: 10_750, rate: 0.0675 }, { upTo: 125_000, rate: 0.0875 }, { upTo: Infinity, rate: 0.099 },
  ]},
  RI: { kind: 'bracket', brackets: [
    { upTo: 77_450, rate: 0.0375 }, { upTo: 176_050, rate: 0.0475 }, { upTo: Infinity, rate: 0.0599 },
  ]},
  VT: { kind: 'bracket', brackets: [
    { upTo: 45_400, rate: 0.0335 }, { upTo: 110_050, rate: 0.066 }, { upTo: 229_550, rate: 0.076 }, { upTo: Infinity, rate: 0.0875 },
  ]},
  WV: { kind: 'bracket', brackets: [
    { upTo: 10_000, rate: 0.0236 }, { upTo: 25_000, rate: 0.0315 }, { upTo: 40_000, rate: 0.0354 },
    { upTo: 60_000, rate: 0.0472 }, { upTo: Infinity, rate: 0.0512 },
  ]},
};

export function computeStateWithholding(params: {
  grossPayPerPeriod: number;
  state: USState;
}): number {
  const config = STATE_TAX_TABLE_2024[params.state];
  const annualizedWages = params.grossPayPerPeriod * PAY_PERIODS_PER_YEAR;

  let annualTax = 0;
  if (config.kind === 'none') {
    annualTax = 0;
  } else if (config.kind === 'flat') {
    annualTax = annualizedWages * config.rate;
  } else {
    annualTax = taxFromBrackets(annualizedWages, config.brackets);
  }
  return Math.max(0, annualTax / PAY_PERIODS_PER_YEAR);
}
