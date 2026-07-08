import type { ReactNode } from 'react';

export function Badge({ tone, children }: { tone: 'good' | 'bad' | 'pending' | 'neutral'; children: ReactNode }) {
  const styles: Record<string, string> = {
    good: 'text-[var(--good)] bg-[var(--good-soft)] border-[var(--good)]/25',
    bad: 'text-[var(--bad)] bg-[var(--bad-soft)] border-[var(--bad)]/25',
    pending: 'text-[var(--pending)] bg-[var(--pending-soft)] border-[var(--pending)]/25',
    neutral: 'text-[var(--ink-soft)] bg-[var(--border-soft)] border-[var(--border)]',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium tabular ${styles[tone]}`}>
      {children}
    </span>
  );
}

export function Button({
  children, onClick, variant = 'primary', type = 'button', disabled, size = 'md', title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  type?: 'button' | 'submit';
  disabled?: boolean;
  size?: 'sm' | 'md';
  title?: string;
}) {
  const base = 'focus-ring inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]';
  const sizes = size === 'sm' ? 'px-2.5 py-1.5 text-sm' : 'px-4 py-2 text-sm';
  const variants: Record<string, string> = {
    primary: 'bg-[var(--accent)] text-white hover:bg-[var(--accent-dark)] shadow-sm',
    secondary: 'bg-white border border-[var(--border)] text-[var(--ink)] hover:bg-[var(--paper)] hover:border-[var(--ink-soft)]/30',
    ghost: 'text-[var(--ink-soft)] hover:bg-[var(--border-soft)]',
    danger: 'bg-[var(--bad)] text-white hover:opacity-90',
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title} className={`${base} ${sizes} ${variants[variant]}`}>
      {children}
    </button>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`ledger-card p-5 ${className}`}>{children}</div>;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="text-xs font-semibold tracking-wide uppercase text-[var(--muted)] mb-2">{children}</div>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-[var(--ink-soft)] font-medium">{label}</span>
      {children}
    </label>
  );
}

export const inputClass = 'focus-ring w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] transition-colors';
