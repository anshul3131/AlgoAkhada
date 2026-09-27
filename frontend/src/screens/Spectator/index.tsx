import { useEffect, useState } from 'react';
import { Badge } from '../../components/shared/Badge';
import { Button } from '../../components/shared/Button';
import { GlowPanel } from '../../components/shared/GlowPanel';
import { useSocket, useRealtimeEvent } from '../../providers/RealtimeProvider';
import { problemApi, type ProblemRecord } from '../../lib/api';
import Editor from '@monaco-editor/react';

interface SpectatorScreenProps {
  matchId: string;
  problemId: string;
  players?: { id: string, username: string }[];
  onBack: () => void;
}

export function SpectatorScreen({ matchId, problemId, players, onBack }: SpectatorScreenProps) {
  const socket = useSocket();
  const [problem, setProblem] = useState<ProblemRecord | null>(null);
  
  // Storing code for multiple users
  const [userCodes, setUserCodes] = useState<Record<string, { code: string, language: string, username: string }>>(() => {
    const initial: Record<string, { code: string, language: string, username: string }> = {};
    if (players) {
      players.forEach(p => {
        if (p?.id) initial[p.id] = { code: '// Waiting for code updates...', language: 'cpp', username: p.username };
      });
    }
    return initial;
  });

  useEffect(() => {
    // Join match room
    if (socket) {
      socket.emit('join_match', matchId);
    }
    
    // Fetch problem
    problemApi.getProblem(problemId).then(setProblem).catch(console.error);

    return () => {
      if (socket) {
        socket.emit('leave_match', matchId);
      }
    };
  }, [matchId, problemId, socket]);

  useRealtimeEvent('spectator_code_update', (payload) => {
    setUserCodes(prev => ({
      ...prev,
      [payload.userId]: { 
        code: payload.code, 
        language: payload.language, 
        username: payload.username || prev[payload.userId]?.username 
      }
    }));
  });

  const [matchResult, setMatchResult] = useState<any>(null);
  const [spectatorCount, setSpectatorCount] = useState(0);

  useRealtimeEvent('match_result', (payload) => {
    if (payload.matchId === matchId) {
      setMatchResult(payload);
    }
  });

  useRealtimeEvent('spectator_count', (count) => {
    setSpectatorCount(count);
  });

  const userIds = Object.keys(userCodes);
  const player1Id = userIds[0];
  const player2Id = userIds[1];

  return (
    <main className="mx-auto max-w-[1600px] p-4 md:p-6 h-screen flex flex-col">
      <GlowPanel className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Badge label="LIVE SPECTATOR" tone="warn" />
          <span className="font-mono text-sm text-text-secondary">match/{matchId.slice(0, 8)}</span>
          {spectatorCount > 0 && <Badge label={`👁️ ${spectatorCount}`} tone="electric" />}
        </div>
        <div className="flex items-center gap-2">
          {matchResult ? (
            <Badge label={`MATCH ENDED · Winner: ${matchResult.winnerId ? (userCodes[matchResult.winnerId]?.username || matchResult.winnerId.slice(0, 8)) : 'None'}`} tone="danger" />
          ) : (
            <Badge label={`Problem: ${problem?.title ?? '...'}`} tone="electric" />
          )}
          <Button variant="ghost" onClick={onBack}>Leave Spectator</Button>
        </div>
      </GlowPanel>

      <div className="grid gap-4 lg:grid-cols-2 grow min-h-0">
        {/* Player 1 Window */}
        <GlowPanel className="flex flex-col min-h-0">
          <div className="mb-3 flex items-center justify-between shrink-0">
            <span className="text-[10px] uppercase tracking-[0.2em] text-text-secondary">
              {player1Id ? `${userCodes[player1Id].username || 'Player 1'}` : 'Waiting for Player 1...'}
            </span>
            {player1Id && <Badge label={userCodes[player1Id].language} tone="primary" />}
          </div>
          <div className="grow border border-border-hairline rounded-xl overflow-hidden bg-[#1e1e1e] relative">
            <Editor
              height="100%"
              theme="vs-dark"
              language={player1Id ? (userCodes[player1Id].language === 'python' ? 'python' : userCodes[player1Id].language === 'cpp' ? 'cpp' : 'java') : 'cpp'}
              value={player1Id ? userCodes[player1Id].code : '// Waiting for code updates...'}
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: 14,
                fontFamily: '"JetBrains Mono", "Fira Code", monospace',
              }}
            />
          </div>
        </GlowPanel>

        {/* Player 2 Window */}
        <GlowPanel className="flex flex-col min-h-0">
          <div className="mb-3 flex items-center justify-between shrink-0">
            <span className="text-[10px] uppercase tracking-[0.2em] text-text-secondary">
              {player2Id ? `${userCodes[player2Id].username || 'Player 2'}` : 'Waiting for Player 2...'}
            </span>
            {player2Id && <Badge label={userCodes[player2Id].language} tone="primary" />}
          </div>
          <div className="grow border border-border-hairline rounded-xl overflow-hidden bg-[#1e1e1e] relative">
            <Editor
              height="100%"
              theme="vs-dark"
              language={player2Id ? (userCodes[player2Id].language === 'python' ? 'python' : userCodes[player2Id].language === 'cpp' ? 'cpp' : 'java') : 'cpp'}
              value={player2Id ? userCodes[player2Id].code : '// Waiting for code updates...'}
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: 14,
                fontFamily: '"JetBrains Mono", "Fira Code", monospace',
              }}
            />
          </div>
        </GlowPanel>
      </div>
    </main>
  );
}
