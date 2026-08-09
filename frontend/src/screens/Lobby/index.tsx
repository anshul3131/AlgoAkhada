import { useEffect, useMemo, useState } from 'react';
import { Badge } from '../../components/shared/Badge';
import { Button } from '../../components/shared/Button';
import { GlowPanel } from '../../components/shared/GlowPanel';
import { OdometerNumber } from '../../components/shared/OdometerNumber';
import { matchApi } from '../../lib/api';
import type { Player, RecentMatchRecord } from '../../types';

const mockPlayer: Player = {
  id: 'you',
  handle: 'ghost-01',
  avatarUrl: 'https://placehold.co/48x48',
  elo: 2147,
  tier: 'Silver II',
  country: 'IN',
};

export function LobbyDashboard({
  token,
  onFindMatch,
  username,
  elo,
  onLogout,
  onReviewSolution,
  onUpsolve,
}: {
  token: string;
  onFindMatch: () => void;
  username?: string;
  elo?: number;
  onLogout?: () => void;
  onReviewSolution: (submissionId: string) => void;
  onUpsolve: (problemId: string) => void;
}) {
  const [recentMatches, setRecentMatches] = useState<RecentMatchRecord[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentElo = elo ?? mockPlayer.elo;
  const rankProgress = useMemo(() => Math.min((currentElo / 2600) * 100, 100), [currentElo]);

  useEffect(() => {
    let isCancelled = false;

    const loadRecentMatches = async () => {
      setIsLoadingMatches(true);
      setError(null);

      try {
        const matches = await matchApi.getRecentMatches(token, 5);
        if (!isCancelled) {
          setRecentMatches(matches);
        }
      } catch (caughtError) {
        if (!isCancelled) {
          setError((caughtError as Error).message);
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingMatches(false);
        }
      }
    };

    void loadRecentMatches();

    return () => {
      isCancelled = true;
    };
  }, [token]);

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

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_360px]">
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

        <GlowPanel className="max-h-[480px] overflow-hidden">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.2em] text-text-secondary">Recently Played</p>
            <Badge label="Live" tone="primary" />
          </div>

          <div className="space-y-2">
            {isLoadingMatches ? (
              <div className="rounded-lg border border-border-hairline bg-bg-panel-raised px-3 py-4 text-sm text-text-secondary">Loading matches...</div>
            ) : error ? (
              <div className="rounded-lg border border-accent-danger/60 bg-accent-danger/10 px-3 py-4 text-sm text-accent-danger">{error}</div>
            ) : recentMatches.length === 0 ? (
              <div className="rounded-lg border border-border-hairline bg-bg-panel-raised px-3 py-4 text-sm text-text-secondary">No recent matches yet.</div>
            ) : (
              recentMatches.map((match, index) => {
                const isWin = match.result === 'WIN';
                const buttonText = isWin ? 'View your solution' : 'Upsolve';
                const isButtonDisabled = isWin ? !match.submissionId : false;

                return (
                  <div
                    key={match.matchId}
                    className={`rounded-xl border p-3 transition-all ${
                      isWin
                        ? 'border-accent-primary/60 bg-accent-primary/10 shadow-[0_0_0_1px_rgba(76,255,190,0.12)]'
                        : 'border-accent-danger/50 bg-accent-danger/10 shadow-[0_0_0_1px_rgba(255,92,92,0.08)]'
                    }`}
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-secondary">#{index + 1}</span>
                        <span className="font-mono text-sm text-text-primary">{match.opponentName}</span>
                      </div>
                      <span
                        className={`rounded-full border px-2 py-1 text-[9px] uppercase tracking-[0.18em] ${
                          isWin
                            ? 'border-accent-primary/50 bg-accent-primary/20 text-accent-primary'
                            : 'border-accent-danger/50 bg-accent-danger/20 text-accent-danger'
                        }`}
                      >
                        {match.result}
                      </span>
                    </div>

                    <div className="mb-3 text-[10px] uppercase tracking-[0.18em] text-text-secondary">{match.problemTitle}</div>

                    <Button
                      variant={isWin ? 'primary' : 'danger'}
                      className="w-full text-[10px] text-[11px] font-medium tracking-[0.18em]"
                      onClick={() => {
                        if (isWin && match.submissionId) {
                          onReviewSolution(match.submissionId);
                          return;
                        }
                        onUpsolve(match.problemId);
                      }}
                      disabled={isButtonDisabled}
                    >
                      {buttonText}
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </GlowPanel>
      </div>
    </div>
  );
}
