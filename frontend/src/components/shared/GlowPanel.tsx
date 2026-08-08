import type { ReactNode } from 'react';

interface GlowPanelProps {
  children: ReactNode;
  className?: string;
}

export function GlowPanel({ children, className = '' }: GlowPanelProps) {
  return (
    <section className={`rounded-xl border border-border-hairline bg-bg-panel p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] ${className}`}>
      {children}
    </section>
  );
}
