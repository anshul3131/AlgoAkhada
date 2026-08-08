import { useEffect, useMemo, useRef, useState } from 'react';
import type { PressureLevel } from '../types';

export function useCountdownTimer(durationSeconds: number, onExpire?: () => void) {
  const [remaining, setRemaining] = useState(durationSeconds);
  const expiredRef = useRef(false);

  useEffect(() => {
    setRemaining(durationSeconds);
    expiredRef.current = false;
  }, [durationSeconds]);

  useEffect(() => {
    if (remaining <= 0 && !expiredRef.current) {
      expiredRef.current = true;
      onExpire?.();
      return;
    }

    const interval = window.setInterval(() => {
      setRemaining((current) => {
        if (current <= 1) {
          window.clearInterval(interval);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [remaining, onExpire]);

  const pressureLevel = useMemo<PressureLevel>(() => {
    if (remaining <= 60) return 'danger';
    if (remaining <= 300) return 'warn';
    return 'normal';
  }, [remaining]);

  const formatted = useMemo(() => {
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, [remaining]);

  return { remaining, formatted, pressureLevel };
}
