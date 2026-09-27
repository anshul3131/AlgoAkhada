import { useEffect, useMemo, useState, useRef } from 'react';
import { Badge } from '../../components/shared/Badge';
import { Button } from '../../components/shared/Button';
import { GlowPanel } from '../../components/shared/GlowPanel';
import { OdometerNumber } from '../../components/shared/OdometerNumber';
import { matchApi, problemApi, dashboardApi } from '../../lib/api';
import type { Player, RecentMatchRecord } from '../../types';
import { CustomLobbyRulesModal } from '../../components/shared/CreateCustomLobbyModal';

const mockPlayer: Player = {
  id: 'you',
  handle: 'ghost-01',
  avatarUrl: 'https://placehold.co/48x48',
  elo: 2147,
  tier: 'Silver II',
  country: 'IN',
};

export function LobbyDashboard({
  onFindMatch,
  onExploreTags,
  username,
  elo,
  onLogout,
  onReviewSolution,
  onUpsolve,
  onCreateCustomLobby,
  onJoinByCode,
  onDashboard,
  onSpectate,
  externalError,
}: {
  onFindMatch: () => void;
  onExploreTags: (tag?: string) => void;
  username?: string;
  elo?: number;
  onLogout?: () => void;
  onReviewSolution: (submissionId: string) => void;
  onUpsolve: (problemId: string) => void;
  onCreateCustomLobby: (lobbyId: string) => void;
  onJoinByCode: (code: string) => void;
  onDashboard: () => void;
  onSpectate: (matchId: string, problemId: string, players?: {id: string, username: string}[]) => void;
  externalError?: string | null;
}) {
  const [recentMatches, setRecentMatches] = useState<RecentMatchRecord[]>([]);
  const [liveMatches, setLiveMatches] = useState<any[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const displayError = externalError || error;
  const currentElo = elo ?? mockPlayer.elo;
  const rankProgress = useMemo(() => Math.min((currentElo / 2600) * 100, 100), [currentElo]);
  const [isCustomLobbyModalOpen, setIsCustomLobbyModalOpen] = useState(false);
  const [isJoinLobbyModalOpen, setIsJoinLobbyModalOpen] = useState(false);
  const [joinCodeArr, setJoinCodeArr] = useState(['', '', '', '', '', '']);
  const joinCodeRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleJoinCodeChange = (index: number, value: string) => {
    const val = value.slice(-1).toUpperCase();
    const newArr = [...joinCodeArr];
    newArr[index] = val;
    setJoinCodeArr(newArr);
    
    if (val && index < 5) {
      joinCodeRefs.current[index + 1]?.focus();
    }
  };

  const handleJoinCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !joinCodeArr[index] && index > 0) {
      joinCodeRefs.current[index - 1]?.focus();
    }
  };

  const handleJoinCodePaste = (e: React.ClipboardEvent) => {
    const paste = e.clipboardData.getData('text').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    if (paste.length === 6) {
      setJoinCodeArr(paste.split(''));
    }
  };

  const [stats, setStats] = useState<{wins: number, losses: number}>({wins: 0, losses: 0});

  useEffect(() => {
    let isCancelled = false;

    const loadData = async () => {
      setIsLoadingMatches(true);
      setIsLoadingTags(true);
      setError(null);

      try {
        const [matches, userStats, tagsData, liveData] = await Promise.all([
          matchApi.getRecentMatches(5),
          matchApi.getUserStats(),
          problemApi.getTags(),
          dashboardApi.getLiveMatches()
        ]);
        if (!isCancelled) {
          setRecentMatches(matches);
          setStats(userStats);
          setTags(tagsData.tags);
          setLiveMatches(liveData);
        }
      } catch (caughtError) {
        if (!isCancelled) {
          setError((caughtError as Error).message);
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingMatches(false);
          setIsLoadingTags(false);
        }
      }
    };

    void loadData();

    return () => {
      isCancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-[1400px] p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between rounded-xl border border-border-hairline bg-bg-panel p-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-text-secondary">CP MatchMaker / {username ?? mockPlayer.handle}</p>
        </div>
        <div className="flex items-center gap-4">
          <Badge label="Season 04" tone="electric" />
          <Badge label="Live Queue" tone="primary" />
          <button onClick={onDashboard} className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent-primary hover:text-white transition-colors">Dashboard</button>
          {onLogout && <button onClick={onLogout} className="text-[10px] uppercase tracking-[0.18em] text-text-secondary hover:text-accent-danger transition-colors">Logout</button>}
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
            <span>Wins {stats.wins}</span>
            <span>Losses {stats.losses}</span>
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
          <Button className="h-[200px] w-full text-3xl" onClick={() => onFindMatch()}>Find Match</Button>
          <div className="grid grid-cols-2 gap-4">
            <Button variant="ghost" className="text-[10px] uppercase tracking-[0.2em]" onClick={() => onExploreTags()}>Browse Topics</Button>
            <Button variant="ghost" className="text-[10px] uppercase tracking-[0.2em]" onClick={() => setIsJoinLobbyModalOpen(true)}>Join Lobby</Button>
            <Button variant="primary" className="col-span-2 text-[10px] uppercase tracking-[0.2em]" onClick={() => setIsCustomLobbyModalOpen(true)}>Create Custom Match</Button>
          </div>
          {!isJoinLobbyModalOpen && displayError && <div className="text-accent-danger text-xs text-center uppercase tracking-widest">{displayError}</div>}
        </GlowPanel>

        <GlowPanel className="max-h-[480px] overflow-hidden">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.2em] text-text-secondary">Recently Played</p>
            <Badge label="Live" tone="primary" />
          </div>

          <div className="space-y-2 max-h-[290px] overflow-y-auto pr-2">
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

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.2em] text-text-secondary">Topics</p>
          <button onClick={() => onExploreTags()} className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent-primary hover:text-accent-primary/80">Open all</button>
        </div>
        <GlowPanel className="p-3">
          <div className="flex flex-wrap gap-2">
            {isLoadingTags ? (
              <span className="text-sm text-text-secondary">Loading topics...</span>
            ) : tags.length === 0 ? (
              <span className="text-sm text-text-secondary">No topics available.</span>
            ) : (
              tags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => onExploreTags(tag)}
                  className="rounded-full border border-border-hairline bg-bg-panel-raised px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-text-primary transition hover:border-accent-primary hover:text-accent-primary"
                >
                  {tag}
                </button>
              ))
            )}
          </div>
        </GlowPanel>
      </div>

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.2em] text-text-secondary">Live Matches (Spectate)</p>
        </div>
        <GlowPanel className="p-3">
          <div className="flex flex-col gap-2">
            {liveMatches.length === 0 ? (
              <span className="text-sm text-text-secondary p-4 text-center block">No live matches currently available.</span>
            ) : (
              liveMatches.map((match) => (
                <div key={match.matchId} className="flex items-center justify-between rounded-lg bg-bg-panel-raised p-3">
                  <div className="flex flex-col">
                    <span className="font-mono text-sm text-text-primary">
                      {match.user1.username} ({match.user1.elo || 1200}) vs {match.user2.username} ({match.user2.elo || 1200})
                    </span>
                    <span className="text-xs text-text-secondary">{match.problemTitle}</span>
                  </div>
                  <Button variant="ghost" onClick={() => onSpectate(match.matchId, match.problemId, [match.user1, match.user2])}>Spectate</Button>
                </div>
              ))
            )}
          </div>
        </GlowPanel>
      </div>

      <CustomLobbyRulesModal 
        isOpen={isCustomLobbyModalOpen} 
        onClose={() => setIsCustomLobbyModalOpen(false)} 
        onSubmit={(lobbyId) => {
          setIsCustomLobbyModalOpen(false);
          onCreateCustomLobby(lobbyId);
        }} 
      />

      {isJoinLobbyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <GlowPanel className="max-w-md w-full p-8 text-center relative">
            <button 
              onClick={() => setIsJoinLobbyModalOpen(false)} 
              className="absolute top-4 right-4 text-text-secondary hover:text-text-primary text-xl"
            >
              ✕
            </button>
            <h2 className="text-2xl font-mono uppercase tracking-[0.2em] text-accent-primary mb-2">Join Lobby</h2>
            <p className="text-sm text-text-secondary mb-8">Enter the 6-character code</p>
            
            <div className="flex justify-center gap-2 mb-2" onPaste={handleJoinCodePaste}>
              {joinCodeArr.map((digit, idx) => (
                <input
                  key={idx}
                  ref={el => joinCodeRefs.current[idx] = el}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleJoinCodeChange(idx, e.target.value)}
                  onKeyDown={(e) => handleJoinCodeKeyDown(idx, e)}
                  className="w-12 h-14 rounded-lg border border-border-subtle bg-bg-void text-center text-2xl font-mono font-bold text-text-primary uppercase focus:border-accent-primary focus:outline-none transition-colors"
                />
              ))}
            </div>
            
            <div className="h-6 mb-6 flex items-center justify-center">
              {displayError && <span className="text-accent-danger text-xs uppercase tracking-widest">{displayError}</span>}
            </div>
            
            <Button 
              variant="primary" 
              className="w-full py-3"
              disabled={!joinCodeArr.every(v => v !== '')}
              onClick={() => onJoinByCode(joinCodeArr.join(''))}
            >
              Join Match
            </Button>
          </GlowPanel>
        </div>
      )}
    </div>
  );
}
