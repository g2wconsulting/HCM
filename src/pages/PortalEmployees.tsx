import { Link } from 'react-router-dom';
import { useApp } from '../lib/AppContext';
import { Badge, Card } from '../components/ui';
import { initials } from '../lib/format';

export function PortalEmployees() {
  const { data } = useApp();
  const myProjectIds = new Set(data.projects.map(p => p.id));
  const myEmployees = data.employees.filter(e => e.projectIds.some(id => myProjectIds.has(id)));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Your team</h1>
        <p className="text-[var(--ink-soft)] mt-1">People placed with you.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {myEmployees.map(emp => (
          <Link key={emp.id} to={`/portal/employees/${emp.id}`}>
            <Card className="hover:shadow-sm transition-shadow h-full">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--accent-soft)] text-[var(--accent-dark)] flex items-center justify-center font-semibold text-sm">
                  {initials(emp.firstName, emp.lastName)}
                </div>
                <div>
                  <div className="font-medium">{emp.firstName} {emp.lastName}</div>
                  <div className="text-xs text-[var(--muted)]">{emp.title}</div>
                </div>
              </div>
              <div className="mt-4">
                <Badge tone={emp.status === 'active' ? 'good' : 'neutral'}>{emp.status}</Badge>
              </div>
            </Card>
          </Link>
        ))}
        {myEmployees.length === 0 && <p className="text-sm text-[var(--muted)] col-span-3 py-6">No one has been placed with you yet.</p>}
      </div>
    </div>
  );
}
