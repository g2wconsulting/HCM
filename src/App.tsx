import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { AppProvider } from './lib/AppContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Timesheets } from './pages/Timesheets';
import { TimesheetDetail } from './pages/TimesheetDetail';
import { Employees } from './pages/Employees';
import { EmployeeDetail } from './pages/EmployeeDetail';
import { Clients } from './pages/Clients';
import { FormTemplates } from './pages/FormTemplates';
import { Projects } from './pages/Projects';
import { Payroll } from './pages/Payroll';
import { PayrollRunDetail } from './pages/PayrollRunDetail';
import { Settings } from './pages/Settings';
import { MyPay } from './pages/MyPay';
import { MyOnboarding } from './pages/MyOnboarding';
import { PortalEmployees } from './pages/PortalEmployees';
import { PortalEmployeeDetail } from './pages/PortalEmployeeDetail';
import { PortalTimesheets } from './pages/PortalTimesheets';
import { PortalTimesheetDetail } from './pages/PortalTimesheetDetail';
import { ResetPassword } from './pages/ResetPassword';

function Gate({ children }: { children: React.ReactNode }) {
  const { session, profile, loading, error, signOut } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-[var(--muted)] text-sm">Loading…</div>;
  }
  if (!session) return <Login />;
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="ledger-card p-6 max-w-sm text-center space-y-3">
          <p className="text-sm text-[var(--bad)]">{error}</p>
          <button onClick={signOut} className="focus-ring text-sm text-[var(--accent)] hover:underline">Sign out</button>
        </div>
      </div>
    );
  }
  if (!profile) {
    return <div className="min-h-screen flex items-center justify-center text-[var(--muted)] text-sm">Loading your profile…</div>;
  }
  return <AppProvider>{children}</AppProvider>;
}

function RoleOnly({ roles, children }: { roles: Array<'admin' | 'employee' | 'client'>; children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!profile || !roles.includes(profile.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/*" element={<GatedApp />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

function GatedApp() {
  return (
    <Gate>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/timesheets" element={<RoleOnly roles={['admin', 'employee']}><Timesheets /></RoleOnly>} />
          <Route path="/timesheets/:id" element={<RoleOnly roles={['admin', 'employee']}><TimesheetDetail /></RoleOnly>} />
          <Route path="/my-pay" element={<RoleOnly roles={['employee']}><MyPay /></RoleOnly>} />
          <Route path="/my-onboarding" element={<RoleOnly roles={['employee']}><MyOnboarding /></RoleOnly>} />

          <Route path="/employees" element={<RoleOnly roles={['admin']}><Employees /></RoleOnly>} />
          <Route path="/employees/:id" element={<RoleOnly roles={['admin']}><EmployeeDetail /></RoleOnly>} />
          <Route path="/clients" element={<RoleOnly roles={['admin']}><Clients /></RoleOnly>} />
          <Route path="/forms" element={<RoleOnly roles={['admin']}><FormTemplates /></RoleOnly>} />
          <Route path="/projects" element={<RoleOnly roles={['admin']}><Projects /></RoleOnly>} />
          <Route path="/payroll" element={<RoleOnly roles={['admin']}><Payroll /></RoleOnly>} />
          <Route path="/payroll/:id" element={<RoleOnly roles={['admin']}><PayrollRunDetail /></RoleOnly>} />
          <Route path="/settings" element={<RoleOnly roles={['admin']}><Settings /></RoleOnly>} />

          <Route path="/portal/employees" element={<RoleOnly roles={['client']}><PortalEmployees /></RoleOnly>} />
          <Route path="/portal/employees/:id" element={<RoleOnly roles={['client']}><PortalEmployeeDetail /></RoleOnly>} />
          <Route path="/portal/timesheets" element={<RoleOnly roles={['client']}><PortalTimesheets /></RoleOnly>} />
          <Route path="/portal/timesheets/:id" element={<RoleOnly roles={['client']}><PortalTimesheetDetail /></RoleOnly>} />
        </Route>
      </Routes>
    </Gate>
  );
}
