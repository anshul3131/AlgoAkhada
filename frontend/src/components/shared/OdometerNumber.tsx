import { useMemo } from 'react';
import { useOdometerValue } from '../../hooks/useOdometerValue';

interface OdometerNumberProps {
  value: number;
  durationMs?: number;
  className?: string;
}

export function OdometerNumber({ value, durationMs = 1200, className = '' }: OdometerNumberProps) {
  const animated = useOdometerValue(value, durationMs);

  const digits = useMemo(() => String(animated).padStart(4, '0').split(''), [animated]);

  return (
    <div className={`font-mono tabular-nums ${className}`}>
      {digits.map((digit, index) => (
        <span key={`${digit}-${index}`} className="mr-[0.05em]">
          {digit}
        </span>
      ))}
    </div>
  );
}
