import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../lib/AppContext';
import { useAuth } from '../lib/AuthContext';
import { Badge, Button, Card, Field, SectionLabel, inputClass } from '../components/ui';
import { formatDate, initials, money } from '../lib/format';
import { SignaturePad, SignaturePreview } from '../components/SignaturePad';
import { StandardOrCustomForm } from '../components/StandardOrCustomForm';
import { uid } from '../lib/db';
import { supabase } from '../lib/supabaseClient';
import { buildW2Pdf } from '../lib/pdfExport';
import { computeW2Totals } from '../lib/payroll';
import type { EmployeeRate, EmployeeTaxInfo, FilingStatus, OnboardingDocStatus, USState } from '../lib/types';

const US_STATES: USState[] = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'];

export function EmployeeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, updateEmployee, deleteEmployee, addOnboardingDoc, updateOnboardingDoc, addProject } = useApp();
  const employee = data.employees.find(e => e.id === id);
  const [signingDocId, setSigningDocId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  if (!employee) {
    return <div><p className="text-[var(--muted)]">Employee not found.</p><Link to="/employees" className="text-[var(--accent)] underline">Back</Link></div>;
  }

  const docs = data.onboardingDocs.filter(d => d.employeeId === employee.id);
  const assignedProjects = data.projects.filter(p => employee.projectIds.includes(p.id));
  const availableProjects = data.projects.filter(p => !employee.projectIds.includes(p.id));

  async function handleFileUpload(docId: string, file: File) {
    const path = `${employee!.id}/${docId}-${file.name}`;
    const { error } = await supabase.storage.from('onboarding-docs').upload(path, file, { upsert: true });
    if (error) { console.error(error); alert('Upload failed: ' + error.message); return; }
    updateOnboardingDoc(docId, { status: 'uploaded', fileDataUrl: path, fileName: file.name, updatedAt: new Date().toISOString() });
  }

  async function viewFile(path: string) {
    const { data: signed, error } = await supabase.storage.from('onboarding-docs').createSignedUrl(path, 60);
    if (error || !signed) { alert('Could not open file.'); return; }
    window.open(signed.signedUrl, '_blank');
  }

  function markStatus(docId: string, status: OnboardingDocStatus) {
    updateOnboardingDoc(docId, { status, updatedAt: new Date().toISOString() });
  }

  function addDoc(name: string) {
    addOnboardingDoc({ employeeId: employee!.id, name, required: true, status: 'pending', updatedAt: new Date().toISOString() });
  }

  function toggleProject(projectId: string, assign: boolean) {
    const next = assign ? [...employee!.projectIds, projectId] : employee!.projectIds.filter(p => p !== projectId);
    updateEmployee(employee!.id, { projectIds: next });
  }

  function setProjectRate(projectId: string, rateVal: number) {
    const existing = employee!.rates.find(r => r.projectId === projectId);
    let next: EmployeeRate[];
    if (existing) {
      next = employee!.rates.map(r => r.projectId === projectId ? { ...r, hourlyRate: rateVal } : r);
    } else {
      next = [...employee!.rates, { id: uid(), projectId, hourlyRate: rateVal, effectiveDate: new Date().toISOString().slice(0, 10) }];
    }
    updateEmployee(employee!.id, { rates: next });
  }

  const allDocsSigned = docs.filter(d => d.required).every(d => d.status === 'signed' || d.status === 'waived');
  const hasLogin = data.profiles.some(p => p.employeeId === employee.id);
  const hasPayrollHistory = data.payrollRuns.some(r => r.lineItems.some(l => l.employeeId === employee.id));

  const isArchived = employee.status === 'terminated';
  function toggleArchive() {
    updateEmployee(employee!.id, { status: isArchived ? 'active' : 'terminated' });
  }

  async function handleDelete() {
    setDeleting(true);
    const ok = await deleteEmployee(employee!.id);
    if (ok) navigate('/employees');
    else { setDeleting(false); alert('Could not delete this employee — check the browser console for details.'); }
  }

  return (
    <div className="space-y-6">
      <Link to="/employees" className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">← Employees</Link>

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-[var(--accent-soft)] text-[var(--accent-dark)] flex items-center justify-center font-semibold text-lg">
            {initials(employee.firstName, employee.lastName)}
          </div>
          <div>
            <h1 className="font-display text-3xl">{employee.firstName} {employee.lastName}</h1>
            <p className="text-[var(--ink-soft)]">{employee.title} · hired {formatDate(employee.hireDate)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <InviteControl employeeId={employee.id} defaultEmail={employee.email} />
          <select value={employee.status} onChange={e => updateEmployee(employee.id, { status: e.target.value as any })}
            className="focus-ring rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-sm">
            <option value="onboarding">Onboarding</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="terminated">Terminated</option>
          </select>
          <Button variant="secondary" size="sm" onClick={toggleArchive}>
            {isArchived ? 'Restore employee' : 'Archive employee'}
          </Button>
        </div>
      </div>

      {employee.status === 'onboarding' && !allDocsSigned && (
        <div className="rounded-md border border-[var(--pending)]/30 bg-[var(--pending-soft)] px-4 py-3 text-sm text-[var(--pending)]">
          This employee still has required onboarding documents outstanding. Activate them once everything is signed.
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        <Card>
          <SectionLabel>Pay &amp; tax setup</SectionLabel>
          <div className="space-y-3 mt-2">
            <Field label="Pay type">
              <select value={employee.payType} onChange={e => updateEmployee(employee.id, { payType: e.target.value as any })} className={inputClass}>
                <option value="hourly">Hourly</option>
                <option value="salary">Salary</option>
              </select>
            </Field>
            {employee.payType === 'hourly' ? (
              <Field label="Base hourly rate">
                <input type="number" step={0.5} value={employee.defaultHourlyRate}
                  onChange={e => updateEmployee(employee.id, { defaultHourlyRate: parseFloat(e.target.value) || 0 })} className={inputClass} />
              </Field>
            ) : (
              <Field label="Annual salary">
                <input type="number" step={500} value={employee.salaryAnnual ?? 0}
                  onChange={e => updateEmployee(employee.id, { salaryAnnual: parseFloat(e.target.value) || 0 })} className={inputClass} />
              </Field>
            )}
            <Field label="Work state (withholding)">
              <select value={employee.state} onChange={e => updateEmployee(employee.id, { state: e.target.value as USState })} className={inputClass}>
                {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Federal filing status">
              <select value={employee.filingStatus} onChange={e => updateEmployee(employee.id, { filingStatus: e.target.value as FilingStatus })} className={inputClass}>
                <option value="single">Single</option>
                <option value="married_joint">Married filing jointly</option>
                <option value="head_of_household">Head of household</option>
              </select>
            </Field>
            <Field label="Extra withholding per paycheck (W-4 4c)">
              <input type="number" step={5} value={employee.federalAllowancesExtraWithholding}
                onChange={e => updateEmployee(employee.id, { federalAllowancesExtraWithholding: parseFloat(e.target.value) || 0 })} className={inputClass} />
            </Field>
            <Field label="Annual dependents credit (W-4 step 3)">
              <input type="number" step={100} value={employee.dependentsCredit}
                onChange={e => updateEmployee(employee.id, { dependentsCredit: parseFloat(e.target.value) || 0 })} className={inputClass} />
            </Field>
          </div>
        </Card>

        <Card>
          <SectionLabel>Projects &amp; rates</SectionLabel>
          <div className="space-y-2 mt-2">
            {assignedProjects.length === 0 && <p className="text-sm text-[var(--muted)]">Not assigned to any projects yet.</p>}
            {assignedProjects.map(p => {
              const rate = employee.rates.find(r => r.projectId === p.id);
              return (
                <div key={p.id} className="flex items-center justify-between gap-2 border border-[var(--border-soft)] rounded-md px-3 py-2">
                  <div>
                    <div className="text-sm font-medium">{p.name}</div>
                    <div className="text-xs text-[var(--muted)]">{p.code}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {employee.payType === 'hourly' && (
                      <div className="flex items-center gap-1 text-sm">
                        <span className="text-[var(--muted)]">$</span>
                        <input type="number" step={0.5} placeholder={String(employee.defaultHourlyRate)}
                          value={rate?.hourlyRate ?? ''}
                          onChange={e => setProjectRate(p.id, parseFloat(e.target.value) || 0)}
                          className="w-16 tabular text-right rounded border border-[var(--border)] px-1.5 py-1" />
                        <span className="text-[var(--muted)]">/hr</span>
                      </div>
                    )}
                    <button onClick={() => toggleProject(p.id, false)} className="focus-ring text-xs text-[var(--muted)] hover:text-[var(--bad)]">Remove</button>
                  </div>
                </div>
              );
            })}
          </div>
          {availableProjects.length > 0 && (
            <div className="mt-3">
              <select onChange={e => { if (e.target.value) { toggleProject(e.target.value, true); e.target.value = ''; } }} defaultValue="" className={inputClass}>
                <option value="" disabled>+ Assign a project…</option>
                {availableProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
          <AddProjectInline companyId={data.currentCompanyId!} onCreate={async (p) => { const created = await addProject(p); if (created) toggleProject(created.id, true); }} />
        </Card>

        <Card>
          <SectionLabel>Estimated pay</SectionLabel>
          <div className="font-display text-3xl mt-1">
            {employee.payType === 'hourly' ? `${money(employee.defaultHourlyRate)}/hr` : money((employee.salaryAnnual ?? 0) / 26)}
          </div>
          <div className="text-xs text-[var(--muted)] mt-1">{employee.payType === 'hourly' ? 'base rate before project overrides' : 'per biweekly pay period'}</div>
          <div className="mt-4 pt-4 border-t border-[var(--border-soft)] text-sm space-y-1">
            <div className="flex justify-between"><span className="text-[var(--muted)]">Email</span><span>{employee.email || '—'}</span></div>
            <div className="flex justify-between"><span className="text-[var(--muted)]">State</span><span>{employee.state}</span></div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <SectionLabel>Onboarding documents</SectionLabel>
          <AddDocInline onAdd={addDoc} />
        </div>
        <div className="divide-y divide-[var(--border-soft)]">
          {docs.map(doc => (
            <div key={doc.id} className="py-3 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{doc.name} {!doc.required && <span className="text-xs text-[var(--muted)]">(optional)</span>}</div>
                {doc.fileName && (
                  <button onClick={() => viewFile(doc.fileDataUrl!)} className="text-xs text-[var(--accent)] hover:underline truncate block">
                    {doc.fileName}
                  </button>
                )}
                {doc.signature && <div className="mt-1"><SignaturePreview sig={doc.signature} /></div>}
              </div>
              <DocStatusBadge status={doc.status} />
              <div className="flex items-center gap-2 shrink-0">
                <input
                  ref={el => { fileInputRefs.current[doc.id] = el; }}
                  type="file" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(doc.id, f); }}
                />
                <Button size="sm" variant="secondary" onClick={() => fileInputRefs.current[doc.id]?.click()}>Upload</Button>
                {doc.status !== 'signed' && (
                  <Button size="sm" onClick={() => setSigningDocId(doc.id)}>Sign</Button>
                )}
                {doc.required && doc.status !== 'signed' && (
                  <Button size="sm" variant="ghost" onClick={() => markStatus(doc.id, 'waived')}>Waive</Button>
                )}
              </div>
            </div>
          ))}
          {docs.length === 0 && <p className="text-sm text-[var(--muted)] py-4">No onboarding documents yet.</p>}
        </div>
        {signingDocId && (
          <div className="mt-4">
            <SignaturePad
              defaultName={`${employee.firstName} ${employee.lastName}`}
              onSign={(sig) => { updateOnboardingDoc(signingDocId, { status: 'signed', signature: sig, updatedAt: new Date().toISOString() }); setSigningDocId(null); }}
              onCancel={() => setSigningDocId(null)}
            />
          </div>
        )}
      </Card>

      <TaxProfileCard employeeId={employee.id} />
      <AccommodationCard employeeId={employee.id} />
      <FormsCard employeeId={employee.id} />
      <NotesCard employeeId={employee.id} />

      <div className="pt-6 border-t border-[var(--border-soft)] flex flex-col items-end gap-3">
        {!showDeleteConfirm ? (
          <Button variant="danger" size="sm" onClick={() => setShowDeleteConfirm(true)}>Delete employee</Button>
        ) : (
          <div className="rounded-md border border-[var(--bad)]/30 bg-[var(--bad-soft)] px-4 py-4 text-sm space-y-3 w-full max-w-lg">
            <p className="text-[var(--bad)] font-medium">
              Permanently delete {employee.firstName} {employee.lastName}? This cannot be undone.
            </p>
            <ul className="list-disc pl-5 text-[var(--ink-soft)] space-y-1">
              <li>Their timesheets, onboarding documents, forms, and tax profile will be permanently deleted.</li>
              {hasLogin && (
                <li>They have a portal login — it won't be deleted, but will be disconnected from this record.
                  Their email won't be available to invite a new employee until that login is removed in Supabase.</li>
              )}
              {hasPayrollHistory && (
                <li>They appear in past payroll runs — those records are kept as-is (dollar amounts stay accurate),
                  but will show a blank name once this record is gone.</li>
              )}
            </ul>
            <p className="text-[var(--ink-soft)]">
              If this person simply no longer works here, use <strong>Archive employee</strong> at the top of the
              page instead — that keeps all their history intact and just hides them from the main list.
            </p>
            <div className="flex gap-2 pt-1">
              <Button variant="danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Yes, permanently delete'}
              </Button>
              <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TaxProfileCard({ employeeId }: { employeeId: string }) {
  const { data, getEmployeeTaxInfo, setEmployeeTaxInfo } = useApp();
  const [info, setInfo] = useState<EmployeeTaxInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [ssn, setSsn] = useState('');
  const [revealSsn, setRevealSsn] = useState(false);
  const [addr1, setAddr1] = useState('');
  const [addr2, setAddr2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [saved, setSaved] = useState(false);
  const [w2Year, setW2Year] = useState(new Date().getFullYear());
  const [w2Status, setW2Status] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getEmployeeTaxInfo(employeeId).then(ti => {
      if (cancelled) return;
      setInfo(ti);
      setSsn(ti?.ssn ?? '');
      setAddr1(ti?.addressLine1 ?? '');
      setAddr2(ti?.addressLine2 ?? '');
      setCity(ti?.city ?? '');
      setState(ti?.state ?? '');
      setZip(ti?.zip ?? '');
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [employeeId, getEmployeeTaxInfo]);

  async function save() {
    const ok = await setEmployeeTaxInfo(employeeId, { ssn, addressLine1: addr1, addressLine2: addr2, city, state, zip });
    if (ok) { setSaved(true); setTimeout(() => setSaved(false), 1800); }
  }

  const employee = data.employees.find(e => e.id === employeeId);
  const company = data.companies.find(c => c.id === employee?.companyId);

  async function downloadW2() {
    if (!employee || !company) return;
    setW2Status(null);
    const totals = computeW2Totals(employeeId, w2Year, data.payrollRuns);
    if (totals.wages === 0) { setW2Status(`No finalized pay found for ${w2Year}.`); return; }
    const doc = buildW2Pdf({
      year: w2Year,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      ssn: info?.ssn,
      employeeAddress: { line1: info?.addressLine1, line2: info?.addressLine2, city: info?.city, state: info?.state, zip: info?.zip },
      companyName: company.name,
      ein: company.ein,
      companyAddress: company.address,
      stateWithholdingAccountNumber: company.stateWithholdingAccountNumber,
      stateUnemploymentAccountNumber: company.stateUnemploymentAccountNumber,
      ...totals,
    });
    doc.save(`w2-${employee.lastName}-${w2Year}.pdf`);
  }

  return (
    <Card className="space-y-4">
      <SectionLabel>Tax profile</SectionLabel>
      <p className="text-sm text-[var(--ink-soft)]">
        SSN and home address, used only for W-2 generation. Kept separate from the employee record and only
        readable by admins and the employee themselves.
      </p>
      {loading ? <p className="text-sm text-[var(--muted)]">Loading…</p> : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Social Security number">
              <div className="flex items-center gap-2">
                <input
                  type={revealSsn ? 'text' : 'password'}
                  value={ssn}
                  onChange={e => setSsn(e.target.value)}
                  className={inputClass}
                  placeholder="XXX-XX-XXXX"
                />
                <button type="button" onClick={() => setRevealSsn(v => !v)} className="focus-ring text-xs text-[var(--accent)] hover:underline shrink-0">
                  {revealSsn ? 'Hide' : 'Show'}
                </button>
              </div>
            </Field>
            <Field label="Zip"><input value={zip} onChange={e => setZip(e.target.value)} className={inputClass} /></Field>
            <Field label="Address line 1"><input value={addr1} onChange={e => setAddr1(e.target.value)} className={inputClass} /></Field>
            <Field label="Address line 2"><input value={addr2} onChange={e => setAddr2(e.target.value)} className={inputClass} /></Field>
            <Field label="City"><input value={city} onChange={e => setCity(e.target.value)} className={inputClass} /></Field>
            <Field label="State">
              <select value={state} onChange={e => setState(e.target.value)} className={inputClass}>
                <option value="">—</option>
                {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={save}>Save tax profile</Button>
            {saved && <span className="text-sm text-[var(--good)]">Saved.</span>}
          </div>

          <div className="border-t border-[var(--border-soft)] pt-4 flex items-center gap-2">
            <input
              type="number" value={w2Year} onChange={e => setW2Year(parseInt(e.target.value, 10) || w2Year)}
              className="focus-ring w-24 rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            />
            <Button size="sm" variant="secondary" onClick={downloadW2}>Download W-2 PDF</Button>
          </div>
          {w2Status && <p className="text-xs text-[var(--muted)]">{w2Status}</p>}
        </>
      )}
    </Card>
  );
}

function FormsCard({ employeeId }: { employeeId: string }) {
  const { data, addFormSubmission, updateFormSubmission } = useApp();
  const submissions = data.formSubmissions.filter(s => s.employeeId === employeeId);
  const assignedTemplateIds = new Set(submissions.map(s => s.templateId));
  const availableTemplates = data.formTemplates.filter(t => t.active && !assignedTemplateIds.has(t.id));

  return (
    <Card>
      <SectionLabel>Forms</SectionLabel>
      <div className="divide-y divide-[var(--border-soft)]">
        {submissions.map(sub => {
          const template = data.formTemplates.find(t => t.id === sub.templateId);
          return (
            <div key={sub.id} className="py-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">{template?.name ?? 'Form'}</div>
                <Badge tone={sub.status === 'submitted' ? 'good' : 'pending'}>{sub.status}</Badge>
              </div>
              {sub.status === 'submitted' && template && (
                <div className="mt-2 pl-3 border-l-2 border-[var(--border-soft)]">
                  <StandardOrCustomForm template={template} responses={sub.responses} readOnly />
                </div>
              )}
              <label className="flex items-center gap-2 text-xs text-[var(--muted)] mt-2">
                <input
                  type="checkbox"
                  checked={sub.visibleToClient}
                  onChange={e => updateFormSubmission(sub.id, { visibleToClient: e.target.checked })}
                />
                Visible to client
              </label>
            </div>
          );
        })}
        {submissions.length === 0 && <p className="text-sm text-[var(--muted)] py-3">No forms assigned yet.</p>}
      </div>
      {availableTemplates.length > 0 && (
        <select
          onChange={e => {
            if (!e.target.value) return;
            addFormSubmission({ templateId: e.target.value, employeeId, responses: {}, status: 'pending', visibleToClient: false } as any);
            e.target.value = '';
          }}
          defaultValue=""
          className={inputClass + ' mt-3'}
        >
          <option value="" disabled>+ Assign a form…</option>
          {availableTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      )}
    </Card>
  );
}

function AccommodationCard({ employeeId }: { employeeId: string }) {
  const { data, upsertAccommodation } = useApp();
  const record = data.accommodationRequests.find(a => a.employeeId === employeeId);

  return (
    <Card>
      <SectionLabel>Accommodation request</SectionLabel>
      {!record?.needsAccommodation ? (
        <p className="text-sm text-[var(--muted)]">No accommodation request on file for this employee.</p>
      ) : (
        <div className="space-y-3">
          <div className="text-sm whitespace-pre-wrap">{record.description}</div>
          <div className="text-xs text-[var(--muted)]">Submitted {record.submittedAt ? formatDate(record.submittedAt.slice(0, 10)) : '—'}</div>
        </div>
      )}
      <div className="mt-4 pt-4 border-t border-[var(--border-soft)] flex items-center gap-3">
        <Field label="Status">
          <select
            value={record?.status ?? 'none'}
            onChange={e => upsertAccommodation(employeeId, { status: e.target.value as any })}
            className={inputClass}
          >
            <option value="none">None</option>
            <option value="requested">Requested</option>
            <option value="in_review">In review</option>
            <option value="resolved">Resolved</option>
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm mt-5">
          <input
            type="checkbox"
            checked={record?.visibleToClient ?? true}
            onChange={e => upsertAccommodation(employeeId, { visibleToClient: e.target.checked })}
          />
          Visible to client
        </label>
      </div>
      <div className="mt-3">
        <Field label="Admin notes">
          <textarea
            value={record?.adminNotes ?? ''}
            onChange={e => upsertAccommodation(employeeId, { adminNotes: e.target.value })}
            rows={2} className={inputClass}
          />
        </Field>
      </div>
    </Card>
  );
}

function NotesCard({ employeeId }: { employeeId: string }) {
  const { data, addNote } = useApp();
  const { profile } = useAuth();
  const notes = data.notes.filter(n => n.employeeId === employeeId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const [body, setBody] = useState('');
  const [visibility, setVisibility] = useState<'internal' | 'shared_with_client'>('internal');

  function submit() {
    if (!body.trim()) return;
    addNote({
      companyId: data.currentCompanyId!, employeeId, authorId: profile?.id ?? null,
      authorLabel: profile?.email ?? 'Admin', body: body.trim(), visibility,
    } as any);
    setBody('');
  }

  return (
    <Card>
      <SectionLabel>Notes</SectionLabel>
      <div className="space-y-3 mb-4">
        {notes.length === 0 && <p className="text-sm text-[var(--muted)]">No notes yet.</p>}
        {notes.map(n => (
          <div key={n.id} className="text-sm border-b border-[var(--border-soft)] pb-3 last:border-0">
            <p className="whitespace-pre-wrap">{n.body}</p>
            <div className="flex items-center gap-2 mt-1 text-xs text-[var(--muted)]">
              <span>{n.authorLabel}</span>
              <span>·</span>
              <span>{formatDate(n.createdAt.slice(0, 10))}</span>
              {n.visibility === 'shared_with_client' && <Badge tone="pending">shared with client</Badge>}
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <textarea value={body} onChange={e => setBody(e.target.value)} rows={2} placeholder="Add a note…" className={inputClass} />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <input type="checkbox" checked={visibility === 'shared_with_client'} onChange={e => setVisibility(e.target.checked ? 'shared_with_client' : 'internal')} />
            Share with client
          </label>
          <Button size="sm" onClick={submit}>Add note</Button>
        </div>
      </div>
    </Card>
  );
}

function DocStatusBadge({ status }: { status: OnboardingDocStatus }) {
  const tone = status === 'signed' || status === 'waived' ? 'good' : status === 'uploaded' ? 'pending' : 'neutral';
  return <Badge tone={tone as any}>{status}</Badge>;
}

function AddDocInline({ onAdd }: { onAdd: (name: string) => void }) {
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  if (!open) return <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>+ Add document</Button>;
  return (
    <div className="flex items-center gap-2">
      <input autoFocus value={value} onChange={e => setValue(e.target.value)} placeholder="Document name"
        className="focus-ring rounded-md border border-[var(--border)] px-2 py-1 text-sm" />
      <Button size="sm" onClick={() => { if (value.trim()) { onAdd(value.trim()); setValue(''); setOpen(false); } }}>Add</Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
    </div>
  );
}

function AddProjectInline({ companyId, onCreate }: { companyId: string; onCreate: (p: any) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  if (!open) return <button onClick={() => setOpen(true)} className="focus-ring text-xs text-[var(--accent)] hover:underline mt-2">+ New project</button>;
  return (
    <div className="flex items-center gap-2 mt-2">
      <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Project name" className="focus-ring rounded-md border border-[var(--border)] px-2 py-1 text-sm flex-1" />
      <Button size="sm" onClick={() => {
        if (!name.trim()) return;
        onCreate({ companyId, name: name.trim(), code: name.trim().slice(0, 6).toUpperCase(), active: true });
        setName(''); setOpen(false);
      }}>Add</Button>
    </div>
  );
}

function InviteControl({ employeeId, defaultEmail }: { employeeId: string; defaultEmail: string }) {
  const { data, inviteUser } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState(defaultEmail);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasLogin = data.profiles.some(p => p.employeeId === employeeId);

  if (hasLogin) {
    return <Badge tone="good">has login</Badge>;
  }

  async function send() {
    if (!email.trim()) return;
    setSending(true);
    setError(null);
    const res = await inviteUser({ type: 'employee', targetId: employeeId, email: email.trim() });
    setSending(false);
    if (!res.success) { setError(res.error ?? 'Could not send invite.'); return; }
    setShowForm(false);
  }

  if (!showForm) {
    return <Button size="sm" variant="secondary" onClick={() => setShowForm(true)}>Invite to portal</Button>;
  }

  return (
    <div className="flex items-center gap-2">
      <input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@company.com" className="focus-ring rounded-md border border-[var(--border)] px-2 py-1.5 text-sm w-52" />
      <Button size="sm" onClick={send} disabled={sending || !email.trim()}>{sending ? 'Sending…' : 'Send invite'}</Button>
      <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
      {error && <span className="text-xs text-[var(--bad)]">{error}</span>}
    </div>
  );
}
