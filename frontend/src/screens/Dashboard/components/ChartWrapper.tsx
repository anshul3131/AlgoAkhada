import { ReactNode } from 'react';
import { GlowPanel } from '../../../components/shared/GlowPanel';

export function ChartWrapper({ title, children, height = 300 }: { title: string; children: ReactNode, height?: number }) {
  return (
    <GlowPanel className="group relative overflow-hidden transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <h3 className="text-sm font-bold uppercase tracking-widest text-text-secondary mb-2">{title}</h3>
      <div className="w-full relative block" style={{ height: `${height}px` }}>
        {children}
      </div>
    </GlowPanel>
  );
}
