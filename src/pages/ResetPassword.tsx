import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Button } from '../components/ui';

export function ResetPassword() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Supabase's client automatically parses the recovery token from the
    // URL and establishes a temporary session — we just wait for it.
    supabase.auth.getSession().then(({ data }) => {
      setReady(Boolean(data.session));
      if (!data.session) setError('This reset link is invalid or has expired. Ask an admin to send you a new one, or request another from the login page.');
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setSubmitting(true);
    setError(null);
    const { error: err } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (err) { setError(err.message); return; }
    setDone(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[var(--paper)]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="font-display text-3xl">Ledgerline</div>
          <p className="text-[var(--muted)] text-sm mt-1">Set a new password</p>
        </div>

        {done ? (
          <div className="ledger-card p-6 text-center space-y-3">
            <p className="text-sm text-[var(--good)]">Your password has been updated.</p>
            <Button fullWidth onClick={() => { window.location.href = '/'; }}>Continue to Ledgerline</Button>
          </div>
        ) : !ready ? (
          <div className="ledger-card p-6 text-center text-sm text-[var(--muted)]">
            {error ?? 'Checking your reset link…'}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="ledger-card p-6 space-y-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-[var(--ink-soft)]">New password</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="focus-ring rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-[var(--ink-soft)]">Confirm password</label>
              <input type="password" required value={confirm} onChange={e => setConfirm(e.target.value)} className="focus-ring rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm" />
            </div>
            {error && <div className="rounded-lg bg-[var(--bad-soft)] border border-[var(--bad)]/20 px-3 py-2 text-sm text-[var(--bad)]">{error}</div>}
            <Button type="submit" fullWidth disabled={submitting}>{submitting ? 'Saving…' : 'Set new password'}</Button>
          </form>
        )}
      </div>
    </div>
  );
}
