// Parses an uploaded timesheet/time report (Excel, CSV, or PDF) into one
// draft timecard per employee, ready for the admin review screen.
//
// This never touches the database — it's pure client-side parsing (the app
// has no server to run it on). Because header layouts and PDF text
// extraction are inherently variable across time-clock systems, parsing
// here is deliberately best-effort: every result lands on a review screen
// where the admin corrects anything wrong before it's saved, rather than
// being trusted blindly.

import type { DailyEntry, DailyStatus, JobCodeSummaryRow, Punch } from './types';

/** Aggregates daily entries into the "Job Code & Allocation Summary" rows
 * (grouped by department + job code + position). Derived from entries
 * rather than stored independently, so it can never drift out of sync. */
export function buildJobCodeSummary(dailyEntries: DailyEntry[]): JobCodeSummaryRow[] {
  const map = new Map<string, JobCodeSummaryRow>();
  for (const d of dailyEntries) {
    if (d.status !== 'WORK' || d.hours <= 0) continue;
    const department = d.department || 'Unassigned';
    const jobCode = d.jobCode || '—';
    const positionTitle = d.positionTitle || '—';
    const key = `${department}__${jobCode}__${positionTitle}`;
    const existing = map.get(key);
    if (existing) {
      existing.hours = Math.round((existing.hours + d.hours) * 100) / 100;
      existing.total = Math.round((existing.hours + existing.programs) * 100) / 100;
    } else {
      map.set(key, { department, jobCode, positionTitle, hours: d.hours, programs: 0, total: d.hours });
    }
  }
  return [...map.values()];
}

export interface ParsedTimecardDraft {
  key: string; // grouping key used only during parsing (employee number or name)
  employeeNumberRaw: string;
  firstName: string;
  lastName: string;
  payPeriodStart: string; // ISO date
  payPeriodEnd: string; // ISO date
  dailyEntries: DailyEntry[];
  regularHours: number;
  warnings: string[];
}

export interface ParseResult {
  drafts: ParsedTimecardDraft[];
  warnings: string[]; // file-level warnings (not tied to one employee)
}

const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function dayOfWeekOf(iso: string): string {
  return DOW[new Date(iso + 'T00:00:00').getDay()];
}

// ---------------------------------------------------------------------------
// Header aliasing — maps a wide variety of common time-report column
// headers to the canonical fields we need.
// ---------------------------------------------------------------------------
const HEADER_ALIASES: Record<string, string[]> = {
  employeeNumber: ['employee id', 'emp id', 'employee #', 'emp #', 'id', 'employee number', 'badge', 'badge id'],
  firstName: ['first name', 'first', 'given name'],
  lastName: ['last name', 'last', 'surname', 'family name'],
  fullName: ['employee name', 'employee', 'name'],
  date: ['date', 'work date', 'shift date', 'punch date'],
  dayOfWeek: ['day', 'day of week', 'weekday'],
  timeIn: ['time in', 'clock in', 'in', 'start time', 'punch in'],
  timeOut: ['time out', 'clock out', 'out', 'end time', 'punch out'],
  hours: ['hours', 'hours worked', 'total hours', 'hrs'],
  jobCode: ['job code', 'jobcode', 'code'],
  positionTitle: ['position', 'position title', 'title', 'role'],
  department: ['department', 'project', 'program', 'department/project', 'dept'],
};

function normalizeHeader(h: string): string {
  return String(h).trim().toLowerCase().replace(/\s+/g, ' ');
}

function mapHeaders(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {}; // canonical field -> actual header text
  const normalized = headers.map(h => ({ raw: h, norm: normalizeHeader(h) }));
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const hit = normalized.find(h => aliases.includes(h.norm));
    if (hit) map[field] = hit.raw;
  }
  return map;
}

// ---------------------------------------------------------------------------
// Time parsing — handles "8:00 AM", "08:00", 24h "HH:MM", and Excel's
// fractional-day serial numbers (e.g. 0.3333 = 8:00 AM).
// ---------------------------------------------------------------------------
export function parseTimeValue(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') {
    // Excel time-of-day serial: fraction of a 24h day.
    const totalMinutes = Math.round((v % 1) * 24 * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  const s = String(v).trim();
  if (!s || s === '—' || s === '-') return null;
  const ampm = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)$/);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const m = parseInt(ampm[2], 10);
    const isPm = ampm[3].toLowerCase() === 'pm';
    if (h === 12) h = isPm ? 12 : 0; else if (isPm) h += 12;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  const h24 = s.match(/^(\d{1,2}):(\d{2})$/);
  if (h24) return `${h24[1].padStart(2, '0')}:${h24[2]}`;
  return null;
}

