import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui';

export function SignLookup() {
  const navigate = useNavigate();
  const [value, setValue] = useState('');

  function go() {
    const trimmed = value.trim();
    if (!trimmed) return;
    // Accept either a bare token or a full link containing /sign/<token>
    const match = trimmed.match(/\/sign\/([a-zA-Z0-9]+)/);
    const token = match ? match[1] : trimmed;
    navigate(`/sign/${token}`);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[var(--paper)]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="font-display text-3xl">Ledgerline</div>
          <p className="text-[var(--muted)] text-sm mt-1">Sign a document</p>
        </div>
        <div className="ledger-card p-6 space-y-4">
          <p className="text-sm text-[var(--ink-soft)]">
            Paste the signing link from your email, or the code at the end of it.
          </p>
          <input
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && go()}
            placeholder="https://... or the code itself"
            className="focus-ring w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm"
            autoFocus
          />
          <Button onClick={go} disabled={!value.trim()} fullWidth>Continue →</Button>
        </div>
      </div>
    </div>
  );
}
