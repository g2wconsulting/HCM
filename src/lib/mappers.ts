import type {
  Company, Employee, Project, Timesheet, OnboardingDocument, PayrollRun, Client, Note, AccommodationRequest,
  FormTemplate, FormSubmission, SignatureRequest, ProfileSummary, Department, Position,
} from './types';

const numOrUndef = (v: any) => (v == null ? undefined : Number(v));

export function rowToClient(r: any): Client {
  return {
    id: r.id, companyId: r.company_id, name: r.name, contactName: r.contact_name ?? undefined,
    contactEmail: r.contact_email ?? undefined, active: r.active, createdAt: r.created_at,
  };
}
export function clientToRow(c: Partial<Client> & { companyId?: string }): any {
  const row: any = {};
  if (c.companyId !== undefined) row.company_id = c.companyId;
  if (c.name !== undefined) row.name = c.name;
  if (c.contactName !== undefined) row.contact_name = c.contactName;
  if (c.contactEmail !== undefined) row.contact_email = c.contactEmail;
  if (c.active !== undefined) row.active = c.active;
  return row;
}

export function rowToNote(r: any): Note {
  return {
    id: r.id, companyId: r.company_id, employeeId: r.employee_id, authorId: r.author_id ?? null,
    authorLabel: r.author_label, body: r.body, visibility: r.visibility, createdAt: r.created_at,
  };
}
export function noteToRow(n: Partial<Note> & { companyId?: string; employeeId?: string }): any {
  const row: any = {};
  if (n.companyId !== undefined) row.company_id = n.companyId;
  if (n.employeeId !== undefined) row.employee_id = n.employeeId;
  if (n.authorId !== undefined) row.author_id = n.authorId;
  if (n.authorLabel !== undefined) row.author_label = n.authorLabel;
  if (n.body !== undefined) row.body = n.body;
  if (n.visibility !== undefined) row.visibility = n.visibility;
  return row;
}

export function rowToAccommodation(r: any): AccommodationRequest {
  return {
    employeeId: r.employee_id, needsAccommodation: r.needs_accommodation, description: r.description ?? undefined,
    status: r.status, adminNotes: r.admin_notes ?? undefined, visibleToClient: r.visible_to_client,
    submittedAt: r.submitted_at ?? undefined, updatedAt: r.updated_at,
  };
}
export function accommodationToRow(a: Partial<AccommodationRequest> & { employeeId?: string }): any {
  const row: any = {};
  if (a.employeeId !== undefined) row.employee_id = a.employeeId;
  if (a.needsAccommodation !== undefined) row.needs_accommodation = a.needsAccommodation;
  if (a.description !== undefined) row.description = a.description;
  if (a.status !== undefined) row.status = a.status;
  if (a.adminNotes !== undefined) row.admin_notes = a.adminNotes;
  if (a.visibleToClient !== undefined) row.visible_to_client = a.visibleToClient;
  if (a.submittedAt !== undefined) row.submitted_at = a.submittedAt;
  return row;
}

export function rowToCompany(r: any): Company {
  return {
    id: r.id, name: r.name, ein: r.ein ?? undefined, address: r.address ?? undefined,
    state: r.state, payFrequency: 'biweekly', overtimeMultiplier: Number(r.overtime_multiplier),
    overtimeThresholdWeekly: Number(r.overtime_threshold_weekly), createdAt: r.created_at,
  };
}
export function companyToRow(patch: Partial<Company>): any {
  const row: any = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.ein !== undefined) row.ein = patch.ein;
  if (patch.address !== undefined) row.address = patch.address;
  if (patch.state !== undefined) row.state = patch.state;
  if (patch.overtimeMultiplier !== undefined) row.overtime_multiplier = patch.overtimeMultiplier;
  if (patch.overtimeThresholdWeekly !== undefined) row.overtime_threshold_weekly = patch.overtimeThresholdWeekly;
  return row;
}

