import { useState } from 'react';
import { AftermathScreen } from './screens/Aftermath';
import { AuthScreen } from './screens/Auth';
import { Battleground } from './screens/Battleground';
import { LobbyDashboard } from './screens/Lobby';
import { MatchmakingQueue } from './screens/Queue';
import { PracticeScreen } from './screens/Practice';
import { RecentSolutionScreen } from './screens/RecentSolution';
import { useAuth } from './hooks/useAuth';
import { RealtimeProvider, useRealtimeEvent } from './providers/RealtimeProvider';
import type { AuthUser } from './lib/api';

type Screen = 'lobby' | 'queue' | 'battle' | 'aftermath' | 'solution-review' | 'upsolve';
type MatchContext = { matchId: string; problemId: string };

function ArenaShell({ token, user, logout }: { token: string; user: AuthUser; logout: () => void }) {
  const [screen, setScreen] = useState<Screen>('lobby');
  const [match, setMatch] = useState<MatchContext | null>(null);
  const [result, setResult] = useState<'VICTORY' | 'DEFEAT'>('VICTORY');
  const [elo, setElo] = useState(user.elo_rating);
  const [reviewSubmissionId, setReviewSubmissionId] = useState<string | null>(null);
  const [practiceProblemId, setPracticeProblemId] = useState<string | null>(null);

  useRealtimeEvent('elo_update', (payload) => {
    if (payload.userId === user.id) setElo(payload.newElo);
  });

  const enterQueue = () => setScreen('queue');
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
          token={token}
          username={user.username}
          elo={elo}
          onFindMatch={enterQueue}
          onLogout={logout}
          onReviewSolution={onReviewSolution}
          onUpsolve={onUpsolve}
        />
      )}
      {screen === 'queue' && <MatchmakingQueue onCancel={() => setScreen('lobby')} onMatchFound={onMatchFound} />}
      {screen === 'battle' && match && <Battleground token={token} userId={user.id} matchId={match.matchId} problemId={match.problemId} onFinished={onFinished} />}
      {screen === 'aftermath' && <AftermathScreen result={result} elo={elo} onRematch={enterQueue} onLobby={() => setScreen('lobby')} />}
      {screen === 'solution-review' && reviewSubmissionId && <RecentSolutionScreen token={token} submissionId={reviewSubmissionId} onBack={() => setScreen('lobby')} />}
      {screen === 'upsolve' && practiceProblemId && (
        <PracticeScreen
          token={token}
          userId={user.id}
          problemId={practiceProblemId}
          mode="upsolve"
          onBack={() => setScreen('lobby')}
        />
      )}
    </main>
  );
}

export default function App() {
  const auth = useAuth();

  if (!auth.token || !auth.user) {
    return <AuthScreen onAuthenticated={() => undefined} login={auth.login} signup={auth.signup} isLoading={auth.isLoading} error={auth.error} />;
  }

  return <RealtimeProvider token={auth.token}><ArenaShell token={auth.token} user={auth.user} logout={auth.logout} /></RealtimeProvider>;
}
