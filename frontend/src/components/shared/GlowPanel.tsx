import type { ReactNode } from 'react';

interface GlowPanelProps {
  children: ReactNode;
  className?: string;
}

export function GlowPanel({ children, className = '' }: GlowPanelProps) {
  return (
    <section className={`rounded-xl border border-border-subtle bg-bg-panel p-4 shadow-panel theme-surface transition-colors duration-300 ${className}`}>
      {children}
    </section>
  );
}
