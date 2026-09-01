// Core domain types for the payroll & timekeeping platform.
// Designed so a real backend/database can be swapped in later without
// changing the shape of the data the UI works with.

export type FilingStatus = 'single' | 'married_joint' | 'head_of_household';

export type USState =
  | 'AL' | 'AK' | 'AZ' | 'AR' | 'CA' | 'CO' | 'CT' | 'DE' | 'FL' | 'GA'
  | 'HI' | 'ID' | 'IL' | 'IN' | 'IA' | 'KS' | 'KY' | 'LA' | 'ME' | 'MD'
  | 'MA' | 'MI' | 'MN' | 'MS' | 'MO' | 'MT' | 'NE' | 'NV' | 'NH' | 'NJ'
  | 'NM' | 'NY' | 'NC' | 'ND' | 'OH' | 'OK' | 'OR' | 'PA' | 'RI' | 'SC'
  | 'SD' | 'TN' | 'TX' | 'UT' | 'VT' | 'VA' | 'WA' | 'WV' | 'WI' | 'WY' | 'DC';

export interface Company {
  id: string;
  name: string;
  ein?: string;
  address?: string;
  state: USState;
  payFrequency: 'biweekly';
  overtimeMultiplier: number; // e.g. 1.5
  overtimeThresholdWeekly: number; // hours per week before OT, e.g. 40
  createdAt: string;
}

export type OnboardingDocStatus = 'pending' | 'uploaded' | 'signed' | 'waived';

export interface OnboardingDocument {
  id: string;
  employeeId: string;
  name: string; // e.g. "W-4", "I-9", "Offer Letter", "Direct Deposit Form"
  required: boolean;
  status: OnboardingDocStatus;
  fileDataUrl?: string; // base64 data url of uploaded file
  fileName?: string;
  signature?: SignatureRecord;
  updatedAt: string;
}

export interface SignatureRecord {
  name: string;
  method: 'typed' | 'drawn' | 'uploaded';
  dataUrl?: string; // for drawn or uploaded signatures
  typedFont?: string;
  signedAt: string;
  ip?: string; // placeholder, not actually captured
}

export type EmployeeStatus = 'onboarding' | 'active' | 'inactive' | 'terminated';
export type PayType = 'hourly' | 'salary';

export interface EmployeeRate {
  id: string;
  projectId: string | null; // null = default/base rate
  hourlyRate: number;
  effectiveDate: string;
}

export interface Employee {
  id: string;
  companyId: string;
  firstName: string;
  lastName: string;
  email: string;
  title: string;
  status: EmployeeStatus;
  payType: PayType;
  state: USState; // state for tax withholding
  filingStatus: FilingStatus;
  federalAllowancesExtraWithholding: number; // extra $ withheld per paycheck (W-4 step 4c)
  salaryAnnual?: number; // for salaried employees
  defaultHourlyRate: number; // base rate if no project-specific rate
  dependentsCredit: number; // annual $ credit from W-4 step 3
  hireDate: string;
  terminationDate?: string;
  rates: EmployeeRate[];
  projectIds: string[]; // projects the employee is assigned to
  employeeNumber?: string; // human-readable ID (e.g. "824276"), used to match uploaded timecards
  createdAt: string;
}

export interface Client {
  id: string;
  companyId: string;
  name: string;
  contactName?: string;
  contactEmail?: string;
  active: boolean;
  createdAt: string;
}

export interface Project {
  id: string;
  companyId: string;
  clientId: string | null;
  name: string;
  clientName?: string;
  code: string;
  active: boolean;
  billRate?: number; // optional, for internal reference/client billing
  budget?: number; // optional total budget for progress tracking
  createdAt: string;
}

export type TimesheetStatus =
  | 'draft' | 'submitted' | 'approved' | 'rejected' | 'paid'
  // Uploaded-timecard approval pipeline (see DailyEntry) — the legacy
  // statuses above stay in play for the weekly hours-grid flow.
  | 'sent_to_employee' | 'employee_approved' | 'sent_to_supervisor' | 'supervisor_approved' | 'completed';

export interface TimeEntry {
  id: string;
  date: string; // ISO date
  projectId: string | null;
  hours: number;
  notes?: string;
}

/** A single clock in/out pair within a day (e.g. before/after a lunch break). */
export interface Punch {
  in: string; // "HH:MM" 24-hour
  out: string; // "HH:MM" 24-hour
}

export type DailyStatus = 'WORK' | 'OFF' | 'HOLIDAY' | 'PTO' | 'SICK';

/** One day's row on the "Daily Time Entries" table of an uploaded timecard.
 * Multiple punches on the same date (e.g. a lunch break) live together in
 * `punches` under one DailyEntry — the date is never repeated per punch. */
export interface DailyEntry {
  date: string; // ISO date
  dayOfWeek: string; // "Monday"
  status: DailyStatus;
  punches: Punch[];
  jobCode?: string;
  positionTitle?: string;
  department?: string;
  hours: number;
}

export interface JobCodeSummaryRow {
  department: string;
  jobCode: string;
  positionTitle: string;
  hours: number;
  programs: number;
  total: number;
}

