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
  children, onClick, variant = 'primary', type = 'button', disabled, size = 'md', title, fullWidth,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  type?: 'button' | 'submit';
  disabled?: boolean;
  size?: 'sm' | 'md';
  title?: string;
  fullWidth?: boolean;
}) {
  const base = 'focus-ring inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]';
  const sizes = size === 'sm' ? 'px-2.5 py-1.5 text-sm' : 'px-4 py-2 text-sm';
  const width = fullWidth ? 'w-full' : '';
  const variants: Record<string, string> = {
    primary: 'bg-[var(--accent)] text-white hover:bg-[var(--accent-dark)] shadow-sm',
    secondary: 'bg-white border border-[var(--border)] text-[var(--ink)] hover:bg-[var(--paper)] hover:border-[var(--ink-soft)]/30',
    ghost: 'text-[var(--ink-soft)] hover:bg-[var(--border-soft)]',
    danger: 'bg-[var(--bad)] text-white hover:opacity-90',
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title} className={`${base} ${sizes} ${width} ${variants[variant]}`}>
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

export function EmptyState({
  icon, title, subtitle, action,
}: { icon?: ReactNode; title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center py-10 px-6">
      {icon && (
        <div className="icon-chip bg-[var(--border-soft)] text-[var(--muted)] mb-3">
          {icon}
        </div>
      )}
      <div className="font-medium text-[var(--ink)]">{title}</div>
      {subtitle && <p className="text-sm text-[var(--muted)] mt-1 max-w-sm">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function IconStat({
  icon, tone = 'accent', label, value, sub, subTone, iconPosition = 'left',
}: {
  icon: ReactNode;
  tone?: 'accent' | 'secondary' | 'good' | 'bad' | 'pending';
  label: string;
  value: string;
  sub?: string;
  subTone?: 'pending' | 'bad' | 'good';
  iconPosition?: 'left' | 'right';
}) {
  const chipStyles: Record<string, string> = {
    accent: 'bg-[var(--accent-soft)] text-[var(--accent-dark)]',
    secondary: 'bg-[var(--secondary-soft)] text-[var(--secondary-dark)]',
    good: 'bg-[var(--good-soft)] text-[var(--good)]',
    bad: 'bg-[var(--bad-soft)] text-[var(--bad)]',
    pending: 'bg-[var(--pending-soft)] text-[var(--pending)]',
  };
  const subColor = subTone === 'bad' ? 'text-[var(--bad)]' : subTone === 'pending' ? 'text-[var(--pending)]' : subTone === 'good' ? 'text-[var(--good)]' : 'text-[var(--muted)]';

  if (iconPosition === 'right') {
    return (
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold tracking-wide uppercase text-[var(--muted)]">{label}</div>
            <div className="font-display text-3xl mt-2 tabular">{value}</div>
            {sub && <div className={`text-xs mt-1 ${subColor}`}>{sub}</div>}
          </div>
          <div className={`icon-chip shrink-0 ${chipStyles[tone]}`}>{icon}</div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className={`icon-chip ${chipStyles[tone]}`}>{icon}</div>
        <div className="min-w-0">
          <div className="text-xs font-semibold tracking-wide uppercase text-[var(--muted)]">{label}</div>
          <div className="font-display text-3xl mt-0.5 tabular">{value}</div>
          {sub && <div className={`text-xs mt-1 ${subColor}`}>{sub}</div>}
        </div>
      </div>
    </Card>
  );
}
