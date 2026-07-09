import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { Button } from '../components/ui';

export function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<'signin' | 'forgot'>('signin');
  const [resetSent, setResetSent] = useState(false);
  const [resetSubmitting, setResetSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await signIn(email, password);
    if (res.error) setError(res.error);
    setSubmitting(false);
  }

  async function handleResetRequest(e: React.FormEvent) {
    e.preventDefault();
    setResetSubmitting(true);
    setError(null);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setResetSubmitting(false);
    if (err) { setError(err.message); return; }
    setResetSent(true);
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
      <div className="hidden lg:flex auth-panel relative flex-col justify-between p-12 text-white overflow-hidden">
        <div className="grain absolute inset-0 pointer-events-none" />
        <div className="relative flex items-center gap-3">
          <div className="icon-chip bg-white/10 border border-white/15">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="3" width="16" height="18" rx="1.5" /><path d="M8 8h8M8 12h8M8 16h5" />
            </svg>
          </div>
          <span className="font-display text-xl">Ledgerline</span>
        </div>
        <div className="relative space-y-4 max-w-md">
          <p className="font-display text-4xl leading-[1.15] font-semibold">
            Clean books.<br />
            <span className="text-[var(--accent)]">Confident</span> payroll.
          </p>
          <p className="text-white/60 text-sm leading-relaxed">
            Timekeeping and payroll solutions for companies who need it done right.
          </p>
        </div>
        <div className="relative text-xs text-white/40">
          &copy; {new Date().getFullYear()} — built for real teams, not spreadsheets.
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-16 bg-[var(--paper)]">
        <div className="w-full max-w-sm">
          <div className="lg:hidden text-center mb-8">
            <div className="font-display text-3xl">Ledgerline</div>
            <p className="text-[var(--muted)] text-sm mt-1">Timekeeping &amp; payroll</p>
          </div>
          <h1 className="font-display text-2xl mb-1">{mode === 'signin' ? 'Welcome back' : 'Reset your password'}</h1>
          <p className="text-sm text-[var(--muted)] mb-6">
            {mode === 'signin' ? 'Sign in to your account to continue.' : "Enter your email and we'll send you a reset link."}
          </p>

          {mode === 'signin' ? (
            <form onSubmit={handleSubmit} className="ledger-card p-6 space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-[var(--ink-soft)]">Email</label>
                <input
                  type="email" required autoFocus value={email} onChange={e => setEmail(e.target.value)}
                  className="focus-ring rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm transition-colors focus:border-[var(--accent)]"
                  placeholder="you@company.com"
                />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-[var(--ink-soft)]">Password</label>
                  <button type="button" onClick={() => { setMode('forgot'); setError(null); }} className="focus-ring text-xs text-[var(--accent)] hover:underline">
                    Forgot password?
                  </button>
                </div>
                <input
                  type="password" required value={password} onChange={e => setPassword(e.target.value)}
                  className="focus-ring rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm transition-colors focus:border-[var(--accent)]"
                  placeholder="••••••••"
                />
              </div>
              {error && (
                <div className="rounded-lg bg-[var(--bad-soft)] border border-[var(--bad)]/20 px-3 py-2 text-sm text-[var(--bad)]">
                  {error}
                </div>
              )}
              <Button type="submit" disabled={submitting} fullWidth>
                {submitting ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          ) : resetSent ? (
            <div className="ledger-card p-6 text-center space-y-3">
              <p className="text-sm text-[var(--good)]">
                If an account exists for <strong>{email}</strong>, a reset link is on its way.
              </p>
              <button onClick={() => { setMode('signin'); setResetSent(false); }} className="focus-ring text-sm text-[var(--accent)] hover:underline">
                Back to sign in
              </button>
            </div>
          ) : (
            <form onSubmit={handleResetRequest} className="ledger-card p-6 space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-[var(--ink-soft)]">Email</label>
                <input
                  type="email" required autoFocus value={email} onChange={e => setEmail(e.target.value)}
                  className="focus-ring rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm"
                  placeholder="you@company.com"
                />
              </div>
              {error && <div className="rounded-lg bg-[var(--bad-soft)] border border-[var(--bad)]/20 px-3 py-2 text-sm text-[var(--bad)]">{error}</div>}
              <Button type="submit" disabled={resetSubmitting} fullWidth>
                {resetSubmitting ? 'Sending…' : 'Send reset link'}
              </Button>
              <button type="button" onClick={() => { setMode('signin'); setError(null); }} className="focus-ring text-sm text-[var(--muted)] hover:text-[var(--ink)] w-full text-center">
                Back to sign in
              </button>
            </form>
          )}
          <p className="text-xs text-[var(--muted)] text-center mt-5">
            No account yet? Ask your admin to set one up for you.
          </p>
          <p className="text-xs text-[var(--muted)] text-center mt-2">
            Need to sign a document? <Link to="/sign" className="text-[var(--accent)] font-medium hover:underline">Go to signing page →</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
