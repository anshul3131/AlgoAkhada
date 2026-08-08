import { useEffect, useMemo, useState } from 'react';
import type { PressureLevel } from '../types';

export function useElapsedTimer(startAt = 0) {
  const [elapsed, setElapsed] = useState(startAt);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setElapsed((current) => current + 1);
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  const pressureLevel = useMemo<PressureLevel>(() => {
    if (elapsed >= 90) return 'danger';
    if (elapsed >= 30) return 'warn';
    return 'normal';
  }, [elapsed]);

  const formatted = useMemo(() => {
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, [elapsed]);

  return { elapsed, formatted, pressureLevel };
}
