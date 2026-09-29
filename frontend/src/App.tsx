import { ErrorBoundary } from "./components/shared/ErrorBoundary";
import { useState, useEffect } from 'react';
import { AftermathScreen } from './screens/Aftermath';
import { AuthScreen } from './screens/Auth';
import { Battleground } from './screens/Battleground';
import { LobbyDashboard } from './screens/Lobby';
import { MatchmakingQueue } from './screens/Queue';
import { PracticeScreen } from './screens/Practice';
import { RecentSolutionScreen } from './screens/RecentSolution';
import { TagExplorerScreen } from './screens/TagExplorer';
import { ProblemsScreen } from './screens/Problems';
import { useAuth } from './hooks/useAuth';
import { RealtimeProvider, useRealtimeEvent, useSocket } from './providers/RealtimeProvider';
import { CustomLobbyScreen } from './screens/CustomLobby';
import { TopNav } from "./components/shared/TopNav";

import { DashboardScreen } from './screens/Dashboard';
import { CustomBattleground } from './screens/CustomBattleground';
import { SpectatorScreen } from './screens/Spectator';
import type { AuthUser } from './lib/api';

type Screen = 'lobby' | 'queue' | 'battle' | 'custom-battle' | 'aftermath' | 'solution-review' | 'upsolve' | 'tag-explorer' | 'custom-lobby' | 'dashboard' | 'spectator' | 'problems';
type MatchContext = { matchId: string; problemId: string; players?: { id: string, username: string }[]; startTime?: string; };

