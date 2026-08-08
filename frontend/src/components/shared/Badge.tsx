interface BadgeProps {
  label: string;
  tone?: 'primary' | 'danger' | 'warn' | 'electric';
  className?: string;
}

const tones = {
  primary: 'border-accent-primary text-accent-primary',
  danger: 'border-accent-danger text-accent-danger',
  warn: 'border-accent-warn text-accent-warn',
  electric: 'border-accent-electric text-accent-electric',
};

export function Badge({ label, tone = 'primary', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${tones[tone]} ${className}`}
    >
      {label}
    </span>
  );
}
