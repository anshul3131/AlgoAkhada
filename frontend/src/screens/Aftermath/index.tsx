import { useState } from 'react';
import { Button } from '../../components/shared/Button';
import { GlowPanel } from '../../components/shared/GlowPanel';
import { OdometerNumber } from '../../components/shared/OdometerNumber';
import { useSocket, useRealtimeEvent } from '../../providers/RealtimeProvider';

export function AftermathScreen({ result, elo, matchId, onRematch, onMatchFound, onLobby }: { result: 'VICTORY' | 'DEFEAT'; elo: number; matchId?: string; onRematch: () => void; onMatchFound: (payload: any) => void; onLobby: () => void }) {
  const victory = result === 'VICTORY';
  const socket = useSocket();
  const [rematchState, setRematchState] = useState<'idle' | 'requested' | 'incoming' | 'declined'>('idle');

  useRealtimeEvent('rematch_requested', () => {
    setRematchState('incoming');
  });

  useRealtimeEvent('rematch_declined', () => {
    setRematchState('declined');
  });

  useRealtimeEvent('match_found', (payload) => {
    onMatchFound(payload);
  });

  const handleProposeRematch = () => {
    if (!socket || !matchId) return;
    setRematchState('requested');
    socket.emit('propose_rematch', { matchId });
  };

  const handleLobby = () => {
    if (socket && matchId) {
      socket.emit('decline_rematch', { matchId });
    }
    onLobby();
  };

  const handleFindNext = () => {
    if (socket && matchId) {
      socket.emit('decline_rematch', { matchId });
    }
    onRematch();
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-void p-4">
      <GlowPanel className="w-full max-w-2xl space-y-7 p-8 text-center sm:p-12">
        <div className={`text-6xl font-black uppercase tracking-[0.2em] ${victory ? 'text-accent-primary' : 'text-accent-danger'}`}>
          {result}
        </div>
        <p className="font-mono text-sm uppercase tracking-[0.2em] text-text-secondary">Match complete · ranked 1v1</p>
        <div className="flex items-center justify-center gap-4">
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-text-secondary">Current ELO</span>
          <OdometerNumber value={elo} className={victory ? 'text-5xl text-accent-primary' : 'text-5xl text-accent-danger'} />
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-border-hairline bg-bg-panel-raised px-3 py-3 text-xs uppercase tracking-[0.16em] text-text-secondary">
            Verdict<strong className="mt-2 block text-text-primary">{victory ? 'Accepted first' : 'Opponent won'}</strong>
          </div>
          <div className="rounded-lg border border-border-hairline bg-bg-panel-raised px-3 py-3 text-xs uppercase tracking-[0.16em] text-text-secondary">
            Mode<strong className="mt-2 block text-text-primary">Ranked 1v1</strong>
          </div>
          <div className="rounded-lg border border-border-hairline bg-bg-panel-raised px-3 py-3 text-xs uppercase tracking-[0.16em] text-text-secondary">
            Status<strong className="mt-2 block text-text-primary">Rating updated</strong>
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={handleFindNext}>Find Next Match</Button>
          {matchId && (
            <Button 
              variant={rematchState === 'incoming' ? 'primary' : rematchState === 'declined' ? 'danger' : 'ghost'} 
              className={rematchState === 'incoming' ? 'animate-pulse-glow shadow-glow-strong' : ''}
              disabled={rematchState === 'requested' || rematchState === 'declined'}
              onClick={handleProposeRematch}
            >
              {rematchState === 'idle' && 'Propose Rematch'}
              {rematchState === 'requested' && 'Waiting for Opponent...'}
              {rematchState === 'incoming' && 'Accept Rematch'}
              {rematchState === 'declined' && 'Opponent Left'}
            </Button>
          )}
          <Button variant="ghost" onClick={handleLobby}>Home</Button>
        </div>
      </GlowPanel>
    </main>
  );
}
