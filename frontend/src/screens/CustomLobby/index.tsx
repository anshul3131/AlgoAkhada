import { useEffect, useState } from 'react';
import { Button } from '../../components/shared/Button';
import { GlowPanel } from '../../components/shared/GlowPanel';
import { Badge } from '../../components/shared/Badge';
import { customMatchApi, AuthUser } from '../../lib/api';
import { useSocket, useRealtimeEvent } from '../../providers/RealtimeProvider';
import { UserSearch } from './UserSearch';
import { CustomLobbyRulesModal } from '../../components/shared/CreateCustomLobbyModal';

export function CustomLobbyScreen({
  lobbyId,
  currentUser,
  onLeave,
  onMatchStart,
}: {
  lobbyId: string;
  currentUser: AuthUser;
  onLeave: () => void;
  onMatchStart: (problemId: string) => void;
}) {
  const [lobby, setLobby] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEditRulesModalOpen, setIsEditRulesModalOpen] = useState(false);
  const socket = useSocket();

  useEffect(() => {
    let active = true;
    const fetchLobby = async () => {
      try {
        const data = await customMatchApi.getMatch(lobbyId);
        if (active) setLobby(data);
      } catch (err: any) {
        if (active) setError(err.message || 'Failed to load lobby');
      }
    };
    fetchLobby();
    
    // Safety check: if user refreshed the page, join the socket room again
    if (socket) {
      socket.emit('custom_lobby_join', { lobbyId });
    }

    return () => { active = false; };
  }, [lobbyId, socket]);

  useRealtimeEvent('custom_lobby_updated', (data) => {
    if (data.id === lobbyId) setLobby(data);
  });

  useRealtimeEvent('custom_match_started', (data) => {
    if (data.id === lobbyId && data.problemId) {
      onMatchStart(data.problemId);
    }
  });

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center p-6 text-center">
        <div>
          <h2 className="mb-4 text-xl font-mono text-accent-danger uppercase tracking-widest">{error}</h2>
          <Button onClick={onLeave}>Return to Dashboard</Button>
        </div>
      </div>
    );
  }

  if (!lobby) {
    return (
      <div className="flex h-screen items-center justify-center font-mono text-xs uppercase tracking-widest text-text-secondary">
        Loading Lobby...
      </div>
    );
  }

  const isHost = lobby.hostId === currentUser.id;

  const handleStart = () => {
    if (!socket) return;
    socket.emit('custom_lobby_start', { lobbyId });
  };

  const handleLeave = () => {
    if (socket) {
      socket.emit('custom_lobby_leave', { lobbyId });
    }
    onLeave();
  };

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-mono uppercase tracking-[0.2em] text-text-primary flex items-center gap-4">
          <span><span className="text-accent-primary">#</span> Custom Match</span>
          <Badge label={`JOIN CODE: ${lobby.joinCode}`} tone="primary" />
        </h1>
        <Button variant="ghost" onClick={handleLeave} className="text-xs tracking-widest uppercase">Leave Lobby</Button>
      </div>

      <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          <GlowPanel>
            <div className="mb-6 flex justify-between items-center border-b border-border-hairline pb-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-text-secondary mb-1">Topic</p>
                <p className="text-lg text-text-primary font-medium">{lobby.topic}</p>
              </div>
              <div className="text-right">
                <div className="flex items-center justify-end gap-2 mb-2">
                  {isHost && (
                    <Button 
                      variant="ghost" 
                      className="!px-3 !py-1 !text-[10px] border-dashed border-accent-primary text-accent-primary"
                      onClick={() => setIsEditRulesModalOpen(true)}
                    >
                      EDIT RULES
                    </Button>
                  )}
                  <p className="text-[10px] uppercase tracking-[0.2em] text-text-secondary">Match Rules</p>
                </div>
                <div className="flex justify-end items-center gap-2">
                  <Badge label={`${lobby.timeLimit / 60} Min`} tone="electric" />
                  <Badge label={`${lobby.participants.length} / ${lobby.maxParticipants} Players`} tone="primary" />
                </div>
              </div>
            </div>

            <div className="mb-4">
              <h2 className="text-xs uppercase tracking-[0.2em] text-text-secondary mb-3">Participants ({lobby.participants?.length || 0})</h2>
              <div className="space-y-2">
                {lobby.participants?.map((p: any) => (
                  <div key={p.userId} className="flex items-center justify-between rounded bg-bg-panel-raised p-3 border border-border-hairline">
                    <span className="font-mono text-sm text-text-primary">{p.username} {p.userId === lobby.hostId && '(Host)'}</span>
                    <Badge label={p.status} tone={p.status === 'JOINED' ? 'primary' : 'warn'} />
                  </div>
                ))}
              </div>
            </div>
            
            {isHost && (
              <div className="mt-8">
                <Button className="w-full text-lg py-4" onClick={handleStart}>START MATCH</Button>
              </div>
            )}
            {!isHost && (
              <div className="mt-8 text-center py-4 border border-border-hairline rounded bg-bg-panel-raised">
                <p className="text-xs uppercase tracking-[0.2em] text-text-secondary animate-pulse">Waiting for host to start...</p>
              </div>
            )}
          </GlowPanel>
        </div>

        <div>
          {isHost ? (
            <GlowPanel>
              <h2 className="text-xs uppercase tracking-[0.2em] text-text-secondary mb-4">Invite Friends</h2>
              <UserSearch lobbyId={lobbyId} />
            </GlowPanel>
          ) : (
            <GlowPanel>
              <div className="text-center p-6 text-sm text-text-secondary">
                Only the host can invite other players. Hang tight!
              </div>
            </GlowPanel>
          )}
        </div>
      </div>
      <CustomLobbyRulesModal 
        isOpen={isEditRulesModalOpen}
        onClose={() => setIsEditRulesModalOpen(false)}
        onSubmit={() => setIsEditRulesModalOpen(false)}
        isEditMode={true}
        initialData={{
          lobbyId: lobby.id,
          topic: lobby.topic,
          timeLimitMins: lobby.timeLimit / 60,
          maxParticipants: lobby.maxParticipants
        }}
      />
    </div>
  );
}
