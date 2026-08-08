import { useMemo } from 'react';

interface TimerProps {
  value: number;
  className?: string;
  pressure?: 'normal' | 'warn' | 'danger';
}

const pressureClasses = {
  normal: 'text-accent-primary',
  warn: 'text-accent-warn',
  danger: 'text-accent-danger animate-pulse',
};

export function Timer({ value, className = '', pressure = 'normal' }: TimerProps) {
  const formatted = useMemo(() => {
    const minutes = Math.floor(value / 60);
    const seconds = value % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, [value]);

  return (
    <div className={`font-mono text-5xl tabular-nums tracking-tight ${pressureClasses[pressure]} ${className}`}>
      {formatted}
    </div>
  );
}
