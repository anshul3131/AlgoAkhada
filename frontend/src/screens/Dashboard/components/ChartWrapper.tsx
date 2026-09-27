import { ReactNode } from 'react';
import { GlowPanel } from '../../../components/shared/GlowPanel';

export function ChartWrapper({ title, children }: { title: string; children: ReactNode }) {
  return (
    <GlowPanel className="flex flex-col h-full group relative overflow-hidden transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <h3 className="text-sm font-bold uppercase tracking-widest text-text-secondary mb-6">{title}</h3>
      <div className="flex-1 w-full flex items-center justify-center min-h-[300px]">
        {children}
      </div>
    </GlowPanel>
  );
}