export function rowToEmployee(r: any): Employee {
  return {
    id: r.id, companyId: r.company_id, firstName: r.first_name, lastName: r.last_name, email: r.email,
    title: r.title, status: r.status, payType: r.pay_type, state: r.state, filingStatus: r.filing_status,
    federalAllowancesExtraWithholding: Number(r.federal_extra_withholding), salaryAnnual: r.salary_annual != null ? Number(r.salary_annual) : undefined,
    defaultHourlyRate: Number(r.default_hourly_rate), dependentsCredit: Number(r.dependents_credit),
    hireDate: r.hire_date, terminationDate: r.termination_date ?? undefined,
    rates: r.rates ?? [], projectIds: r.project_ids ?? [], employeeNumber: r.employee_number ?? undefined,
    createdAt: r.created_at,
  };
}
export function employeeToRow(e: Partial<Employee> & { companyId?: string }): any {
  const row: any = {};
  if (e.employeeNumber !== undefined) row.employee_number = e.employeeNumber;
  if (e.companyId !== undefined) row.company_id = e.companyId;
  if (e.firstName !== undefined) row.first_name = e.firstName;
  if (e.lastName !== undefined) row.last_name = e.lastName;
  if (e.email !== undefined) row.email = e.email;
  if (e.title !== undefined) row.title = e.title;
  if (e.status !== undefined) row.status = e.status;
  if (e.payType !== undefined) row.pay_type = e.payType;
  if (e.state !== undefined) row.state = e.state;
  if (e.filingStatus !== undefined) row.filing_status = e.filingStatus;
  if (e.federalAllowancesExtraWithholding !== undefined) row.federal_extra_withholding = e.federalAllowancesExtraWithholding;
  if (e.salaryAnnual !== undefined) row.salary_annual = e.salaryAnnual;
  if (e.defaultHourlyRate !== undefined) row.default_hourly_rate = e.defaultHourlyRate;
  if (e.dependentsCredit !== undefined) row.dependents_credit = e.dependentsCredit;
  if (e.hireDate !== undefined) row.hire_date = e.hireDate;
  if (e.terminationDate !== undefined) row.termination_date = e.terminationDate;
  if (e.rates !== undefined) row.rates = e.rates;
  if (e.projectIds !== undefined) row.project_ids = e.projectIds;
  return row;
}

export function rowToDepartment(r: any): Department {
  return { id: r.id, companyId: r.company_id, clientId: r.client_id ?? null, name: r.name, active: r.active, createdAt: r.created_at };
}
export function departmentToRow(d: Partial<Department> & { companyId?: string }): any {
  const row: any = {};
  if (d.companyId !== undefined) row.company_id = d.companyId;
  if (d.clientId !== undefined) row.client_id = d.clientId;
  if (d.name !== undefined) row.name = d.name;
  if (d.active !== undefined) row.active = d.active;
  return row;
}

export function rowToPosition(r: any): Position {
  return {
    id: r.id, companyId: r.company_id, departmentId: r.department_id, title: r.title, jobCode: r.job_code ?? '',
    blockPayAmount: numOrUndef(r.block_pay_amount), blockPayHours: numOrUndef(r.block_pay_hours),
    active: r.active, createdAt: r.created_at,
  };
}
export function positionToRow(p: Partial<Position> & { companyId?: string; departmentId?: string }): any {
  const row: any = {};
  if (p.companyId !== undefined) row.company_id = p.companyId;
  if (p.departmentId !== undefined) row.department_id = p.departmentId;
  if (p.title !== undefined) row.title = p.title;
  if (p.jobCode !== undefined) row.job_code = p.jobCode;
  if (p.blockPayAmount !== undefined) row.block_pay_amount = p.blockPayAmount;
  if (p.blockPayHours !== undefined) row.block_pay_hours = p.blockPayHours;
  if (p.active !== undefined) row.active = p.active;
  return row;
}

export function rowToProject(r: any): Project {
  return {
    id: r.id, companyId: r.company_id, clientId: r.client_id ?? null, name: r.name, clientName: r.client_name ?? undefined,
    code: r.code, active: r.active, billRate: r.bill_rate != null ? Number(r.bill_rate) : undefined,
    budget: r.budget != null ? Number(r.budget) : undefined,
    createdAt: r.created_at,
  };
}
export function projectToRow(p: Partial<Project> & { companyId?: string }): any {
  const row: any = {};
  if (p.companyId !== undefined) row.company_id = p.companyId;
  if (p.clientId !== undefined) row.client_id = p.clientId;
  if (p.name !== undefined) row.name = p.name;
  if (p.clientName !== undefined) row.client_name = p.clientName;
  if (p.code !== undefined) row.code = p.code;
  if (p.active !== undefined) row.active = p.active;
  if (p.billRate !== undefined) row.bill_rate = p.billRate;
  if (p.budget !== undefined) row.budget = p.budget;
  return row;
}