function ArenaShell({ user, logout }: { user: AuthUser; logout: () => void }) {
  const [screenHistory, setScreenHistory] = useState<Screen[]>(() => {
    const hist = sessionStorage.getItem('screenHistory');
    if (hist) return JSON.parse(hist);
    const curr = sessionStorage.getItem('screen') as Screen;
    return [curr || 'lobby'];
  });
  const screen = screenHistory[screenHistory.length - 1] || 'lobby';
  
  // Sync initial load with URL hash if present
  useEffect(() => {
    const hash = window.location.hash.replace('#', '') as Screen;
    if (hash && hash !== screen) {
      setScreenHistory(prev => {
        const newHist = hash === 'lobby' ? ['lobby' as Screen] : [...prev, hash];
        sessionStorage.setItem('screenHistory', JSON.stringify(newHist));
        sessionStorage.setItem('screen', hash);
        return newHist;
      });
    } else if (!window.location.hash) {
      window.history.replaceState({ screen }, '', `#${screen}`);
    }
  }, []);

  // Listen for native browser back/forward buttons
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const hash = window.location.hash.replace('#', '') as Screen;
      const targetScreen = hash || 'lobby';

      setScreenHistory(prev => {
        // If we are going backward in our stack
        if (prev.length > 1 && prev[prev.length - 2] === targetScreen) {
          const newHist = prev.slice(0, -1);
          sessionStorage.setItem('screenHistory', JSON.stringify(newHist));
          sessionStorage.setItem('screen', newHist[newHist.length - 1]);
          return newHist;
        } else {
          // If going forward or jumping, just push to stack
          const newHist = targetScreen === 'lobby' ? ['lobby' as Screen] : [...prev, targetScreen];
          sessionStorage.setItem('screenHistory', JSON.stringify(newHist));
          sessionStorage.setItem('screen', targetScreen);
          return newHist;
        }
      });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const setScreen = (newScreen: Screen) => {
    setScreenHistory(prev => {
      const newHist = newScreen === 'lobby' ? ['lobby' as Screen] : [...prev, newScreen];
      sessionStorage.setItem('screenHistory', JSON.stringify(newHist));
      sessionStorage.setItem('screen', newScreen);
      window.history.pushState({ screen: newScreen }, '', `#${newScreen}`);
      return newHist;
    });
  };

  const goBack = () => {
    if (screenHistory.length > 1) {
      // Triggers popstate listener which handles the actual state update
      window.history.back();
    } else {
      setScreen('lobby');
    }
  };
  const [match, setMatch] = useState<MatchContext | null>(() => {
    const m = sessionStorage.getItem('match');
    return m ? JSON.parse(m) : null;
  });
  const [result, setResult] = useState<'VICTORY' | 'DEFEAT'>(() => (sessionStorage.getItem('result') as 'VICTORY'|'DEFEAT') || 'VICTORY');
  const [customResultPayload, setCustomResultPayload] = useState<any>(null);
  const [elo, setElo] = useState(user.elo_rating);
  const [queueTag, setQueueTag] = useState<string | undefined>(() => sessionStorage.getItem('queueTag') || undefined);
  const [reviewSubmissionId, setReviewSubmissionId] = useState<string | null>(() => sessionStorage.getItem('reviewSubmissionId') || null);
  const [practiceProblemId, setPracticeProblemId] = useState<string | null>(() => sessionStorage.getItem('practiceProblemId') || null);
  const [customLobbyId, setCustomLobbyId] = useState<string | null>(() => sessionStorage.getItem('customLobbyId') || null);
  const [tagExplorerInitialTag, setTagExplorerInitialTag] = useState<string | undefined>(undefined);
  const [inviteModal, setInviteModal] = useState<{ lobbyId: string, inviterUsername: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const socket = useSocket();

  useEffect(() => {
    
    if (match) sessionStorage.setItem('match', JSON.stringify(match));
    else sessionStorage.removeItem('match');
    
    sessionStorage.setItem('result', result);
    
    if (queueTag) sessionStorage.setItem('queueTag', queueTag);
    else sessionStorage.removeItem('queueTag');
    
    if (reviewSubmissionId) sessionStorage.setItem('reviewSubmissionId', reviewSubmissionId);
    else sessionStorage.removeItem('reviewSubmissionId');
    
    if (practiceProblemId) sessionStorage.setItem('practiceProblemId', practiceProblemId);
    else sessionStorage.removeItem('practiceProblemId');
    
    if (customLobbyId) sessionStorage.setItem('customLobbyId', customLobbyId);
    else sessionStorage.removeItem('customLobbyId');
  }, [screen, match, result, queueTag, reviewSubmissionId, practiceProblemId, customLobbyId]);

  useRealtimeEvent('elo_update', (payload) => {
    if (payload.userId === user.id) setElo(payload.newElo);
  });

  useRealtimeEvent('error', (payload) => {
    setErrorMsg(payload.message);
    setTimeout(() => setErrorMsg(null), 3000);
  });

  useRealtimeEvent('custom_lobby_invite_received', (payload) => {
    setInviteModal({ lobbyId: payload.lobbyId, inviterUsername: payload.inviterUsername });
  });

  useRealtimeEvent('custom_match_started', (data) => {
    setMatch({ matchId: data.id, problemId: data.problemId });
    setScreen('custom-battle');
  });

  useRealtimeEvent('custom_lobby_joined', (data) => {
    setCustomLobbyId(data.id);
    setScreen('custom-lobby');
  });

  const handleAcceptInvite = () => {
    if (!inviteModal || !socket) return;
    setCustomLobbyId(inviteModal.lobbyId);
    setInviteModal(null);
    setScreen('custom-lobby');
  };

  const handleDeclineInvite = () => {
    if (!inviteModal || !socket) return;
    socket.emit('custom_lobby_decline', { lobbyId: inviteModal.lobbyId });
    setInviteModal(null);
  };

  const enterQueue = (tag?: string) => {
    setQueueTag(tag);
    setScreen('queue');
  };
  const onMatchFound = (foundMatch: MatchContext) => {
    setMatch(foundMatch);
    setScreen('battle');
  };
  const onFinished = (winnerId: string) => {
    setResult(winnerId === user.id ? 'VICTORY' : 'DEFEAT');
    setScreen('aftermath');
  };
  const onCustomFinished = (payload: any) => {
    setCustomResultPayload(payload);
    // Modal will handle display, if user hits exit they will go to lobby
  };
  const onReviewSolution = (submissionId: string) => {
    setReviewSubmissionId(submissionId);
    setScreen('solution-review');
  };
  const onUpsolve = (problemId: string) => {
    setPracticeProblemId(problemId);
    setScreen('upsolve');
  };

  return (
    <main className="min-h-screen bg-bg-void text-text-primary flex flex-col">
      {!['battle', 'custom-battle', 'practice', 'spectator'].includes(screen) && (
        <TopNav 
          username={user.username} 
          avatarUrl={user.avatar_url} 
          onDashboard={() => setScreen('dashboard')}
          onProblems={() => setScreen('problems')} 
          onHome={() => setScreen('lobby')}
          onLogout={logout} 
        />
      )}
      <div className="flex-1 flex flex-col">
        {screen === 'lobby' && (
        <LobbyDashboard
          username={user.username}
          elo={elo}
          avatarUrl={user.avatar_url}
          onFindMatch={enterQueue}
          onExploreTags={(tag) => {
            setTagExplorerInitialTag(tag);
            setScreen('tag-explorer');
          }}
          onDashboard={() => setScreen('dashboard')}
          onSpectate={(matchId, problemId, players) => {
            setMatch({ matchId, problemId, players });
            setScreen('spectator');
          }}
          onLogout={logout}
          onReviewSolution={onReviewSolution}
          onUpsolve={onUpsolve}
          onCreateCustomLobby={(lobbyId) => {
            setCustomLobbyId(lobbyId);
            setScreen('custom-lobby');
          }}
          onJoinByCode={(code) => {
            if (socket) {
              socket.emit('custom_lobby_join_by_code', { joinCode: code });
            }
          }}
          externalError={errorMsg}
        />
      )}
      {screen === 'queue' && <MatchmakingQueue tag={queueTag} onCancel={goBack} onMatchFound={onMatchFound} />}
      {screen === 'battle' && match && <Battleground userId={user.id} matchId={match.matchId} problemId={match.problemId} onFinished={onFinished} startTime={match.startTime} />}
      {screen === 'custom-battle' && match && <CustomBattleground userId={user.id} lobbyId={match.matchId} problemId={match.problemId} onFinished={onCustomFinished} onLobby={() => setScreen('lobby')} />}
      {screen === 'aftermath' && <AftermathScreen result={result} elo={elo}
          matchId={match?.matchId} onRematch={enterQueue} onMatchFound={onMatchFound} onLobby={() => setScreen('lobby')} />}
      {screen === 'spectator' && match && <SpectatorScreen matchId={match.matchId} problemId={match.problemId} players={match.players} onBack={goBack} />}
      {screen === 'solution-review' && reviewSubmissionId && <RecentSolutionScreen submissionId={reviewSubmissionId} onBack={goBack} onUpsolve={onUpsolve} />}

      {screen === 'problems' && (
        <ProblemsScreen
          onSolveProblem={(problemId) => {
            setPracticeProblemId(problemId);
            setScreen('upsolve');
          }}
        />
      )}
      {screen === 'tag-explorer' && (
        <TagExplorerScreen
          initialTag={tagExplorerInitialTag}
          onBackToLobby={goBack}
          onSolveProblem={(problemId) => {
            setPracticeProblemId(problemId);
            setScreen('upsolve');
          }}
          onFindMatch={(tag) => enterQueue(tag)}
        />
      )}
      {screen === 'upsolve' && practiceProblemId && (
        <PracticeScreen
          userId={user.id}
          problemId={practiceProblemId}
          mode="upsolve"
          onBack={goBack} onReviewSubmission={onReviewSolution}
        />
      )}
      {screen === 'custom-lobby' && customLobbyId && (
        <CustomLobbyScreen
          lobbyId={customLobbyId}
          currentUser={user}
          onLeave={() => {
            setCustomLobbyId(null);
            goBack();
          }}
          onMatchStart={(problemId) => {
            setMatch({ matchId: customLobbyId, problemId });
            setScreen('custom-battle');
          }}
        />
      )}
      {screen === 'dashboard' && <DashboardScreen onBack={goBack} username={user.username} onUpsolve={onUpsolve} />}

      {/* Invite Modal */}
      {inviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-xl border border-border-hairline bg-bg-panel p-6 shadow-2xl text-center">
            <h2 className="mb-2 text-lg font-medium tracking-[0.1em] text-text-primary uppercase font-mono">Lobby Invite</h2>
            <p className="mb-6 text-sm text-text-secondary">
              <strong className="text-accent-primary">{inviteModal.inviterUsername}</strong> has invited you to a custom match!
            </p>
            <div className="flex justify-center gap-3">
              <button 
                className="px-4 py-2 rounded uppercase text-[10px] tracking-wider text-text-secondary hover:text-white transition"
                onClick={handleDeclineInvite}
              >
                Decline
              </button>
              <button 
                className="px-6 py-2 rounded bg-accent-primary text-bg-void font-medium uppercase text-[10px] tracking-wider hover:bg-opacity-90 transition"
                onClick={handleAcceptInvite}
              >
                Accept & Join
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </main>
  );
}

export default function App() {
  const auth = useAuth();

  if (!auth.user) {
    return <AuthScreen onAuthenticated={() => undefined} login={auth.login} signup={auth.signup} isLoading={auth.isLoading} error={auth.error} />;
  }

  return <ErrorBoundary><RealtimeProvider><ArenaShell user={auth.user} logout={auth.logout} /></RealtimeProvider></ErrorBoundary>;
}
