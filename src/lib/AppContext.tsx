import { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from 'react';
import { supabase } from './supabaseClient';
import { useAuth } from './AuthContext';
import type {
  AppData, Company, Employee, Project, Timesheet, OnboardingDocument, PayrollRun, Client, Note, AccommodationRequest,
  FormTemplate, FormSubmission, SignatureRequest, EmployeeTaxInfo,
} from './types';
import {
  rowToCompany, companyToRow, rowToEmployee, employeeToRow, rowToProject, projectToRow,
  rowToTimesheet, timesheetToRow, rowToDoc, docToRow, rowToPayrollRun, payrollRunToRow,
  rowToClient, clientToRow, rowToNote, noteToRow, rowToAccommodation, accommodationToRow,
  rowToFormTemplate, formTemplateToRow, rowToFormSubmission, formSubmissionToRow,
  rowToSignatureRequest, signatureRequestToRow, rowToProfileSummary,
  rowToEmployeeTaxInfo, employeeTaxInfoToRow,
} from './mappers';

interface AppContextValue {
  data: AppData;
  company: Company;
  loading: boolean;
  loadError: string | null;
  refresh: () => Promise<void>;
  setCompany: (c: Partial<Company>) => Promise<void>;
  addEmployee: (e: Omit<Employee, 'id' | 'createdAt'>) => Promise<Employee | null>;
  updateEmployee: (id: string, patch: Partial<Employee>) => Promise<void>;
  addProject: (p: Omit<Project, 'id' | 'createdAt'>) => Promise<Project | null>;
  updateProject: (id: string, patch: Partial<Project>) => Promise<void>;
  addClient: (c: Omit<Client, 'id' | 'createdAt'>) => Promise<Client | null>;
  updateClient: (id: string, patch: Partial<Client>) => Promise<void>;
  addTimesheet: (t: Omit<Timesheet, 'id' | 'createdAt'>) => Promise<Timesheet | null>;
  updateTimesheet: (id: string, patch: Partial<Timesheet>) => Promise<void>;
  addOnboardingDoc: (d: Omit<OnboardingDocument, 'id'>) => Promise<OnboardingDocument | null>;
  updateOnboardingDoc: (id: string, patch: Partial<OnboardingDocument>) => Promise<void>;
  removeOnboardingDoc: (id: string) => Promise<void>;
  addNote: (n: Omit<Note, 'id' | 'createdAt'>) => Promise<Note | null>;
  upsertAccommodation: (employeeId: string, patch: Partial<AccommodationRequest>) => Promise<void>;
  addFormTemplate: (f: Omit<FormTemplate, 'id' | 'createdAt'>) => Promise<FormTemplate | null>;
  updateFormTemplate: (id: string, patch: Partial<FormTemplate>) => Promise<void>;
  addFormSubmission: (f: Omit<FormSubmission, 'id' | 'createdAt'>) => Promise<FormSubmission | null>;
  updateFormSubmission: (id: string, patch: Partial<FormSubmission>) => Promise<void>;
  clockIn: (params: { employeeId: string; projectId: string | null }) => Promise<void>;
  clockOut: (timesheetId: string) => Promise<void>;
  addSignatureRequest: (s: Omit<SignatureRequest, 'id' | 'createdAt' | 'status'>) => Promise<SignatureRequest | null>;
  inviteUser: (params: { type: 'employee' | 'client'; targetId: string; email: string }) => Promise<{ success: boolean; error?: string }>;
  addPayrollRun: (r: Omit<PayrollRun, 'id' | 'createdAt'>) => Promise<PayrollRun | null>;
  updatePayrollRun: (id: string, patch: Partial<PayrollRun>) => Promise<void>;
  // Deliberately not part of `data` — SSN/address are fetched one employee at
  // a time on demand, never bulk-loaded into every session's memory.
  getEmployeeTaxInfo: (employeeId: string) => Promise<EmployeeTaxInfo | null>;
  setEmployeeTaxInfo: (employeeId: string, patch: Partial<EmployeeTaxInfo>) => Promise<boolean>;
}

const emptyData: AppData = {
  companies: [], clients: [], employees: [], projects: [], timesheets: [], onboardingDocs: [],
  notes: [], accommodationRequests: [], formTemplates: [], formSubmissions: [], signatureRequests: [],
  profiles: [], payrollRuns: [], currentCompanyId: null,
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [data, setData] = useState<AppData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!profile) { setData(emptyData); setLoading(false); return; }
    setLoading(true);
    setLoadError(null);
    try {
      const [companiesRes, clientsRes, employeesRes, projectsRes, timesheetsRes, docsRes, notesRes, accomRes, templatesRes, submissionsRes, sigReqRes, profilesRes, runsRes] = await Promise.all([
        supabase.from('companies').select('*').eq('id', profile.companyId),
        supabase.from('clients').select('*'),
        supabase.from('employees').select('*'),
        supabase.from('projects').select('*'),
        supabase.from('timesheets').select('*'),
        supabase.from('onboarding_documents').select('*'),
        supabase.from('notes').select('*'),
        supabase.from('accommodation_requests').select('*'),
        supabase.from('form_templates').select('*'),
        supabase.from('form_submissions').select('*'),
        supabase.from('signature_requests').select('*'),
        supabase.from('profiles').select('*'),
        supabase.from('payroll_runs').select('*'),
      ]);

      // Each resource is handled independently: a missing table (e.g. a
      // migration that hasn't been run yet) only zeroes out that one
      // piece of data and logs a warning — it should never blank the
      // entire app just because one newer feature's table isn't there.
      const warn = (label: string, err: any) => {
        if (err) console.warn(`Could not load "${label}" — has its migration been run? `, err.message ?? err);
      };
      warn('companies', companiesRes.error);
      warn('clients', clientsRes.error);
      warn('employees', employeesRes.error);
      warn('projects', projectsRes.error);
      warn('timesheets', timesheetsRes.error);
      warn('onboarding_documents', docsRes.error);
      warn('notes', notesRes.error);
      warn('accommodation_requests', accomRes.error);
      warn('form_templates', templatesRes.error);
      warn('form_submissions', submissionsRes.error);
      warn('signature_requests', sigReqRes.error);
      warn('profiles', profilesRes.error);
      warn('payroll_runs', runsRes.error);

      setData({
        companies: (companiesRes.data ?? []).map(rowToCompany),
        clients: (clientsRes.data ?? []).map(rowToClient),
        employees: (employeesRes.data ?? []).map(rowToEmployee),
        projects: (projectsRes.data ?? []).map(rowToProject),
        timesheets: (timesheetsRes.data ?? []).map(rowToTimesheet),
        onboardingDocs: (docsRes.data ?? []).map(rowToDoc),
        notes: (notesRes.data ?? []).map(rowToNote),
        accommodationRequests: (accomRes.data ?? []).map(rowToAccommodation),
        formTemplates: (templatesRes.data ?? []).map(rowToFormTemplate),
        formSubmissions: (submissionsRes.data ?? []).map(rowToFormSubmission),
        signatureRequests: (sigReqRes.data ?? []).map(rowToSignatureRequest),
        profiles: (profilesRes.data ?? []).map(rowToProfileSummary),
        payrollRuns: (runsRes.data ?? []).map(rowToPayrollRun),
        currentCompanyId: profile.companyId,
      });
    } catch (e: any) {
      console.error('Failed to load data', e);
      setLoadError(e.message ?? 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => { refresh(); }, [refresh]);

  const value = useMemo<AppContextValue>(() => ({
    data,
    company: data.companies[0] ?? { id: '', name: '', state: 'OR', payFrequency: 'biweekly', overtimeMultiplier: 1.5, overtimeThresholdWeekly: 40, createdAt: '' },
    loading,
    loadError,
    refresh,

    setCompany: async (patch) => {
      if (!profile) return;
      const { data: row, error } = await supabase.from('companies').update(companyToRow(patch)).eq('id', profile.companyId).select().single();
      if (error) { console.error(error); return; }
      setData(prev => ({ ...prev, companies: prev.companies.map(c => c.id === row.id ? rowToCompany(row) : c) }));
    },

    addEmployee: async (e) => {
      if (!profile) return null;
      const { data: row, error } = await supabase.from('employees').insert(employeeToRow({ ...e, companyId: profile.companyId })).select().single();
      if (error) { console.error(error); return null; }
      const employee = rowToEmployee(row);
      setData(prev => ({ ...prev, employees: [...prev.employees, employee] }));

      // Auto-assign any form templates flagged auto_assign (the standard
      // W-4/I-9, and any custom ones an admin has opted in) as pending
      // submissions for this new employee.
      const autoAssignTemplates = data.formTemplates.filter(t => t.active && t.autoAssign);
      if (autoAssignTemplates.length > 0) {
        const rows = autoAssignTemplates.map(t => formSubmissionToRow({
          companyId: profile.companyId, templateId: t.id, employeeId: employee.id,
          responses: {}, status: 'pending', visibleToClient: false,
        }));
        const { data: subRows, error: subErr } = await supabase.from('form_submissions').insert(rows).select();
        if (subErr) console.error('Could not auto-assign onboarding forms', subErr);
        else setData(prev => ({ ...prev, formSubmissions: [...prev.formSubmissions, ...(subRows ?? []).map(rowToFormSubmission)] }));
      }

      return employee;
    },
    updateEmployee: async (id, patch) => {
      setData(prev => ({ ...prev, employees: prev.employees.map(e => e.id === id ? { ...e, ...patch } : e) }));
      const { error } = await supabase.from('employees').update(employeeToRow(patch)).eq('id', id);
      if (error) { console.error(error); refresh(); }
    },

    addProject: async (p) => {
      if (!profile) return null;
      const { data: row, error } = await supabase.from('projects').insert(projectToRow({ ...p, companyId: profile.companyId })).select().single();
      if (error) { console.error(error); return null; }
      const project = rowToProject(row);
      setData(prev => ({ ...prev, projects: [...prev.projects, project] }));
      return project;
    },
    updateProject: async (id, patch) => {
      setData(prev => ({ ...prev, projects: prev.projects.map(p => p.id === id ? { ...p, ...patch } : p) }));
      const { error } = await supabase.from('projects').update(projectToRow(patch)).eq('id', id);
      if (error) { console.error(error); refresh(); }
    },

    addClient: async (c) => {
      if (!profile) return null;
      const { data: row, error } = await supabase.from('clients').insert(clientToRow({ ...c, companyId: profile.companyId })).select().single();
      if (error) { console.error(error); return null; }
      const client = rowToClient(row);
      setData(prev => ({ ...prev, clients: [...prev.clients, client] }));
      return client;
    },
    updateClient: async (id, patch) => {
      setData(prev => ({ ...prev, clients: prev.clients.map(c => c.id === id ? { ...c, ...patch } : c) }));
      const { error } = await supabase.from('clients').update(clientToRow(patch)).eq('id', id);
      if (error) { console.error(error); refresh(); }
    },

    addTimesheet: async (t) => {
      if (!profile) return null;
      const { data: row, error } = await supabase.from('timesheets').insert(timesheetToRow({ ...t, companyId: profile.companyId })).select().single();
      if (error) { console.error(error); return null; }
      const ts = rowToTimesheet(row);
      setData(prev => ({ ...prev, timesheets: [...prev.timesheets, ts] }));
      return ts;
    },
    updateTimesheet: async (id, patch) => {
      setData(prev => ({ ...prev, timesheets: prev.timesheets.map(t => t.id === id ? { ...t, ...patch } : t) }));
      const { error } = await supabase.from('timesheets').update(timesheetToRow(patch)).eq('id', id);
      if (error) { console.error(error); refresh(); }
    },

    addOnboardingDoc: async (d) => {
      const { data: row, error } = await supabase.from('onboarding_documents').insert(docToRow(d)).select().single();
      if (error) { console.error(error); return null; }
      const doc = rowToDoc(row);
      setData(prev => ({ ...prev, onboardingDocs: [...prev.onboardingDocs, doc] }));
      return doc;
    },
    updateOnboardingDoc: async (id, patch) => {
      setData(prev => ({ ...prev, onboardingDocs: prev.onboardingDocs.map(d => d.id === id ? { ...d, ...patch } : d) }));
      const { error } = await supabase.from('onboarding_documents').update(docToRow(patch)).eq('id', id);
      if (error) { console.error(error); refresh(); }
    },
    removeOnboardingDoc: async (id) => {
      setData(prev => ({ ...prev, onboardingDocs: prev.onboardingDocs.filter(d => d.id !== id) }));
      const { error } = await supabase.from('onboarding_documents').delete().eq('id', id);
      if (error) { console.error(error); refresh(); }
    },

    addNote: async (n) => {
      if (!profile) return null;
      const { data: row, error } = await supabase.from('notes').insert(noteToRow({ ...n, companyId: profile.companyId })).select().single();
      if (error) { console.error(error); return null; }
      const note = rowToNote(row);
      setData(prev => ({ ...prev, notes: [...prev.notes, note] }));
      return note;
    },

    upsertAccommodation: async (employeeId, patch) => {
      const existing = data.accommodationRequests.find(a => a.employeeId === employeeId);
      const merged = { ...(existing ?? { employeeId, needsAccommodation: false, status: 'none' as const, visibleToClient: true, updatedAt: new Date().toISOString() }), ...patch };
      setData(prev => ({
        ...prev,
        accommodationRequests: existing
          ? prev.accommodationRequests.map(a => a.employeeId === employeeId ? merged : a)
          : [...prev.accommodationRequests, merged],
      }));
      const { error } = await supabase.from('accommodation_requests').upsert(accommodationToRow({ ...patch, employeeId }));
      if (error) { console.error(error); refresh(); }
    },

    addFormTemplate: async (f) => {
      if (!profile) return null;
      const { data: row, error } = await supabase.from('form_templates').insert(formTemplateToRow({ ...f, companyId: profile.companyId })).select().single();
      if (error) { console.error(error); return null; }
      const tpl = rowToFormTemplate(row);
      setData(prev => ({ ...prev, formTemplates: [...prev.formTemplates, tpl] }));
      return tpl;
    },
    updateFormTemplate: async (id, patch) => {
      setData(prev => ({ ...prev, formTemplates: prev.formTemplates.map(t => t.id === id ? { ...t, ...patch } : t) }));
      const { error } = await supabase.from('form_templates').update(formTemplateToRow(patch)).eq('id', id);
      if (error) { console.error(error); refresh(); }
    },

    addFormSubmission: async (f) => {
      if (!profile) return null;
      const { data: row, error } = await supabase.from('form_submissions').insert(formSubmissionToRow({ ...f, companyId: profile.companyId })).select().single();
      if (error) { console.error(error); return null; }
      const sub = rowToFormSubmission(row);
      setData(prev => ({ ...prev, formSubmissions: [...prev.formSubmissions, sub] }));
      return sub;
    },
    updateFormSubmission: async (id, patch) => {
      setData(prev => ({ ...prev, formSubmissions: prev.formSubmissions.map(s => s.id === id ? { ...s, ...patch } : s) }));
      const { error } = await supabase.from('form_submissions').update(formSubmissionToRow(patch)).eq('id', id);
      if (error) { console.error(error); refresh(); }
    },

    clockIn: async ({ employeeId, projectId }) => {
      if (!profile) return;
      const start = new Date();
      const monday = new Date(start);
      const day = monday.getDay();
      monday.setDate(monday.getDate() + (day === 0 ? -6 : 1 - day));
      monday.setHours(0, 0, 0, 0);
      const weekStart = monday.toISOString().slice(0, 10);
      const end = new Date(monday); end.setDate(end.getDate() + 6);
      const weekEnd = end.toISOString().slice(0, 10);

      let ts = data.timesheets.find(t => t.employeeId === employeeId && t.weekStartDate === weekStart);
      const session = { projectId, startedAt: start.toISOString() };

      if (!ts) {
        const { data: row, error } = await supabase.from('timesheets').insert(timesheetToRow({
          companyId: profile.companyId, employeeId, weekStartDate: weekStart, weekEndDate: weekEnd,
          entries: [], status: 'draft', activeSession: session,
        } as any)).select().single();
        if (error) { console.error(error); return; }
        const newTs = rowToTimesheet(row);
        setData(prev => ({ ...prev, timesheets: [...prev.timesheets, newTs] }));
      } else {
        setData(prev => ({ ...prev, timesheets: prev.timesheets.map(t => t.id === ts!.id ? { ...t, activeSession: session } : t) }));
        const { error } = await supabase.from('timesheets').update({ active_session: session }).eq('id', ts.id);
        if (error) { console.error(error); refresh(); }
      }
    },

    clockOut: async (timesheetId) => {
      const ts = data.timesheets.find(t => t.id === timesheetId);
      if (!ts || !ts.activeSession) return;
      const endedAt = new Date().toISOString();
      const startedAt = ts.activeSession.startedAt;
      const hours = Math.max(0, (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 3_600_000);
      const today = endedAt.slice(0, 10);
      const projectId = ts.activeSession.projectId;

      const existingEntry = ts.entries.find(e => e.date === today && e.projectId === projectId);
      const nextEntries = existingEntry
        ? ts.entries.map(e => e === existingEntry ? { ...e, hours: Math.round((e.hours + hours) * 100) / 100 } : e)
        : [...ts.entries, { id: crypto.randomUUID(), date: today, projectId, hours: Math.round(hours * 100) / 100 }];

      const session = { id: crypto.randomUUID(), date: today, projectId, startedAt, endedAt, hours: Math.round(hours * 100) / 100 };
      const nextSessions = [...ts.clockSessions, session];

      setData(prev => ({
        ...prev,
        timesheets: prev.timesheets.map(t => t.id === ts.id ? { ...t, entries: nextEntries, clockSessions: nextSessions, activeSession: null } : t),
      }));
      const { error } = await supabase.from('timesheets').update({
        entries: nextEntries, clock_sessions: nextSessions, active_session: null,
      }).eq('id', ts.id);
      if (error) { console.error(error); refresh(); }
    },

    addSignatureRequest: async (s) => {
      if (!profile) return null;
      const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
      const { data: row, error } = await supabase.from('signature_requests').insert(
        signatureRequestToRow({ ...s, companyId: profile.companyId, token, createdBy: profile.id })
      ).select().single();
      if (error) { console.error(error); return null; }
      const req = rowToSignatureRequest(row);
      setData(prev => ({ ...prev, signatureRequests: [...prev.signatureRequests, req] }));
      return req;
    },

    inviteUser: async ({ type, targetId, email }) => {
      try {
        const { data: res, error } = await supabase.functions.invoke('invite-user', {
          body: { type, targetId, email, siteUrl: window.location.origin },
        });
        if (error) return { success: false, error: error.message };
        if ((res as any)?.error) return { success: false, error: (res as any).error };
        await refresh();
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err?.message ?? 'Unknown error' };
      }
    },

    addPayrollRun: async (r) => {
      if (!profile) return null;
      const { data: row, error } = await supabase.from('payroll_runs').insert(payrollRunToRow({ ...r, companyId: profile.companyId })).select().single();
      if (error) { console.error(error); return null; }
      const run = rowToPayrollRun(row);
      setData(prev => ({ ...prev, payrollRuns: [...prev.payrollRuns, run] }));
      return run;
    },
    updatePayrollRun: async (id, patch) => {
      setData(prev => ({ ...prev, payrollRuns: prev.payrollRuns.map(r => r.id === id ? { ...r, ...patch } : r) }));
      const { error } = await supabase.from('payroll_runs').update(payrollRunToRow(patch)).eq('id', id);
      if (error) { console.error(error); refresh(); }
    },

    getEmployeeTaxInfo: async (employeeId) => {
      const { data: row, error } = await supabase.from('employee_tax_info').select('*').eq('employee_id', employeeId).maybeSingle();
      if (error) { console.error(error); return null; }
      return row ? rowToEmployeeTaxInfo(row) : null;
    },
    setEmployeeTaxInfo: async (employeeId, patch) => {
      if (!profile) return false;
      const row = { ...employeeTaxInfoToRow({ ...patch, employeeId, companyId: profile.companyId }), updated_at: new Date().toISOString() };
      const { error } = await supabase.from('employee_tax_info').upsert(row, { onConflict: 'employee_id' });
      if (error) { console.error(error); return false; }
      return true;
    },
  }), [data, loading, loadError, profile, refresh]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
