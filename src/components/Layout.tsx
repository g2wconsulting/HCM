import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useApp } from '../lib/AppContext';
import { useAuth } from '../lib/AuthContext';
import { ChangePasswordModal } from './ChangePasswordModal';

const ADMIN_NAV = [
  { to: '/', label: 'Dashboard', icon: LedgerIcon },
  { to: '/employees', label: 'Employees', icon: PeopleIcon },
  { to: '/timesheets', label: 'Timesheets', icon: ClockIcon },
  { to: '/clients', label: 'Clients', icon: BuildingIcon },
  { to: '/projects', label: 'Projects', icon: FolderIcon },
  { to: '/forms', label: 'Forms', icon: FormIcon },
  { to: '/payroll', label: 'Payroll', icon: StampIcon },
  { to: '/settings', label: 'Settings', icon: GearIcon },
];

const EMPLOYEE_NAV = [
  { to: '/', label: 'Dashboard', icon: LedgerIcon },
  { to: '/timesheets', label: 'My timesheets', icon: ClockIcon },
  { to: '/my-onboarding', label: 'My onboarding', icon: PeopleIcon },
  { to: '/my-pay', label: 'My pay', icon: StampIcon },
];

const CLIENT_NAV = [
  { to: '/', label: 'Dashboard', icon: LedgerIcon },
  { to: '/portal/employees', label: 'Your team', icon: PeopleIcon },
  { to: '/portal/timesheets', label: 'Timesheets', icon: ClockIcon },
];

export function Layout() {
  const { company } = useApp();
  const { profile, signOut } = useAuth();
  const [showChangePw, setShowChangePw] = useState(false);
  const nav = profile?.role === 'admin' ? ADMIN_NAV : profile?.role === 'client' ? CLIENT_NAV : EMPLOYEE_NAV;

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 shrink-0 border-r border-[var(--border)] bg-[var(--surface)] flex flex-col">
        <div className="px-5 py-5 border-b border-[var(--border)] flex items-center gap-2.5">
          <div className="icon-chip bg-[var(--ink)] text-white shrink-0">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="3" width="16" height="18" rx="1.5" /><path d="M8 8h8M8 12h8M8 16h5" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="font-display text-lg leading-tight">Ledgerline</div>
            <div className="text-xs text-[var(--muted)] truncate">{company?.name}</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {nav.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `focus-ring flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all border-l-2 ${
                  isActive ? 'bg-[var(--accent-soft)] text-[var(--accent-dark)] border-[var(--accent)]' : 'text-[var(--ink-soft)] hover:bg-[var(--paper)] border-transparent'
                }`
              }
            >
              <item.icon />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-[var(--border)] text-xs text-[var(--muted)] space-y-2">
          <div className="flex items-center gap-2">
            <span>{profile?.email}</span>
            {profile?.role && profile.role !== 'admin' && (
              <span className="px-1.5 py-0.5 rounded-full bg-[var(--border-soft)] text-[10px] uppercase tracking-wide">{profile.role}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowChangePw(true)} className="focus-ring text-[var(--ink-soft)] hover:text-[var(--ink)] hover:underline">Change password</button>
            <button onClick={signOut} className="focus-ring text-[var(--accent)] hover:underline">Sign out</button>
          </div>
        </div>
      </aside>
      {showChangePw && <ChangePasswordModal onClose={() => setShowChangePw(false)} />}
      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function iconProps() {
  return { width: 17, height: 17, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
}
function LedgerIcon() { return <svg {...iconProps()}><rect x="4" y="3" width="16" height="18" rx="1.5" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>; }
function ClockIcon() { return <svg {...iconProps()}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>; }
function PeopleIcon() { return <svg {...iconProps()}><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><circle cx="17.5" cy="9" r="2.3" /><path d="M15.8 14.3c2.4.3 4.2 2.4 4.2 5" /></svg>; }
function FolderIcon() { return <svg {...iconProps()}><path d="M4 6.5A1.5 1.5 0 0 1 5.5 5h4l2 2.5h7A1.5 1.5 0 0 1 20 9v8.5A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5z" /></svg>; }
function BuildingIcon() { return <svg {...iconProps()}><rect x="4" y="4" width="10" height="16" rx="1" /><rect x="14" y="9" width="6" height="11" rx="1" /><path d="M7 8h1M7 11h1M7 14h1M10 8h1M10 11h1M10 14h1" /></svg>; }
function FormIcon() { return <svg {...iconProps()}><rect x="5" y="3" width="14" height="18" rx="1.5" /><path d="M8.5 8h1.5M8.5 12h1.5M8.5 16h1.5" /><rect x="12.5" y="7" width="4" height="2" rx="0.3" /><rect x="12.5" y="11" width="4" height="2" rx="0.3" /><rect x="12.5" y="15" width="4" height="2" rx="0.3" /></svg>; }
function StampIcon() { return <svg {...iconProps()}><rect x="5" y="14" width="14" height="6" rx="1" /><path d="M9 14V9.5a3 3 0 0 1 6 0V14" /><path d="M12 9.5V5" /></svg>; }
function GearIcon() { return <svg {...iconProps()}><circle cx="12" cy="12" r="3" /><path d="M19.4 13.5a7.7 7.7 0 0 0 0-3l1.7-1.3-2-3.4-2 .7a7.6 7.6 0 0 0-2.6-1.5L14 2.5h-4l-.5 2.5a7.6 7.6 0 0 0-2.6 1.5l-2-.7-2 3.4L4.6 10.5a7.7 7.7 0 0 0 0 3L2.9 14.8l2 3.4 2-.7a7.6 7.6 0 0 0 2.6 1.5l.5 2.5h4l.5-2.5a7.6 7.6 0 0 0 2.6-1.5l2 .7 2-3.4z" /></svg>; }