export function rowToTimesheet(r: any): Timesheet {
  return {
    id: r.id, companyId: r.company_id, employeeId: r.employee_id,
    weekStartDate: r.week_start_date, weekEndDate: r.week_end_date,
    entries: r.entries ?? [], status: r.status, submittedAt: r.submitted_at ?? undefined,
    employeeSignature: r.employee_signature ?? undefined, approverSignature: r.approver_signature ?? undefined,
    approverName: r.approver_name ?? undefined, approvedAt: r.approved_at ?? undefined,
    rejectionReason: r.rejection_reason ?? undefined, createdAt: r.created_at,
    clientApproval: r.client_approval ?? undefined, clientApprovedAt: r.client_approved_at ?? undefined,
    activeSession: r.active_session ?? null, clockSessions: r.clock_sessions ?? [],
    dailyEntries: r.daily_entries ?? [], regularHours: numOrUndef(r.regular_hours),
    jobCodeSummary: r.job_code_summary ?? [],
    employeeNumberSnapshot: r.employee_number_snapshot ?? undefined,
    employeeNameSnapshot: r.employee_name_snapshot ?? undefined,
    supervisorName: r.supervisor_name ?? undefined, supervisorEmail: r.supervisor_email ?? undefined,
    sendLog: r.send_log ?? [],
    employeeSignedAt: r.employee_signed_at ?? undefined,
    supervisorSignature: r.supervisor_signature ?? undefined, supervisorSignedAt: r.supervisor_signed_at ?? undefined,
    employeeLinkToken: r.employee_link_token ?? undefined, supervisorLinkToken: r.supervisor_link_token ?? undefined,
  };
}
export function timesheetToRow(t: Partial<Timesheet> & { companyId?: string; employeeId?: string }): any {
  const row: any = {};
  if (t.dailyEntries !== undefined) row.daily_entries = t.dailyEntries;
  if (t.regularHours !== undefined) row.regular_hours = t.regularHours;
  if (t.jobCodeSummary !== undefined) row.job_code_summary = t.jobCodeSummary;
  if (t.employeeNumberSnapshot !== undefined) row.employee_number_snapshot = t.employeeNumberSnapshot;
  if (t.employeeNameSnapshot !== undefined) row.employee_name_snapshot = t.employeeNameSnapshot;
  if (t.supervisorName !== undefined) row.supervisor_name = t.supervisorName;
  if (t.supervisorEmail !== undefined) row.supervisor_email = t.supervisorEmail;
  if (t.sendLog !== undefined) row.send_log = t.sendLog;
  if (t.employeeSignedAt !== undefined) row.employee_signed_at = t.employeeSignedAt;
  if (t.supervisorSignature !== undefined) row.supervisor_signature = t.supervisorSignature;
  if (t.supervisorSignedAt !== undefined) row.supervisor_signed_at = t.supervisorSignedAt;
  if (t.employeeLinkToken !== undefined) row.employee_link_token = t.employeeLinkToken;
  if (t.supervisorLinkToken !== undefined) row.supervisor_link_token = t.supervisorLinkToken;
  if (t.companyId !== undefined) row.company_id = t.companyId;
  if (t.employeeId !== undefined) row.employee_id = t.employeeId;
  if (t.weekStartDate !== undefined) row.week_start_date = t.weekStartDate;
  if (t.weekEndDate !== undefined) row.week_end_date = t.weekEndDate;
  if (t.entries !== undefined) row.entries = t.entries;
  if (t.status !== undefined) row.status = t.status;
  if (t.submittedAt !== undefined) row.submitted_at = t.submittedAt;
  if (t.employeeSignature !== undefined) row.employee_signature = t.employeeSignature;
  if (t.approverSignature !== undefined) row.approver_signature = t.approverSignature;
  if (t.approverName !== undefined) row.approver_name = t.approverName;
  if (t.approvedAt !== undefined) row.approved_at = t.approvedAt;
  if (t.rejectionReason !== undefined) row.rejection_reason = t.rejectionReason;
  if (t.clientApproval !== undefined) row.client_approval = t.clientApproval;
  if (t.clientApprovedAt !== undefined) row.client_approved_at = t.clientApprovedAt;
  if (t.activeSession !== undefined) row.active_session = t.activeSession;
  if (t.clockSessions !== undefined) row.clock_sessions = t.clockSessions;
  return row;
}

export function rowToFormTemplate(r: any): FormTemplate {
  return {
    id: r.id, companyId: r.company_id, name: r.name, description: r.description ?? undefined,
    fields: r.fields ?? [], active: r.active, standardKind: r.standard_kind ?? null, autoAssign: r.auto_assign ?? false,
    createdAt: r.created_at,
  };
}
export function formTemplateToRow(f: Partial<FormTemplate> & { companyId?: string }): any {
  const row: any = {};
  if (f.companyId !== undefined) row.company_id = f.companyId;
  if (f.name !== undefined) row.name = f.name;
  if (f.description !== undefined) row.description = f.description;
  if (f.fields !== undefined) row.fields = f.fields;
  if (f.active !== undefined) row.active = f.active;
  if (f.standardKind !== undefined) row.standard_kind = f.standardKind;
  if (f.autoAssign !== undefined) row.auto_assign = f.autoAssign;
  return row;
}