export interface SendLogEntry {
  type: 'employee' | 'supervisor';
  action: 'sent' | 'resent';
  at: string;
  byProfileId?: string | null;
}

export interface Timesheet {
  id: string;
  companyId: string;
  employeeId: string;
  weekStartDate: string; // ISO date — for an uploaded timecard, the pay period start
  weekEndDate: string; // ISO date — for an uploaded timecard, the pay period end
  entries: TimeEntry[];
  status: TimesheetStatus;
  submittedAt?: string;
  employeeSignature?: SignatureRecord;
  approverSignature?: SignatureRecord;
  approverName?: string;
  approvedAt?: string;
  rejectionReason?: string;
  clientApproval?: SignatureRecord;
  clientApprovedAt?: string;
  activeSession?: ActiveClockSession | null;
  clockSessions: ClockSession[];
  createdAt: string;

  // Uploaded timecard fields — present (dailyEntries non-empty) only for
  // timesheets created via the upload flow. A row with no daily entries
  // renders as the classic weekly hours-grid, unchanged.
  dailyEntries?: DailyEntry[];
  regularHours?: number;
  jobCodeSummary?: JobCodeSummaryRow[];
  employeeNumberSnapshot?: string;
  employeeNameSnapshot?: string;
  supervisorName?: string;
  supervisorEmail?: string;
  sendLog?: SendLogEntry[];
  employeeSignedAt?: string;
  supervisorSignature?: SignatureRecord;
  supervisorSignedAt?: string;
  employeeLinkToken?: string;
  supervisorLinkToken?: string;
}

export interface ClockSession {
  id: string;
  date: string;
  projectId: string | null;
  startedAt: string;
  endedAt: string;
  hours: number;
}

export interface ActiveClockSession {
  projectId: string | null;
  startedAt: string;
}

export interface PayrollLineItem {
  employeeId: string;
  timesheetIds: string[];
  regularHours: number;
  overtimeHours: number;
  grossRegularPay: number;
  grossOvertimePay: number;
  grossPay: number;
  federalWithholding: number;
  stateWithholding: number;
  socialSecurity: number;
  medicare: number;
  additionalMedicare: number;
  totalTaxes: number;
  netPay: number;
  breakdownByProject: { projectId: string | null; hours: number; amount: number }[];
}

export type PayrollRunStatus = 'draft' | 'finalized';

export interface PayrollRun {
  id: string;
  companyId: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  status: PayrollRunStatus;
  lineItems: PayrollLineItem[];
  createdAt: string;
  finalizedAt?: string;
}

export type NoteVisibility = 'internal' | 'shared_with_client';

export interface Note {
  id: string;
  companyId: string;
  employeeId: string;
  authorId: string | null;
  authorLabel: string;
  body: string;
  visibility: NoteVisibility;
  createdAt: string;
}

export type AccommodationStatus = 'none' | 'requested' | 'in_review' | 'resolved';

export interface AccommodationRequest {
  employeeId: string;
  needsAccommodation: boolean;
  description?: string;
  status: AccommodationStatus;
  adminNotes?: string;
  visibleToClient: boolean;
  submittedAt?: string;
  updatedAt: string;
}

export type FormFieldType = 'text' | 'textarea' | 'number' | 'date' | 'checkbox' | 'select';

export interface FormField {
  id: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  options?: string[]; // for 'select'
}

export interface FormTemplate {
  id: string;
  companyId: string;
  name: string;
  description?: string;
  fields: FormField[];
  active: boolean;
  standardKind?: 'w4' | 'i9' | 'w9' | null;
  autoAssign: boolean;
  createdAt: string;
}

export type FormSubmissionStatus = 'pending' | 'submitted';

export interface FormSubmission {
  id: string;
  companyId: string;
  templateId: string;
  employeeId: string;
  responses: Record<string, string | number | boolean>;
  status: FormSubmissionStatus;
  signature?: SignatureRecord;
  visibleToClient: boolean;
  submittedAt?: string;
  createdAt: string;
}

export type SignatureRequestStatus = 'sent' | 'viewed' | 'signed' | 'declined';

export interface SignatureRequest {
  id: string;
  companyId: string;
  employeeId: string;
  timesheetIds: string[];
  rangeStart: string;
  rangeEnd: string;
  recipientName: string;
  recipientEmail: string;
  token: string;
  status: SignatureRequestStatus;
  signature?: SignatureRecord;
  signedAt?: string;
  createdBy?: string | null;
  createdAt: string;
}

export interface ProfileSummary {
  id: string;
  companyId: string;
  role: 'admin' | 'employee' | 'client';
  employeeId: string | null;
  clientId: string | null;
  email: string;
}

export interface AppData {
  companies: Company[];
  clients: Client[];
  employees: Employee[];
  projects: Project[];
  timesheets: Timesheet[];
  onboardingDocs: OnboardingDocument[];
  notes: Note[];
  accommodationRequests: AccommodationRequest[];
  formTemplates: FormTemplate[];
  formSubmissions: FormSubmission[];
  signatureRequests: SignatureRequest[];
  profiles: ProfileSummary[];
  payrollRuns: PayrollRun[];
  currentCompanyId: string | null;
}
