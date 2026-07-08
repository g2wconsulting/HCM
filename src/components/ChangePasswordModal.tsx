import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Button } from './ui';

export function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
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
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl border border-[var(--border)] p-6 w-full max-w-sm space-y-4">
        <h2 className="font-display text-xl">Change password</h2>
        {done ? (
          <>
            <p className="text-sm text-[var(--good)]">Your password has been updated.</p>
            <Button fullWidth onClick={onClose}>Done</Button>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-[var(--ink-soft)]">New password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="focus-ring rounded-lg border border-[var(--border)] px-3 py-2 text-sm" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-[var(--ink-soft)]">Confirm new password</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} className="focus-ring rounded-lg border border-[var(--border)] px-3 py-2 text-sm" />
            </div>
            {error && <div className="rounded-lg bg-[var(--bad-soft)] border border-[var(--bad)]/20 px-3 py-2 text-sm text-[var(--bad)]">{error}</div>}
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button onClick={submit} disabled={submitting}>{submitting ? 'Saving…' : 'Save password'}</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
