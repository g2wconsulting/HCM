import { useState } from 'react';
import { useApp } from '../lib/AppContext';
import { useAuth } from '../lib/AuthContext';
import { Button, Card, Field, SectionLabel, inputClass } from '../components/ui';

export function Settings() {
  const { company, setCompany } = useApp();
  const { profile, signOut } = useAuth();
  const [name, setName] = useState(company.name);
  const [ein, setEin] = useState(company.ein ?? '');
  const [address, setAddress] = useState(company.address ?? '');
  const [otThreshold, setOtThreshold] = useState(company.overtimeThresholdWeekly);
  const [otMultiplier, setOtMultiplier] = useState(company.overtimeMultiplier);
  const [futaRate, setFutaRate] = useState(company.futaRate);
  const [futaWageBase, setFutaWageBase] = useState(company.futaWageBase);
  const [sutaRate, setSutaRate] = useState(company.sutaRate);
  const [sutaWageBase, setSutaWageBase] = useState(company.sutaWageBase);
  const [workersCompRate, setWorkersCompRate] = useState(company.workersCompRate);
  const [stateWithholdingAcct, setStateWithholdingAcct] = useState(company.stateWithholdingAccountNumber ?? '');
  const [sutaAcct, setSutaAcct] = useState(company.stateUnemploymentAccountNumber ?? '');
  const [workersCompPolicy, setWorkersCompPolicy] = useState(company.workersCompPolicyNumber ?? '');
  const [saved, setSaved] = useState(false);

  function save() {
    setCompany({
      name, ein, address, overtimeThresholdWeekly: otThreshold, overtimeMultiplier: otMultiplier,
      futaRate, futaWageBase, sutaRate, sutaWageBase, workersCompRate,
      stateWithholdingAccountNumber: stateWithholdingAcct,
      stateUnemploymentAccountNumber: sutaAcct,
      workersCompPolicyNumber: workersCompPolicy,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-3xl">Settings</h1>
        <p className="text-[var(--ink-soft)] mt-1">Company details used across timesheets, payroll, and stubs.</p>
      </div>

      <Card className="space-y-4">
        <SectionLabel>Company</SectionLabel>
        <Field label="Company name"><input value={name} onChange={e => setName(e.target.value)} className={inputClass} /></Field>
        <Field label="EIN"><input value={ein} onChange={e => setEin(e.target.value)} className={inputClass} /></Field>
        <Field label="Address"><input value={address} onChange={e => setAddress(e.target.value)} className={inputClass} /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Overtime threshold (hrs/week)">
            <input type="number" value={otThreshold} onChange={e => setOtThreshold(parseFloat(e.target.value) || 40)} className={inputClass} />
          </Field>
          <Field label="Overtime multiplier">
            <input type="number" step={0.1} value={otMultiplier} onChange={e => setOtMultiplier(parseFloat(e.target.value) || 1.5)} className={inputClass} />
          </Field>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <Button onClick={save}>Save changes</Button>
          {saved && <span className="text-sm text-[var(--good)]">Saved.</span>}
        </div>
      </Card>

      <Card className="space-y-4">
        <SectionLabel>Employer payroll tax liability</SectionLabel>
        <p className="text-sm text-[var(--ink-soft)]">
          FUTA has a standard federal rate/wage base; SUTA and workers' comp vary by state and job
          classification, so confirm these against your own filings before running real payroll.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="FUTA rate">
            <input type="number" step={0.001} value={futaRate} onChange={e => setFutaRate(parseFloat(e.target.value) || 0)} className={inputClass} />
          </Field>
          <Field label="FUTA wage base ($/yr per employee)">
            <input type="number" step={100} value={futaWageBase} onChange={e => setFutaWageBase(parseFloat(e.target.value) || 0)} className={inputClass} />
          </Field>
          <Field label="SUTA rate">
            <input type="number" step={0.001} value={sutaRate} onChange={e => setSutaRate(parseFloat(e.target.value) || 0)} className={inputClass} />
          </Field>
          <Field label="SUTA wage base ($/yr per employee)">
            <input type="number" step={100} value={sutaWageBase} onChange={e => setSutaWageBase(parseFloat(e.target.value) || 0)} className={inputClass} />
          </Field>
          <Field label="Workers' comp rate (per $100 of gross pay)">
            <input type="number" step={0.01} value={workersCompRate} onChange={e => setWorkersCompRate(parseFloat(e.target.value) || 0)} className={inputClass} />
          </Field>
        </div>
        <div className="border-t border-[var(--border-soft)] pt-4 grid grid-cols-2 gap-4">
          <Field label="State withholding account #">
            <input value={stateWithholdingAcct} onChange={e => setStateWithholdingAcct(e.target.value)} className={inputClass} />
          </Field>
          <Field label="State unemployment (SUTA) account #">
            <input value={sutaAcct} onChange={e => setSutaAcct(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Workers' comp policy #">
            <input value={workersCompPolicy} onChange={e => setWorkersCompPolicy(e.target.value)} className={inputClass} />
          </Field>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <Button onClick={save}>Save changes</Button>
          {saved && <span className="text-sm text-[var(--good)]">Saved.</span>}
        </div>
      </Card>

      <Card>
        <SectionLabel>Tax tables</SectionLabel>
        <p className="text-sm text-[var(--ink-soft)]">
          Federal and state withholding use 2024 IRS Publication 15-T annualized-wages brackets and current FICA rates,
          defined in <code className="font-mono text-xs bg-[var(--paper)] px-1 py-0.5 rounded">src/lib/taxEngine.ts</code>.
          Tax tables change most years — review and update that file each January before running real payroll.
        </p>
      </Card>

      <Card>
        <SectionLabel>Account</SectionLabel>
        <p className="text-sm text-[var(--ink-soft)] mb-3">Signed in as {profile?.email} ({profile?.role}).</p>
        <Button variant="secondary" onClick={signOut}>Sign out</Button>
      </Card>

      <Card>
        <SectionLabel>Adding people</SectionLabel>
        <p className="text-sm text-[var(--ink-soft)]">
          New employee and admin logins are created from the server using the scripts in{' '}
          <code className="font-mono text-xs bg-[var(--paper)] px-1 py-0.5 rounded">scripts/</code>{' '}
          (they need the Supabase service role key, so they can't run in the browser). See the README for the exact commands.
        </p>
      </Card>
    </div>
  );
}
