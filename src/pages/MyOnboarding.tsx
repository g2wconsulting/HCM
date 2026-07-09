import { useRef, useState } from 'react';
import { useApp } from '../lib/AppContext';
import { useAuth } from '../lib/AuthContext';
import { Badge, Button, Card, Field, SectionLabel, inputClass } from '../components/ui';
import { SignaturePad, SignaturePreview } from '../components/SignaturePad';
import { StandardOrCustomForm } from '../components/StandardOrCustomForm';
import { supabase } from '../lib/supabaseClient';
import type { OnboardingDocStatus } from '../lib/types';

export function MyOnboarding() {
  const { data, updateOnboardingDoc, upsertAccommodation } = useApp();
  const { profile } = useAuth();
  const employee = data.employees.find(e => e.id === profile?.employeeId);
  const [signingDocId, setSigningDocId] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [needsAccommodation, setNeedsAccommodation] = useState(false);
  const [description, setDescription] = useState('');
  const [savedJustNow, setSavedJustNow] = useState(false);

  if (!employee) return <p className="text-sm text-[var(--muted)]">Loading…</p>;

  const docs = data.onboardingDocs.filter(d => d.employeeId === employee.id);
  const accommodation = data.accommodationRequests.find(a => a.employeeId === employee.id);

  async function handleFileUpload(docId: string, file: File) {
    const path = `${employee!.id}/${docId}-${file.name}`;
    const { error } = await supabase.storage.from('onboarding-docs').upload(path, file, { upsert: true });
    if (error) { alert('Upload failed: ' + error.message); return; }
    updateOnboardingDoc(docId, { status: 'uploaded', fileDataUrl: path, fileName: file.name, updatedAt: new Date().toISOString() });
  }

  async function viewFile(path: string) {
    const { data: signed, error } = await supabase.storage.from('onboarding-docs').createSignedUrl(path, 60);
    if (error || !signed) { alert('Could not open file.'); return; }
    window.open(signed.signedUrl, '_blank');
  }

  function submitAccommodation() {
    upsertAccommodation(employee!.id, {
      needsAccommodation, description: description.trim() || undefined,
      status: needsAccommodation ? 'requested' : 'none',
      submittedAt: new Date().toISOString(),
    });
    setSavedJustNow(true);
    setTimeout(() => setSavedJustNow(false), 1800);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-3xl">Your onboarding</h1>
        <p className="text-[var(--ink-soft)] mt-1">Review and sign your required documents.</p>
      </div>

      <Card>
        <SectionLabel>Documents</SectionLabel>
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
                {doc.status !== 'signed' && (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => fileInputRefs.current[doc.id]?.click()}>Upload</Button>
                    <Button size="sm" onClick={() => setSigningDocId(doc.id)}>Sign</Button>
                  </>
                )}
              </div>
            </div>
          ))}
          {docs.length === 0 && <p className="text-sm text-[var(--muted)] py-4">Nothing to sign right now.</p>}
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

      <Card>
        <SectionLabel>Accommodation request</SectionLabel>
        <p className="text-sm text-[var(--ink-soft)] mb-3">
          Let us know if you need any workplace accommodations. This is saved on your record and shared with your
          placement site so they can plan for it — you can update it any time.
        </p>
        <label className="flex items-center gap-2 text-sm mb-3">
          <input
            type="checkbox"
            checked={needsAccommodation || (accommodation?.needsAccommodation ?? false)}
            onChange={e => setNeedsAccommodation(e.target.checked)}
          />
          I need a workplace accommodation
        </label>
        {(needsAccommodation || accommodation?.needsAccommodation) && (
          <Field label="Describe what you need">
            <textarea
              value={description || accommodation?.description || ''}
              onChange={e => setDescription(e.target.value)}
              rows={3} className={inputClass}
              placeholder="e.g. a standing desk, flexible start time, sign language interpretation for meetings…"
            />
          </Field>
        )}
        <div className="flex items-center gap-3 mt-3">
          <Button onClick={submitAccommodation}>Save</Button>
          {savedJustNow && <span className="text-sm text-[var(--good)]">Saved.</span>}
          {accommodation?.status && accommodation.status !== 'none' && <Badge tone="pending">{accommodation.status.replace('_', ' ')}</Badge>}
        </div>
      </Card>

      <FormsSection employeeId={employee.id} />
    </div>
  );
}

