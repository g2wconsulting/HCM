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
  status?: DailyStatus;
}

/** Rebuilds a timecard's daily entries against a new pay-period range,
 * keeping whatever work data already exists for dates inside both the old
 * and new range and filling any newly-added dates as OFF. Used when an
 * admin corrects the pay period on the review screen or timecard detail
 * page — the report a punch export covers rarely lines up exactly with a
 * company's actual pay-period boundaries. */
export function reflowDailyEntries(dailyEntries: DailyEntry[], newStart: string, newEnd: string): DailyEntry[] {
  const byDate = new Map(dailyEntries.map(d => [d.date, d]));
  const result: DailyEntry[] = [];
  const cursor = new Date(newStart + 'T00:00:00');
  const last = new Date(newEnd + 'T00:00:00');
  if (isNaN(cursor.getTime()) || isNaN(last.getTime()) || cursor > last) return dailyEntries;
  while (cursor <= last) {
    const iso = cursor.toISOString().slice(0, 10);
    result.push(byDate.get(iso) ?? { date: iso, dayOfWeek: dayOfWeekOf(iso), status: 'OFF', punches: [], hours: 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
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
        const hours = Math.round((explicit != null && explicit > 0 ? explicit : computed) * 100) / 100;
        const status = dayRows.find(r => r.status)?.status ?? (hours > 0 || punches.length > 0 ? 'WORK' : 'OFF');
        dailyEntries.push({
          date: iso,
          dayOfWeek: dayOfWeekOf(iso),
          status,
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
// PDF — best effort. Tuned against a real "Employee Timecards" time-clock
// export (one employee per page: "Employee Number / Name" header, then a
// row per work day — date, day, action, start, stop, optional job code,
// hours — followed by a "<Department> Summary" section listing job
// codes/position titles worked). Other report layouts will parse less
// completely, which is why every result still lands on the review screen:
// whatever we can't confidently extract (most often job code/position for
// days with no code in the source) is simply left blank for the admin to
// fill in, per "if the info is available, fill it; if not, skip it."
// ---------------------------------------------------------------------------
export async function parsePdf(file: File): Promise<ParseResult> {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;

  // pdf.js returns text items in content-stream order, which for a
  // table-based PDF is often NOT left-to-right visual order (columns can
  // come out reversed or interleaved) — so each visual line is buffered
  // and sorted by x-position before being joined, with a space inserted
  // wherever there's a real gap between one item's end and the next's
  // start (adjacent cells otherwise run together with no separator at all).
  function buildLine(items: { str: string; x: number; width: number }[]): string {
    items.sort((a, b) => a.x - b.x);
    let out = '';
    let lastEnd: number | null = null;
    for (const it of items) {
      if (lastEnd !== null && it.x - lastEnd > 2) out += ' ';
      out += it.str;
      lastEnd = it.x + it.width;
    }
    return out;
  }

  const lines: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let lastY: number | null = null;
    let currentItems: { str: string; x: number; width: number }[] = [];
    for (const item of content.items as any[]) {
      const y = item.transform[5];
      const x = item.transform[4];
      if (lastY !== null && Math.abs(y - lastY) > 2) { lines.push(buildLine(currentItems)); currentItems = []; }
      currentItems.push({ str: item.str, x, width: item.width ?? item.str.length * 5 });
      lastY = y;
    }
    if (currentItems.length) lines.push(buildLine(currentItems));
  }

  // "824276   Hopkins, Ella" — employee number, then "Last, First".
  const employeeLineRe = /^(\d{3,})\s+([A-Za-z'.\- ]+?),\s*([A-Za-z'.\- ]+)$/;
  // "08/28/2026 Fri Work 8:00 AM 10:00 AM MUSEUMINST 2.00 ..." — job code
  // is optional (only present when the source has one assigned); the
  // first number after start/stop (and any job code) is always Hours.
  const punchRe = /^(\d{1,2}\/\d{1,2}\/\d{2,4})\s+[A-Za-z]{3}\s+([A-Za-z]+)\s+(\d{1,2}:\d{2}\s*[AP]M)\s+(\d{1,2}:\d{2}\s*[AP]M)\s+(?:([A-Z][A-Z0-9]{2,})\s+)?([\d.]+)/;
  // "Museum Instructor MUSEUMINST 36.50" or "Unassigned 2.00" — a
  // department's job-code/position breakdown table. Not end-anchored:
  // this report renders two side-by-side tables at the same height, which
  // pdf.js's Y-grouping merges onto one text line, so anything after the
  // first number captured here (e.g. a merged Pay Type Summary row) is
  // deliberately ignored rather than guessed at.
  const posLineRe = /^(.+?)\s+(?:([A-Z][A-Z0-9]{2,})\s+)?([\d.]+)/;

  const raw: RawRow[] = [];
  const fileWarnings: string[] = [];

  let currentEmployee: { number: string; first: string; last: string } | null = null;
  let employeeRows: RawRow[] = [];
  let currentDepartment: string | null = null;
  let jobCodeToPosition = new Map<string, string>();
  let capturingDeptTable = false;

  function flushEmployee() {
    if (!currentEmployee) return;
    for (const r of employeeRows) {
      r.employeeNumber = currentEmployee.number;
      r.firstName = currentEmployee.first;
      r.lastName = currentEmployee.last;
      if (currentDepartment) r.department = currentDepartment;
      if (r.jobCode && jobCodeToPosition.has(r.jobCode)) r.positionTitle = jobCodeToPosition.get(r.jobCode);
    }
    raw.push(...employeeRows);
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const empMatch = line.match(employeeLineRe);
    if (empMatch) {
      flushEmployee();
      currentEmployee = { number: empMatch[1], last: empMatch[2].trim(), first: empMatch[3].trim() };
      employeeRows = [];
      currentDepartment = null;
      jobCodeToPosition = new Map();
      capturingDeptTable = false;
      continue;
    }

    // A department heading and the "Pay Type Summary"/"Shift Summary"
    // headings can render on the same text line (side-by-side report
    // "cards" at the same height) — take the text before the first
    // " Summary" as the department name, but Pay Type/Shift themselves
    // are section labels, not department names, and — unlike a genuine
    // new department — must NOT close the capture window: on this report
    // shape their heading line comes *before* the actual job-code/position
    // data line, so treating them as a stop condition would drop it.
    const summaryIdx = line.indexOf(' Summary');
    if (summaryIdx > 0 && !/^Total\b/i.test(line)) {
      const label = line.slice(0, summaryIdx).trim();
      if (label !== 'Shift' && label !== 'Pay Type') { currentDepartment = label; capturingDeptTable = true; }
      continue;
    }

    if (capturingDeptTable) {
      const posMatch = line.match(posLineRe);
      if (posMatch) {
        const jobCode = posMatch[2];
        if (jobCode) jobCodeToPosition.set(jobCode, posMatch[1].trim());
        continue;
      }
    }

    const punchMatch = line.match(punchRe);
    if (punchMatch && currentEmployee) {
      const [, dateRaw, action, startRaw, stopRaw, jobCode, hoursRaw] = punchMatch;
      const date = parseDateValue(dateRaw);
      if (!date) continue;
      const a = action.toLowerCase();
      const status: DailyStatus = a.includes('holiday') ? 'HOLIDAY' : a.includes('pto') || a.includes('vacation') ? 'PTO' : a.includes('sick') ? 'SICK' : 'WORK';
      employeeRows.push({
        date,
        timeIn: parseTimeValue(startRaw),
        timeOut: parseTimeValue(stopRaw),
        explicitHours: parseFloat(hoursRaw) || null,
        jobCode: jobCode || undefined,
        status,
      });
    }
  }
  flushEmployee();

  if (raw.length === 0) {
    fileWarnings.push('Could not find any recognizable employee/date/time rows in this PDF. PDF layouts vary a lot between time-clock systems — an Excel or CSV export from the same system will parse far more reliably.');
  } else {
    fileWarnings.push('PDF parsing is best-effort — double-check every row on the next screen before saving. Job code, position, and department are filled in only where the source report had them; anything missing there is left blank for you to fill in.');
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