function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function formatTimeLabel(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const isPm = h >= 12;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${isPm ? 'PM' : 'AM'}`;
}

function punchHours(p: Punch): number {
  const mins = minutesOf(p.out) - minutesOf(p.in);
  return mins > 0 ? Math.round((mins / 60) * 100) / 100 : 0;
}

function parseDateValue(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') {
    // Excel date serial (days since 1899-12-30).
    const ms = Math.round((v - 25569) * 86400 * 1000);
    return new Date(ms).toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (mdy) {
    let [, mm, dd, yy] = mdy;
    if (yy.length === 2) yy = `20${yy}`;
    return `${yy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0].slice(0, 10);
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

// ---------------------------------------------------------------------------
// Row grouping — shared by both Excel/CSV and PDF parsing.
// ---------------------------------------------------------------------------
interface RawRow {
  employeeNumber?: string;
  firstName?: string;
  lastName?: string;
  date: string;
  timeIn?: string | null;
  timeOut?: string | null;
  explicitHours?: number | null;
  jobCode?: string;
  positionTitle?: string;
  department?: string;
}

function buildDrafts(rows: RawRow[]): ParsedTimecardDraft[] {
  const byEmployee = new Map<string, RawRow[]>();
  for (const r of rows) {
    const key = (r.employeeNumber || `${r.firstName ?? ''} ${r.lastName ?? ''}`).trim().toLowerCase();
    if (!key) continue;
    if (!byEmployee.has(key)) byEmployee.set(key, []);
    byEmployee.get(key)!.push(r);
  }

  const drafts: ParsedTimecardDraft[] = [];
  for (const [key, empRows] of byEmployee) {
    const warnings: string[] = [];
    const dates = empRows.map(r => r.date).sort();
    const payPeriodStart = dates[0];
    const payPeriodEnd = dates[dates.length - 1];

    const byDate = new Map<string, RawRow[]>();
    for (const r of empRows) {
      if (!byDate.has(r.date)) byDate.set(r.date, []);
      byDate.get(r.date)!.push(r);
    }

    // Fill every date in [payPeriodStart, payPeriodEnd] so OFF days show too.
    const dailyEntries: DailyEntry[] = [];
    const cursor = new Date(payPeriodStart + 'T00:00:00');
    const last = new Date(payPeriodEnd + 'T00:00:00');
    while (cursor <= last) {
      const iso = cursor.toISOString().slice(0, 10);
      const dayRows = byDate.get(iso) ?? [];
      if (dayRows.length === 0) {
        dailyEntries.push({ date: iso, dayOfWeek: dayOfWeekOf(iso), status: 'OFF', punches: [], hours: 0 });
      } else {
        const punches: Punch[] = [];
        for (const r of dayRows) {
          if (r.timeIn && r.timeOut) punches.push({ in: r.timeIn, out: r.timeOut });
          else if (r.timeIn || r.timeOut) warnings.push(`${iso}: incomplete punch (missing ${r.timeIn ? 'time out' : 'time in'}) — please correct.`);
        }
        const explicit = dayRows.find(r => r.explicitHours != null)?.explicitHours ?? null;
        const computed = punches.reduce((s, p) => s + punchHours(p), 0);
        const hours = explicit != null && explicit > 0 ? explicit : Math.round(computed * 100) / 100;
        dailyEntries.push({
          date: iso,
          dayOfWeek: dayOfWeekOf(iso),
          status: hours > 0 || punches.length > 0 ? 'WORK' : 'OFF',
          punches,
          jobCode: dayRows.find(r => r.jobCode)?.jobCode,
          positionTitle: dayRows.find(r => r.positionTitle)?.positionTitle,
          department: dayRows.find(r => r.department)?.department,
          hours,
        });
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    const regularHours = Math.round(dailyEntries.reduce((s, d) => s + d.hours, 0) * 100) / 100;
    const first = empRows.find(r => r.firstName)?.firstName ?? '';
    const lastN = empRows.find(r => r.lastName)?.lastName ?? '';
    drafts.push({
      key,
      employeeNumberRaw: empRows.find(r => r.employeeNumber)?.employeeNumber ?? '',
      firstName: first,
      lastName: lastN,
      payPeriodStart,
      payPeriodEnd,
      dailyEntries,
      regularHours,
      warnings,
    });
  }

  return drafts.sort((a, b) => `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`));
}

// ---------------------------------------------------------------------------
// Excel / CSV
// ---------------------------------------------------------------------------
export async function parseSpreadsheet(file: File): Promise<ParseResult> {
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  const isCsv = /\.csv$/i.test(file.name);
  const wb = isCsv
    ? XLSX.read(new TextDecoder().decode(buf), { type: 'string' })
    : XLSX.read(buf, { type: 'array', cellDates: false });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  if (rows.length === 0) return { drafts: [], warnings: ['The file has no data rows.'] };

  const headers = Object.keys(rows[0]);
  const map = mapHeaders(headers);
  const fileWarnings: string[] = [];
  if (!map.date) fileWarnings.push('Could not find a "Date" column — every row was skipped.');
  if (!map.employeeNumber && !map.fullName && !(map.firstName && map.lastName)) {
    fileWarnings.push('Could not find an employee identifier column (Employee ID or Name) — every row was skipped.');
  }
  if (fileWarnings.length > 0) return { drafts: [], warnings: fileWarnings };

  const raw: RawRow[] = [];
  for (const row of rows) {
    const date = parseDateValue(row[map.date]);
    if (!date) continue;
    let firstName = map.firstName ? String(row[map.firstName] ?? '').trim() : '';
    let lastName = map.lastName ? String(row[map.lastName] ?? '').trim() : '';
    if (!firstName && !lastName && map.fullName) {
      const full = String(row[map.fullName] ?? '').trim();
      const parts = full.split(/\s+/);
      firstName = parts[0] ?? '';
      lastName = parts.slice(1).join(' ');
    }
    raw.push({
      employeeNumber: map.employeeNumber ? String(row[map.employeeNumber] ?? '').trim() : undefined,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      date,
      timeIn: map.timeIn ? parseTimeValue(row[map.timeIn]) : null,
      timeOut: map.timeOut ? parseTimeValue(row[map.timeOut]) : null,
      explicitHours: map.hours ? (parseFloat(String(row[map.hours])) || null) : null,
      jobCode: map.jobCode ? String(row[map.jobCode] ?? '').trim() || undefined : undefined,
      positionTitle: map.positionTitle ? String(row[map.positionTitle] ?? '').trim() || undefined : undefined,
      department: map.department ? String(row[map.department] ?? '').trim() || undefined : undefined,
    });
  }

  return { drafts: buildDrafts(raw), warnings: fileWarnings };
}

// ---------------------------------------------------------------------------
// PDF — best effort only. PDF text extraction has no reliable column
// structure, so this looks for date + time-range patterns line by line and
// tracks the most recent "employee header" line it saw. Always review the
// result before saving; this is why the review screen exists.
// ---------------------------------------------------------------------------
export async function parsePdf(file: File): Promise<ParseResult> {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const lines: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let lastY: number | null = null;
    let current = '';
    for (const item of content.items as any[]) {
      const y = item.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 2) { lines.push(current); current = ''; }
      current += item.str;
      lastY = y;
    }
    if (current) lines.push(current);
  }

  const headerRe = /employee[:\s]+([A-Za-z .'-]+?)\s*(?:\(|#|ID[:\s])\s*([A-Za-z0-9-]+)\)?/i;
  const dateRe = /(\d{1,2}\/\d{1,2}\/\d{2,4})/;
  const timeRangeRe = /(\d{1,2}:\d{2}\s*(?:AM|PM))\s*[-–—]\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i;
  const jobCodeRe = /\b([A-Z]{3,}[A-Z0-9]*)\b/;

  let currentEmployee: { first: string; last: string } | null = null;
  const raw: RawRow[] = [];
  const fileWarnings: string[] = [];

  for (const line of lines) {
    const h = line.match(headerRe);
    if (h) {
      const parts = h[1].trim().split(/\s+/);
      currentEmployee = { first: parts[0] ?? '', last: parts.slice(1).join(' ') };
      continue;
    }
    const dateMatch = line.match(dateRe);
    if (!dateMatch) continue;
    const date = parseDateValue(dateMatch[1]);
    if (!date) continue;
    const timeMatch = line.match(timeRangeRe);
    const jobMatch = line.match(jobCodeRe);
    raw.push({
      firstName: currentEmployee?.first,
      lastName: currentEmployee?.last,
      date,
      timeIn: timeMatch ? parseTimeValue(timeMatch[1]) : null,
      timeOut: timeMatch ? parseTimeValue(timeMatch[2]) : null,
      jobCode: jobMatch ? jobMatch[1] : undefined,
    });
  }

  if (raw.length === 0) {
    fileWarnings.push('Could not find any recognizable date/time rows in this PDF. PDF layouts vary a lot between time-clock systems — an Excel or CSV export from the same system will parse far more reliably.');
  } else {
    fileWarnings.push('PDF parsing is best-effort — double-check every row on the next screen before saving, especially job codes and position titles, which are harder to extract reliably from a PDF than a spreadsheet.');
  }

  return { drafts: buildDrafts(raw), warnings: fileWarnings };
}

export async function parseTimesheetFile(file: File): Promise<ParseResult> {
  if (/\.pdf$/i.test(file.name)) return parsePdf(file);
  return parseSpreadsheet(file);
}

export function statusLabel(s: DailyStatus): string {
  return s === 'WORK' ? 'WORK' : s;
}
