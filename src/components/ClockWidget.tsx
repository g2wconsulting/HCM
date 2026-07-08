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

export function ClockWidget({ employee, timesheet }: { employee: Employee; timesheet: Timesheet | undefined }) {
  const { data, clockIn, clockOut } = useApp();
  const [projectId, setProjectId] = useState<string>(employee.projectIds[0] ?? '');
  const [, forceTick] = useState(0);

  const active = timesheet?.activeSession;

  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => forceTick(n => n + 1), 30000);
    return () => clearInterval(interval);
  }, [active]);

  if (employee.projectIds.length === 0) {
    return <p className="text-sm text-[var(--muted)]">Assign yourself to a project before clocking in.</p>;
  }

  if (active) {
    const project = data.projects.find(p => p.id === active.projectId);
    return (
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">Clocked in — {project?.name ?? 'Unassigned'}</div>
          <div className="text-xs text-[var(--muted)] tabular">{elapsed(active.startedAt)} elapsed</div>
        </div>
        <Button variant="danger" onClick={() => timesheet && clockOut(timesheet.id)}>Clock out</Button>
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
