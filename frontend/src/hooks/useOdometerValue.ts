import { useEffect, useState } from 'react';

export function useOdometerValue(targetValue: number, durationMs = 1200) {
  const [value, setValue] = useState(targetValue);

  useEffect(() => {
    setValue(targetValue);
    const start = performance.now();
    const from = value;

    const tick = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = Math.round(from + (targetValue - from) * eased);
      setValue(next);

      if (progress < 1) {
        window.requestAnimationFrame(tick);
      }
    };

    const frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [targetValue, durationMs]);

  return value;
}
