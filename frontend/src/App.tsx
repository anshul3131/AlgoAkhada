import { useState, useEffect } from 'react';
import { AftermathScreen } from './screens/Aftermath';
import { AuthScreen } from './screens/Auth';
import { Battleground } from './screens/Battleground';
import { LobbyDashboard } from './screens/Lobby';
import { MatchmakingQueue } from './screens/Queue';
import { PracticeScreen } from './screens/Practice';
import { RecentSolutionScreen } from './screens/RecentSolution';
import { TagExplorerScreen } from './screens/TagExplorer';
import { useAuth } from './hooks/useAuth';
import { RealtimeProvider, useRealtimeEvent } from './providers/RealtimeProvider';
import type { AuthUser } from './lib/api';

type Screen = 'lobby' | 'queue' | 'battle' | 'aftermath' | 'solution-review' | 'upsolve' | 'tag-explorer';
type MatchContext = { matchId: string; problemId: string };

function ArenaShell({ user, logout }: { user: AuthUser; logout: () => void }) {
  const [screen, setScreen] = useState<Screen>(() => (sessionStorage.getItem('screen') as Screen) || 'lobby');
  const [match, setMatch] = useState<MatchContext | null>(() => {
    const m = sessionStorage.getItem('match');
    return m ? JSON.parse(m) : null;
  });
  const [result, setResult] = useState<'VICTORY' | 'DEFEAT'>(() => (sessionStorage.getItem('result') as 'VICTORY'|'DEFEAT') || 'VICTORY');
  const [elo, setElo] = useState(user.elo_rating);
  const [queueTag, setQueueTag] = useState<string | undefined>(() => sessionStorage.getItem('queueTag') || undefined);
  const [reviewSubmissionId, setReviewSubmissionId] = useState<string | null>(() => sessionStorage.getItem('reviewSubmissionId') || null);
  const [practiceProblemId, setPracticeProblemId] = useState<string | null>(() => sessionStorage.getItem('practiceProblemId') || null);

  useEffect(() => {
    sessionStorage.setItem('screen', screen);
    if (match) sessionStorage.setItem('match', JSON.stringify(match));
    else sessionStorage.removeItem('match');
    
    sessionStorage.setItem('result', result);
    
    if (queueTag) sessionStorage.setItem('queueTag', queueTag);
    else sessionStorage.removeItem('queueTag');
    
    if (reviewSubmissionId) sessionStorage.setItem('reviewSubmissionId', reviewSubmissionId);
    else sessionStorage.removeItem('reviewSubmissionId');
    
    if (practiceProblemId) sessionStorage.setItem('practiceProblemId', practiceProblemId);
    else sessionStorage.removeItem('practiceProblemId');
  }, [screen, match, result, queueTag, reviewSubmissionId, practiceProblemId]);

  useRealtimeEvent('elo_update', (payload) => {
    if (payload.userId === user.id) setElo(payload.newElo);
  });

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
  const onReviewSolution = (submissionId: string) => {
    setReviewSubmissionId(submissionId);
    setScreen('solution-review');
  };
  const onUpsolve = (problemId: string) => {
    setPracticeProblemId(problemId);
    setScreen('upsolve');
  };

  return (
    <main className="min-h-screen bg-bg-void text-text-primary">
      {screen === 'lobby' && (
        <LobbyDashboard
          username={user.username}
          elo={elo}
          onFindMatch={enterQueue}
          onExploreTags={() => setScreen('tag-explorer')}
          onLogout={logout}
          onReviewSolution={onReviewSolution}
          onUpsolve={onUpsolve}
        />
      )}
      {screen === 'queue' && <MatchmakingQueue tag={queueTag} onCancel={() => setScreen('lobby')} onMatchFound={onMatchFound} />}
      {screen === 'battle' && match && <Battleground userId={user.id} matchId={match.matchId} problemId={match.problemId} onFinished={onFinished} />}
      {screen === 'aftermath' && <AftermathScreen result={result} elo={elo} onRematch={enterQueue} onLobby={() => setScreen('lobby')} />}
      {screen === 'solution-review' && reviewSubmissionId && <RecentSolutionScreen submissionId={reviewSubmissionId} onBack={() => setScreen('lobby')} />}
      {screen === 'tag-explorer' && (
        <TagExplorerScreen
          onBackToLobby={() => setScreen('lobby')}
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
          onBack={() => setScreen('tag-explorer')}
        />
      )}
    </main>
  );
}

export default function App() {
  const auth = useAuth();

  if (!auth.user) {
    return <AuthScreen onAuthenticated={() => undefined} login={auth.login} signup={auth.signup} isLoading={auth.isLoading} error={auth.error} />;
  }

  return <RealtimeProvider><ArenaShell user={auth.user} logout={auth.logout} /></RealtimeProvider>;
}
