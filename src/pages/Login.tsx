import { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { Button } from '../components/ui';

export function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await signIn(email, password);
    if (res.error) setError(res.error);
    setSubmitting(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="font-display text-3xl">Ledgerline</div>
          <p className="text-[var(--muted)] text-sm mt-1">Timekeeping &amp; payroll</p>
        </div>
        <form onSubmit={handleSubmit} className="ledger-card p-6 space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-[var(--ink-soft)]">Email</label>
            <input
              type="email" required autoFocus value={email} onChange={e => setEmail(e.target.value)}
              className="focus-ring rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              placeholder="you@company.com"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-[var(--ink-soft)]">Password</label>
            <input
              type="password" required value={password} onChange={e => setPassword(e.target.value)}
              className="focus-ring rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              placeholder="••••••••"
            />
          </div>
          {error && <p className="text-sm text-[var(--bad)]">{error}</p>}
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
        <p className="text-xs text-[var(--muted)] text-center mt-4">
          No account yet? Ask your admin to set one up for you.
        </p>
      </div>
    </div>
  );
}