function FormsSection({ employeeId }: { employeeId: string }) {
  const { data, updateFormSubmission, updateEmployee } = useApp();
  const submissions = data.formSubmissions.filter(s => s.employeeId === employeeId);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string | number | boolean>>({});
  const [showSignFor, setShowSignFor] = useState<string | null>(null);

  if (submissions.length === 0) return null;

  function openForm(subId: string, initial: Record<string, string | number | boolean>) {
    setOpenId(subId);
    setDraft(initial);
  }

  function submit(subId: string, sig: any) {
    const submission = submissions.find(s => s.id === subId);
    const template = submission ? data.formTemplates.find(t => t.id === submission.templateId) : undefined;
    updateFormSubmission(subId, { responses: draft, status: 'submitted', signature: sig, submittedAt: new Date().toISOString() });

    // The W-4 is special-cased: its answers feed directly into the
    // employee's own tax withholding setup, rather than just living as
    // form responses — that's what "auto-populates to their profile" means.
    if (template?.standardKind === 'w4') {
      const filingStatusMap: Record<string, string> = {
        'Single or Married filing separately': 'single',
        'Married filing jointly': 'married_joint',
        'Head of household': 'head_of_household',
      };
      const qualifyingChildren = Number(draft['qualifying_children']) || 0;
      const otherDependents = Number(draft['other_dependents']) || 0;
      const dependentsCredit = qualifyingChildren * 2000 + otherDependents * 500;
      const filingStatus = filingStatusMap[draft['filing_status'] as string] as any;
      updateEmployee(employeeId, {
        ...(filingStatus ? { filingStatus } : {}),
        dependentsCredit,
        federalAllowancesExtraWithholding: Number(draft['extra_withholding']) || 0,
      });
    }

    setShowSignFor(null);
    setOpenId(null);
  }

  return (
    <Card>
      <SectionLabel>Forms to complete</SectionLabel>
      <div className="space-y-4">
        {submissions.map(sub => {
          const template = data.formTemplates.find(t => t.id === sub.templateId);
          if (!template) return null;
          const isOpen = openId === sub.id;
          return (
            <div key={sub.id} className="border border-[var(--border-soft)] rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{template.name}</div>
                  {template.description && <div className="text-xs text-[var(--muted)]">{template.description}</div>}
                </div>
                <Badge tone={sub.status === 'submitted' ? 'good' : 'pending'}>{sub.status}</Badge>
              </div>
              {sub.status === 'pending' && !isOpen && (
                <Button size="sm" onClick={() => openForm(sub.id, {})} title="Fill out">Fill out</Button>
              )}
              {isOpen && (
                <div className="mt-3 space-y-3">
                  <StandardOrCustomForm template={template} responses={draft} onChange={(id, v) => setDraft(prev => ({ ...prev, [id]: v }))} />
                  {showSignFor === sub.id ? (
                    <SignaturePad defaultName="" onSign={(sig) => submit(sub.id, sig)} onCancel={() => setShowSignFor(null)} />
                  ) : (
                    <Button size="sm" onClick={() => setShowSignFor(sub.id)}>Sign &amp; submit</Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function DocStatusBadge({ status }: { status: OnboardingDocStatus }) {
  const tone = status === 'signed' || status === 'waived' ? 'good' : status === 'uploaded' ? 'pending' : 'neutral';
  return <Badge tone={tone as any}>{status}</Badge>;
}
