import { useEffect, useState } from 'react';
import { useApp } from '../lib/AppContext';
import { Button } from './ui';
import type { Employee, Timesheet } from '../lib/types';

function elapsed(startedAt: string): string {
  const ms = Date.now() - new Date(startedAt).getTime();
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${m}m`;
}

function fmtClock(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

const BREAK_MINUTES = [15, 30, 45, 60];

export function ClockWidget({ employee, timesheet }: { employee: Employee; timesheet: Timesheet | undefined }) {
  const { data, clockIn, clockOut } = useApp();
  const [projectId, setProjectId] = useState<string>(employee.projectIds[0] ?? '');
  const [, forceTick] = useState(0);
  const [showBreakPicker, setShowBreakPicker] = useState(false);
  // Purely local UI state — "on break" just means we clocked out and are
  // showing a resume prompt; the actual break-length punch gap is simply
  // whatever elapses between this clock-out and the next clock-in.
  const [onBreakUntil, setOnBreakUntil] = useState<{ resumeProjectId: string; until: Date } | null>(null);

  const active = timesheet?.activeSession;

  useEffect(() => {
    if (!active && !onBreakUntil) return;
    const interval = setInterval(() => forceTick(n => n + 1), 30000);
    return () => clearInterval(interval);
  }, [active, onBreakUntil]);

  if (employee.projectIds.length === 0) {
    return <p className="text-sm text-[var(--muted)]">Assign yourself to a project before clocking in.</p>;
  }

  function startBreak(minutes: number) {
    if (!timesheet || !active) return;
    const resumeProjectId = active.projectId ?? '';
    clockOut(timesheet.id);
    setOnBreakUntil({ resumeProjectId, until: new Date(Date.now() + minutes * 60000) });
    setShowBreakPicker(false);
  }

  function resumeFromBreak() {
    const resumeProjectId = onBreakUntil?.resumeProjectId ?? projectId;
    setOnBreakUntil(null);
    clockIn({ employeeId: employee.id, projectId: resumeProjectId || null });
  }

  if (onBreakUntil) {
    const overdue = Date.now() > onBreakUntil.until.getTime();
    return (
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">On break</div>
          <div className={`text-xs tabular ${overdue ? 'text-[var(--pending)]' : 'text-[var(--muted)]'}`}>
            {overdue ? 'Break time is up — ' : 'Back by '}{fmtClock(onBreakUntil.until)}
          </div>
        </div>
        <Button onClick={resumeFromBreak}>I'm back — clock in</Button>
      </div>
    );
  }

  if (active) {
    const project = data.projects.find(p => p.id === active.projectId);
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Clocked in — {project?.name ?? 'Unassigned'}</div>
            <div className="text-xs text-[var(--muted)] tabular">{elapsed(active.startedAt)} elapsed</div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setShowBreakPicker(v => !v)}>Take a break</Button>
            <Button variant="danger" onClick={() => timesheet && clockOut(timesheet.id)}>Clock out</Button>
          </div>
        </div>
        {showBreakPicker && (
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-[var(--muted)]">Break length:</span>
            {BREAK_MINUTES.map(m => (
              <button
                key={m}
                onClick={() => startBreak(m)}
                className="focus-ring px-2.5 py-1 rounded-full text-xs font-medium border border-[var(--border)] text-[var(--ink-soft)] hover:bg-[var(--paper)]"
              >
                {m < 60 ? `${m} min` : '1 hour'}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <select value={projectId} onChange={e => setProjectId(e.target.value)} className="focus-ring rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm flex-1">
        {employee.projectIds.map(pid => {
          const project = data.projects.find(p => p.id === pid);
          return <option key={pid} value={pid}>{project?.name ?? 'Unknown project'}</option>;
        })}
      </select>
      <Button onClick={() => clockIn({ employeeId: employee.id, projectId: projectId || null })}>Clock in</Button>
    </div>
  );
}
