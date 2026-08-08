import { useState } from 'react';
import { AftermathScreen } from './screens/Aftermath';
import { AuthScreen } from './screens/Auth';
import { Battleground } from './screens/Battleground';
import { LobbyDashboard } from './screens/Lobby';
import { MatchmakingQueue } from './screens/Queue';
import { useAuth } from './hooks/useAuth';
import { RealtimeProvider, useRealtimeEvent } from './providers/RealtimeProvider';
import type { AuthUser } from './lib/api';

type Screen = 'lobby' | 'queue' | 'battle' | 'aftermath';
type MatchContext = { matchId: string; problemId: string };

function ArenaShell({ token, user, logout }: { token: string; user: AuthUser; logout: () => void }) {
  const [screen, setScreen] = useState<Screen>('lobby');
  const [match, setMatch] = useState<MatchContext | null>(null);
  const [result, setResult] = useState<'VICTORY' | 'DEFEAT'>('VICTORY');
  const [elo, setElo] = useState(user.elo_rating);

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

  return (
    <main className="min-h-screen bg-bg-void text-text-primary">
      {screen === 'lobby' && <LobbyDashboard username={user.username} elo={elo} onFindMatch={enterQueue} onLogout={logout} />}
      {screen === 'queue' && <MatchmakingQueue onCancel={() => setScreen('lobby')} onMatchFound={onMatchFound} />}
      {screen === 'battle' && match && <Battleground token={token} userId={user.id} matchId={match.matchId} problemId={match.problemId} onFinished={onFinished} />}
      {screen === 'aftermath' && <AftermathScreen result={result} elo={elo} onRematch={enterQueue} onLobby={() => setScreen('lobby')} />}
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
