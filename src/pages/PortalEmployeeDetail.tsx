import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApp } from '../lib/AppContext';
import { useAuth } from '../lib/AuthContext';
import { Badge, Button, Card, SectionLabel, inputClass } from '../components/ui';
import { formatDate, initials } from '../lib/format';
import { supabase } from '../lib/supabaseClient';
import { FormRenderer } from '../components/FormRenderer';

export function PortalEmployeeDetail() {
  const { id } = useParams();
  const { data, addNote } = useApp();
  const { profile } = useAuth();
  const employee = data.employees.find(e => e.id === id);
  const [body, setBody] = useState('');

  if (!employee) {
    return <div><p className="text-[var(--muted)]">Not found.</p><Link to="/portal/employees" className="text-[var(--accent)] underline">Back</Link></div>;
  }

  const docs = data.onboardingDocs.filter(d => d.employeeId === employee.id);
  const notes = data.notes.filter(n => n.employeeId === employee.id && n.visibility === 'shared_with_client')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const accommodation = data.accommodationRequests.find(a => a.employeeId === employee.id);
  const myProjects = data.projects.filter(p => employee.projectIds.includes(p.id));

  async function viewFile(path: string) {
    const { data: signed, error } = await supabase.storage.from('onboarding-docs').createSignedUrl(path, 60);
    if (error || !signed) { alert('Could not open file.'); return; }
    window.open(signed.signedUrl, '_blank');
  }

  function submitNote() {
    if (!body.trim() || !employee) return;
    addNote({
      companyId: data.currentCompanyId!, employeeId: employee.id, authorId: profile?.id ?? null,
      authorLabel: profile?.email ?? 'Client', body: body.trim(), visibility: 'shared_with_client',
    } as any);
    setBody('');
  }

  return (
    <div className="space-y-6">
      <Link to="/portal/employees" className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">← Your team</Link>

      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-[var(--accent-soft)] text-[var(--accent-dark)] flex items-center justify-center font-semibold text-lg">
          {initials(employee.firstName, employee.lastName)}
        </div>
        <div>
          <h1 className="font-display text-3xl">{employee.firstName} {employee.lastName}</h1>
          <p className="text-[var(--ink-soft)]">{employee.title}</p>
        </div>
        <Badge tone={employee.status === 'active' ? 'good' : 'neutral'}>{employee.status}</Badge>
      </div>

      <Card>
        <SectionLabel>Assignments with you</SectionLabel>
        <div className="space-y-1 text-sm">
          {myProjects.map(p => <div key={p.id}>{p.name}</div>)}
        </div>
      </Card>

      {accommodation?.needsAccommodation && accommodation.visibleToClient && (
        <Card>
          <SectionLabel>Accommodation notes</SectionLabel>
          <p className="text-sm whitespace-pre-wrap">{accommodation.description}</p>
        </Card>
      )}

      <FormsSharedCard employeeId={employee.id} />

      <Card>
        <SectionLabel>Documents</SectionLabel>
        <div className="divide-y divide-[var(--border-soft)]">
          {docs.map(doc => (
            <div key={doc.id} className="py-2 flex items-center justify-between">
              <span className="text-sm">{doc.name}</span>
              {doc.fileName ? (
                <button onClick={() => viewFile(doc.fileDataUrl!)} className="text-xs text-[var(--accent)] hover:underline">{doc.fileName}</button>
              ) : (
                <Badge tone={doc.status === 'signed' ? 'good' : 'neutral'}>{doc.status}</Badge>
              )}
            </div>
          ))}
          {docs.length === 0 && <p className="text-sm text-[var(--muted)] py-3">No documents shared yet.</p>}
        </div>
      </Card>

      <Card>
        <SectionLabel>Notes</SectionLabel>
        <div className="space-y-3 mb-4">
          {notes.map(n => (
            <div key={n.id} className="text-sm border-b border-[var(--border-soft)] pb-3 last:border-0">
              <p className="whitespace-pre-wrap">{n.body}</p>
              <div className="text-xs text-[var(--muted)] mt-1">{n.authorLabel} · {formatDate(n.createdAt.slice(0, 10))}</div>
            </div>
          ))}
          {notes.length === 0 && <p className="text-sm text-[var(--muted)]">No notes yet.</p>}
        </div>
        <textarea value={body} onChange={e => setBody(e.target.value)} rows={2} placeholder="Add a note…" className={inputClass} />
        <div className="flex justify-end mt-2">
          <Button size="sm" onClick={submitNote}>Add note</Button>
        </div>
      </Card>
    </div>
  );
}

function FormsSharedCard({ employeeId }: { employeeId: string }) {
  const { data } = useApp();
  const submissions = data.formSubmissions.filter(s => s.employeeId === employeeId && s.visibleToClient && s.status === 'submitted');
  if (submissions.length === 0) return null;
  return (
    <Card>
      <SectionLabel>Forms</SectionLabel>
      <div className="space-y-4">
        {submissions.map(sub => {
          const template = data.formTemplates.find(t => t.id === sub.templateId);
          if (!template) return null;
          return (
            <div key={sub.id} className="border border-[var(--border-soft)] rounded-lg p-3">
              <div className="text-sm font-medium mb-2">{template.name}</div>
              <FormRenderer template={template} responses={sub.responses} readOnly />
            </div>
          );
        })}
      </div>
    </Card>
  );
}
