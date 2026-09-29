import { useEffect, useMemo, useState, useRef } from 'react';
import { Badge } from '../../components/shared/Badge';
import { Button } from '../../components/shared/Button';
import { GlowPanel } from '../../components/shared/GlowPanel';
import { OdometerNumber } from '../../components/shared/OdometerNumber';
import { matchApi, problemApi, dashboardApi } from '../../lib/api';
import type { Player, RecentMatchRecord } from '../../types';
import { CustomLobbyRulesModal } from '../../components/shared/CreateCustomLobbyModal';
import { PublicLobbiesPanel } from '../../components/shared/PublicLobbiesPanel';

const ChevronStack = ({ up }: { up?: boolean }) => (
  <div className="flex flex-col items-center justify-center -space-y-[3px]">
    {[0, 1, 2].map(i => (
      <svg key={i} width="14" height="6" viewBox="0 0 24 10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d={up ? "M2 8l10-6 10 6" : "M2 2l10 6 10-6"} />
      </svg>
    ))}
  </div>
);

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
  avatarUrl,
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
  avatarUrl?: string | null;
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
  const [topicsExpanded, setTopicsExpanded] = useState(false);
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
      <div
        className="
          grid gap-4
          lg:h-[calc(100vh-6rem)] lg:min-h-[720px] lg:max-h-[940px]
          lg:grid-cols-12 lg:grid-rows-[auto_minmax(0,1fr)_auto]
        "
      >
        {/* 1. MATCHMAKING ACTIONS */}
        <GlowPanel className="p-5 lg:col-span-8 lg:row-start-1">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px] h-full">
            <div className="flex flex-col gap-4">
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
              <Button className="h-24 md:h-28 w-full text-3xl" onClick={() => onFindMatch()}>Find Match</Button>
              {!isJoinLobbyModalOpen && displayError && <div className="text-accent-danger text-xs text-center uppercase tracking-widest">{displayError}</div>}
            </div>
            
            <div className="flex flex-col gap-3">
              <Button variant="ghost" className="text-[10px] uppercase tracking-[0.2em] w-full" onClick={() => onExploreTags()}>Browse Topics</Button>
              <Button variant="ghost" className="text-[10px] uppercase tracking-[0.2em] w-full" onClick={() => setIsJoinLobbyModalOpen(true)}>Join Lobby</Button>
              <Button variant="primary" className="text-[10px] uppercase tracking-[0.2em] w-full" onClick={() => setIsCustomLobbyModalOpen(true)}>Create Custom Match</Button>
            </div>
          </div>
        </GlowPanel>

        {/* 2. PUBLIC LOBBIES */}
        <PublicLobbiesPanel className="max-lg:h-[360px] lg:col-span-4 lg:row-start-2" onJoinCode={onJoinByCode} />

        {/* 3. LIVE MATCHES */}
        <GlowPanel className="max-lg:h-[360px] lg:col-span-4 lg:col-start-5 lg:row-start-2 flex min-h-0 flex-col p-3">
          <div className="mb-3 flex items-center justify-between flex-shrink-0">
            <p className="text-xs uppercase tracking-[0.2em] text-text-secondary">Live Matches (Spectate)</p>
          </div>
          <div className="flex-1 min-h-0 flex flex-col gap-2 overflow-y-auto pr-2">
            {(liveMatches || []).length === 0 ? (
              <span className="text-sm text-text-secondary p-4 text-center block italic">No live matches currently available.</span>
            ) : (
              (liveMatches || []).map((match) => (
                <div key={match.matchId} className="flex items-center justify-between rounded-lg bg-bg-void border border-border-hairline p-3">
                  <div className="flex flex-col">
                    <span className="font-mono text-[10px] text-text-primary uppercase truncate max-w-[120px]">
                      {match.user1?.username} vs {match.user2?.username}
                    </span>
                    <span className="text-[9px] text-text-secondary uppercase truncate max-w-[120px]">{match.problemTitle}</span>
                  </div>
                  <Button variant="ghost" className="!px-2 !py-1 text-[9px] tracking-widest uppercase h-fit flex-shrink-0" onClick={() => onSpectate(match.matchId, match.problemId, [match.user1, match.user2])}>Spectate</Button>
                </div>
              ))
            )}
          </div>
        </GlowPanel>

        {/* 4. RECENTLY PLAYED */}
        <GlowPanel className="max-lg:h-[420px] lg:col-span-4 lg:col-start-9 lg:row-span-2 lg:row-start-1 flex min-h-0 flex-col p-3">
          <div className="mb-4 flex items-center justify-between flex-shrink-0">
            <p className="text-xs uppercase tracking-[0.2em] text-text-secondary">Recently Played</p>
            <Badge label="Live" tone="primary" />
          </div>

          <div className="space-y-2 flex-1 min-h-0 overflow-y-auto pr-2">
            {isLoadingMatches ? (
              <div className="rounded-lg border border-border-hairline bg-bg-panel-raised px-3 py-4 text-sm text-text-secondary">Loading matches...</div>
            ) : error ? (
              <div className="rounded-lg border border-accent-danger/60 bg-accent-danger/10 px-3 py-4 text-sm text-accent-danger">{error}</div>
            ) : recentMatches.length === 0 ? (
              <div className="rounded-lg border border-border-hairline bg-bg-panel-raised px-3 py-4 text-sm text-text-secondary">No recent matches yet.</div>
            ) : (
              recentMatches.map((match, index) => {
                const isWin = match.result === 'WIN';
                
                return (
                  <div
                    key={match.matchId}
                    className={`rounded-xl border p-3 transition-all flex flex-col gap-2 ${
                      isWin
                        ? 'border-accent-primary/40 bg-accent-primary/5 hover:border-accent-primary/60'
                        : 'border-accent-danger/40 bg-accent-danger/5 hover:border-accent-danger/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-bold text-text-primary">{match.opponentName}</span>
                      <span
                        className={`font-bold text-xs ${
                          isWin ? 'text-accent-primary' : 'text-accent-danger'
                        }`}
                      >
                        {match.result}
                      </span>
                    </div>

                    <button 
                      onClick={() => {
                        if (isWin && match.submissionId) {
                          onReviewSolution(match.submissionId);
                        } else {
                          onUpsolve(match.problemId);
                        }
                      }}
                      className="text-[11px] text-left uppercase tracking-[0.1em] text-text-secondary hover:text-white hover:underline truncate"
                      title={match.problemTitle}
                    >
                      {match.problemTitle}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </GlowPanel>

        {/* 5. TOPICS */}
        <GlowPanel className="lg:col-span-12 lg:row-start-3 flex min-h-0 flex-col p-3">
          <div className="mb-3 flex items-center justify-between flex-shrink-0">
            <p className="text-xs uppercase tracking-[0.2em] text-text-secondary">Topics</p>
            <div className="flex items-center gap-4">
              <button onClick={() => setTopicsExpanded(!topicsExpanded)} className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-secondary hover:text-text-primary transition-colors flex items-center gap-2">
                <ChevronStack up={topicsExpanded} />
                {topicsExpanded ? 'Collapse' : 'Expand'}
              </button>
            </div>
          </div>
          <div className={`${topicsExpanded ? 'max-h-[132px] overflow-y-auto' : 'max-h-[34px] overflow-hidden'} pr-2 transition-all duration-300 ease-in-out`}>
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
