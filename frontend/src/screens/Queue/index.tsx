import { useEffect, useState } from 'react';
import { Badge } from '../../components/shared/Badge';
import { Button } from '../../components/shared/Button';
import { GlowPanel } from '../../components/shared/GlowPanel';
import { Timer } from '../../components/shared/Timer';
import { useElapsedTimer } from '../../hooks/useElapsedTimer';
import { useRealtimeContext, useRealtimeEvent } from '../../providers/RealtimeProvider';

type MatchFound = { matchId: string; problemId: string; startTime: string };

export function MatchmakingQueue({ tag, onCancel, onMatchFound }: { tag?: string; onCancel: () => void; onMatchFound: (match: MatchFound) => void }) {
  const { elapsed, pressureLevel } = useElapsedTimer();
  const { connected, error, joinQueue, leaveQueue } = useRealtimeContext();
  const [searchRange, setSearchRange] = useState(150);
  const [queueStatus, setQueueStatus] = useState('connecting');

  useEffect(() => {
    if (connected) {
      joinQueue(tag ? { tag } : undefined);
      setQueueStatus('searching');
    }
    return () => leaveQueue();
  }, [connected, joinQueue, leaveQueue, tag]);

  useEffect(() => {
    const interval = window.setInterval(() => setSearchRange((current) => Math.min(current + 25, 500)), 10000);
    return () => window.clearInterval(interval);
  }, []);

  useRealtimeEvent('queue_status', (payload) => setQueueStatus(payload.status));
  useRealtimeEvent('match_found', (payload) => onMatchFound(payload));

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg-void px-4">
      <div className="pointer-events-none absolute h-[520px] w-[520px] animate-spin rounded-full border border-accent-primary/10 [animation-duration:18s]" />
      <div className="pointer-events-none absolute h-[340px] w-[340px] rounded-full border border-dashed border-accent-electric/20" />
      <GlowPanel className="relative w-full max-w-xl space-y-7 p-8 text-center sm:p-12">
        <div className="flex items-center justify-between text-left"><Badge label={tag ? `${tag}` : 'Ranked 1v1'} tone="electric" /><Badge label={connected ? 'Socket live' : 'Offline'} tone={connected ? 'primary' : 'danger'} /></div>
        <div><p className="font-mono text-xs uppercase tracking-[0.3em] text-text-secondary">{queueStatus === 'searching' ? (tag ? `Searching ${tag}` : 'Searching lobby') : queueStatus}</p><Timer value={elapsed} pressure={pressureLevel} className="mt-4 text-[5rem]" /></div>
        <div className="space-y-2"><div className="mx-auto h-1 max-w-xs overflow-hidden rounded-full bg-bg-panel-raised"><div className="h-full w-1/2 animate-pulse rounded-full bg-accent-primary" /></div><p className="text-sm text-text-secondary">Searching for an opponent within <span className="font-mono text-text-primary">±{searchRange} ELO</span></p></div>
        {error && <p className="rounded-lg border border-accent-danger/40 bg-accent-danger/10 px-3 py-2 text-xs text-accent-danger">{error}. Start the backend to enter the live queue.</p>}
        <Button variant="ghost" onClick={onCancel}>Leave Queue</Button>
      </GlowPanel>
    </main>
  );
}