export function rowToProfileSummary(r: any): ProfileSummary {
  return {
    id: r.id, companyId: r.company_id, role: r.role, employeeId: r.employee_id ?? null,
    clientId: r.client_id ?? null, email: r.email,
  };
}

export function rowToFormSubmission(r: any): FormSubmission {
  return {
    id: r.id, companyId: r.company_id, templateId: r.template_id, employeeId: r.employee_id,
    responses: r.responses ?? {}, status: r.status, signature: r.signature ?? undefined,
    visibleToClient: r.visible_to_client, submittedAt: r.submitted_at ?? undefined, createdAt: r.created_at,
  };
}
export function formSubmissionToRow(f: Partial<FormSubmission> & { companyId?: string; templateId?: string; employeeId?: string }): any {
  const row: any = {};
  if (f.companyId !== undefined) row.company_id = f.companyId;
  if (f.templateId !== undefined) row.template_id = f.templateId;
  if (f.employeeId !== undefined) row.employee_id = f.employeeId;
  if (f.responses !== undefined) row.responses = f.responses;
  if (f.status !== undefined) row.status = f.status;
  if (f.signature !== undefined) row.signature = f.signature;
  if (f.visibleToClient !== undefined) row.visible_to_client = f.visibleToClient;
  if (f.submittedAt !== undefined) row.submitted_at = f.submittedAt;
  return row;
}

export function rowToDoc(r: any): OnboardingDocument {
  return {
    id: r.id, employeeId: r.employee_id, name: r.name, required: r.required, status: r.status,
    fileDataUrl: r.file_path ?? undefined, fileName: r.file_name ?? undefined,
    signature: r.signature ?? undefined, updatedAt: r.updated_at,
  };
}
export function docToRow(d: Partial<OnboardingDocument> & { employeeId?: string }): any {
  const row: any = {};
  if (d.employeeId !== undefined) row.employee_id = d.employeeId;
  if (d.name !== undefined) row.name = d.name;
  if (d.required !== undefined) row.required = d.required;
  if (d.status !== undefined) row.status = d.status;
  if (d.fileDataUrl !== undefined) row.file_path = d.fileDataUrl;
  if (d.fileName !== undefined) row.file_name = d.fileName;
  if (d.signature !== undefined) row.signature = d.signature;
  return row;
}

export function rowToPayrollRun(r: any): PayrollRun {
  return {
    id: r.id, companyId: r.company_id, periodStart: r.period_start, periodEnd: r.period_end,
    payDate: r.pay_date, status: r.status, lineItems: r.line_items ?? [],
    createdAt: r.created_at, finalizedAt: r.finalized_at ?? undefined,
  };
}
export function payrollRunToRow(p: Partial<PayrollRun> & { companyId?: string }): any {
  const row: any = {};
  if (p.companyId !== undefined) row.company_id = p.companyId;
  if (p.periodStart !== undefined) row.period_start = p.periodStart;
  if (p.periodEnd !== undefined) row.period_end = p.periodEnd;
  if (p.payDate !== undefined) row.pay_date = p.payDate;
  if (p.status !== undefined) row.status = p.status;
  if (p.lineItems !== undefined) row.line_items = p.lineItems;
  if (p.finalizedAt !== undefined) row.finalized_at = p.finalizedAt;
  return row;
}

export function rowToSignatureRequest(r: any): SignatureRequest {
  return {
    id: r.id, companyId: r.company_id, employeeId: r.employee_id, timesheetIds: r.timesheet_ids ?? [],
    rangeStart: r.range_start, rangeEnd: r.range_end, recipientName: r.recipient_name, recipientEmail: r.recipient_email,
    token: r.token, status: r.status, signature: r.signature ?? undefined, signedAt: r.signed_at ?? undefined,
    createdBy: r.created_by ?? null, createdAt: r.created_at,
  };
}
export function signatureRequestToRow(s: Partial<SignatureRequest> & { companyId?: string; employeeId?: string }): any {
  const row: any = {};
  if (s.companyId !== undefined) row.company_id = s.companyId;
  if (s.employeeId !== undefined) row.employee_id = s.employeeId;
  if (s.timesheetIds !== undefined) row.timesheet_ids = s.timesheetIds;
  if (s.rangeStart !== undefined) row.range_start = s.rangeStart;
  if (s.rangeEnd !== undefined) row.range_end = s.rangeEnd;
  if (s.recipientName !== undefined) row.recipient_name = s.recipientName;
  if (s.recipientEmail !== undefined) row.recipient_email = s.recipientEmail;
  if (s.token !== undefined) row.token = s.token;
  if (s.status !== undefined) row.status = s.status;
  if (s.createdBy !== undefined) row.created_by = s.createdBy;
  return row;
}
