import { useMemo } from 'react';
import { Badge } from '../../components/shared/Badge';
import { Button } from '../../components/shared/Button';
import { GlowPanel } from '../../components/shared/GlowPanel';
import { OdometerNumber } from '../../components/shared/OdometerNumber';
import type { Player } from '../../types';

const mockPlayer: Player = {
  id: 'you',
  handle: 'ghost-01',
  avatarUrl: 'https://placehold.co/48x48',
  elo: 2147,
  tier: 'Silver II',
  country: 'IN',
};

const leaderboard: Player[] = [
  { ...mockPlayer, id: 'a1', handle: 's1mple', elo: 2645, tier: 'Global Elite', country: 'US' },
  { ...mockPlayer, id: 'a2', handle: 'chalk', elo: 2470, tier: 'Master', country: 'DE' },
  { ...mockPlayer, id: 'a3', handle: 'nyx', elo: 2314, tier: 'Diamond', country: 'KR' },
  { ...mockPlayer, id: 'you', handle: 'ghost-01', elo: 2147, tier: 'Silver II', country: 'IN' },
];

const recentMatches = [
  { opponent: 's1mple', result: 'WIN', problem: 'Chef & Pairing' },
  { opponent: 'nyx', result: 'LOSS', problem: 'Segment Tree Search' },
  { opponent: 'chalk', result: 'WIN', problem: 'Binary Search Grid' },
];

export function LobbyDashboard({ onFindMatch, username, elo, onLogout }: { onFindMatch: () => void; username?: string; elo?: number; onLogout?: () => void }) {
  const currentElo = elo ?? mockPlayer.elo;
  const rankProgress = useMemo(() => Math.min((currentElo / 2600) * 100, 100), [currentElo]);

  return (
    <div className="mx-auto max-w-[1400px] p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between rounded-xl border border-border-hairline bg-bg-panel p-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-text-secondary">CP MatchMaker / {username ?? mockPlayer.handle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge label="Season 04" tone="electric" />
          <Badge label="Live Queue" tone="primary" />
          {onLogout && <button onClick={onLogout} className="text-[10px] uppercase tracking-[0.18em] text-text-secondary hover:text-accent-danger">Logout</button>}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_340px]">
        <GlowPanel className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.22em] text-text-secondary">Rank Card</p>
            <Badge label={mockPlayer.tier} tone="electric" />
          </div>
          <OdometerNumber value={currentElo} className="text-5xl text-accent-primary" />
          <div className="h-2 rounded-full bg-bg-panel-raised">
            <div className="h-full rounded-full bg-accent-primary" style={{ width: `${rankProgress}%` }} />
          </div>
          <div className="flex justify-between text-xs uppercase tracking-[0.2em] text-text-secondary">
            <span>Wins 18</span>
            <span>Losses 7</span>
          </div>
        </GlowPanel>

        <GlowPanel className="flex flex-col gap-4">
          <div className="flex gap-2">
            {['Ranked 1v1', 'Casual', 'Blitz'].map((mode) => (
              <button
                key={mode}
                className="rounded-full border border-border-hairline px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-text-secondary"
              >
                {mode}
              </button>
            ))}
          </div>
          <Button className="h-[220px] w-full text-3xl" onClick={onFindMatch}>Find Match</Button>
        </GlowPanel>

        <GlowPanel className="max-h-[460px] overflow-hidden">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.2em] text-text-secondary">Leaderboard</p>
            <Badge label="Live" tone="primary" />
          </div>
          <div className="space-y-2">
            {leaderboard.map((player) => (
              <div
                key={player.id}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
                  player.handle === mockPlayer.handle
                    ? 'border-accent-primary bg-accent-primary/10'
                    : 'border-border-hairline bg-bg-panel-raised'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-text-secondary">#{leaderboard.indexOf(player) + 1}</span>
                  <span className="font-mono text-sm">{player.handle}</span>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm text-text-primary">{player.elo}</div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-text-secondary">{player.tier}</div>
                </div>
              </div>
            ))}
          </div>
        </GlowPanel>
      </div>

      <div className="mt-4 overflow-x-auto">
        <div className="flex gap-3">
          {recentMatches.map((match, index) => (
            <div
              key={`${match.opponent}-${index}`}
              className={`min-w-[220px] rounded-lg border px-3 py-3 ${
                match.result === 'WIN' ? 'border-accent-primary bg-accent-primary/10' : 'border-accent-danger bg-accent-danger/10'
              }`}
            >
              <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-text-secondary">vs {match.opponent}</div>
              <div className="font-mono text-sm">{match.problem}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
