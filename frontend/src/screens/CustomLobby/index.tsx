import { useEffect, useState } from 'react';
import { Button } from '../../components/shared/Button';
import { GlowPanel } from '../../components/shared/GlowPanel';
import { Badge } from '../../components/shared/Badge';
import { customMatchApi, AuthUser } from '../../lib/api';
import { useSocket, useRealtimeEvent } from '../../providers/RealtimeProvider';
import { UserSearch } from './UserSearch';
import { CustomLobbyRulesModal } from '../../components/shared/CreateCustomLobbyModal';
import { ChatArena } from './ChatArena';
import { useVoiceChat } from '../../hooks/useVoiceChat';
import { Mic, MicOff, VolumeX, Volume2, User as UserIcon } from 'lucide-react';

function VoiceActivityRing({ stream, children, isMuted }: { stream?: MediaStream | null, children: React.ReactNode, isMuted?: boolean }) {
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    if (!stream || isMuted) {
      setIsSpeaking(false);
      return;
    }
    let audioContext: AudioContext;
    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      return; // Web Audio API not supported
    }
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.5;

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) return;
    
    const mediaStreamSource = audioContext.createMediaStreamSource(new MediaStream(audioTracks));
    mediaStreamSource.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let animationId: number;

    const checkAudio = () => {
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      
      setIsSpeaking(average > 5);
      animationId = requestAnimationFrame(checkAudio);
    };
    checkAudio();

    return () => {
      cancelAnimationFrame(animationId);
      if (audioContext.state !== 'closed') {
        audioContext.close().catch(() => {});
      }
    };
  }, [stream, isMuted]);

  return (
    <div className={`relative rounded-full transition-all duration-150 ${isSpeaking ? 'shadow-[0_0_12px_rgba(34,197,94,0.8)] ring-2 ring-green-500 bg-green-500/10' : ''}`}>
      {children}
    </div>
  );
}

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
  const [actionError, setActionError] = useState<string | null>(null);
  const [isEditRulesModalOpen, setIsEditRulesModalOpen] = useState(false);
  const socket = useSocket();
  
  const { isMuted, isDeafened, toggleMute, toggleDeafen, remoteStreams, initiateConnection, isMediaReady, localStream } = useVoiceChat(lobbyId, currentUser.id);

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
    
    if (socket) {
      socket.emit('custom_lobby_join', { lobbyId });
    }

    return () => { active = false; };
  }, [lobbyId, socket]);

  // Connect to peers as they join
  useEffect(() => {
    if (lobby && lobby.participants && isMediaReady) {
      lobby.participants.forEach((p: any) => {
        if (p.userId !== currentUser.id && p.status === 'JOINED') {
          initiateConnection(p.userId);
        }
      });
    }
  }, [lobby, currentUser.id, initiateConnection, isMediaReady]);

  useRealtimeEvent('custom_lobby_updated', (data) => {
    if (data.id === lobbyId) setLobby(data);
  });

  useRealtimeEvent('custom_match_started', (data) => {
    if (data.id === lobbyId && data.problemId) {
      onMatchStart(data.problemId);
    }
  });

  useRealtimeEvent('error', (payload) => {
    if (payload?.message) {
      setActionError(payload.message);
      setTimeout(() => setActionError(null), 5000);
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
    <div className="h-screen flex flex-col p-4 md:p-6 overflow-hidden max-w-[1600px] mx-auto">
      <div className="mb-4 flex flex-shrink-0 items-center justify-between bg-bg-panel-raised p-4 rounded-xl border border-border-hairline">
        <h1 className="text-xl md:text-2xl font-mono uppercase tracking-[0.2em] text-text-primary flex items-center gap-4">
          <span className="text-accent-primary drop-shadow-[0_0_8px_rgba(0,255,136,0.5)]">●</span> CUSTOM ARENA
        </h1>
        <div className="flex items-center gap-4">
          <Badge label={`JOIN CODE: ${lobby.joinCode}`} tone="primary" />
          <Button variant="ghost" onClick={handleLeave} className="text-[10px] tracking-widest uppercase !px-3">Leave</Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-4 gap-4">
        
        {/* LEFT COLUMN: Match Config & Host Controls */}
        <div className="md:col-span-1 flex flex-col gap-4 overflow-y-auto">
          <GlowPanel className="flex flex-col gap-4">
            <div className="border-b border-border-hairline pb-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-text-secondary mb-1">Topic</p>
              <p className="text-lg text-accent-primary font-medium">{lobby.topic}</p>
            </div>
            <div className="flex justify-between items-center">
              <p className="text-[10px] uppercase tracking-[0.2em] text-text-secondary">Rules</p>
              {isHost && (
                <Button variant="ghost" className="!px-2 !py-1 !text-[9px] border-dashed border-accent-primary text-accent-primary" onClick={() => setIsEditRulesModalOpen(true)}>
                  EDIT
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge label={`${lobby.timeLimit / 60} Min`} tone="electric" />
              <Badge label={`Max ${lobby.maxParticipants} Players`} tone="primary" />
            </div>

            <div className="mt-4 pt-4 border-t border-border-hairline">
              {actionError && (
                <div className="mb-4 rounded bg-accent-danger/20 border border-accent-danger p-3 text-center">
                  <p className="text-xs text-accent-danger font-mono uppercase">{actionError}</p>
                </div>
              )}
              {isHost ? (
                <Button className="w-full text-sm py-4 animate-pulse-glow" onClick={handleStart}>LAUNCH BATTLE</Button>
              ) : (
                <div className="text-center py-4 border border-dashed border-border-hairline rounded bg-bg-void/50">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-text-secondary animate-pulse">Awaiting Host...</p>
                </div>
              )}
            </div>
          </GlowPanel>

          <GlowPanel className="flex-1">
            <h2 className="text-[10px] uppercase tracking-[0.2em] text-text-secondary mb-4 flex items-center gap-2">
              <UserIcon size={14} /> Invite Operatives
            </h2>
            {isHost ? (
              <UserSearch lobbyId={lobbyId} />
            ) : (
              <div className="text-center p-4 text-xs text-text-secondary">
                Only the host can invite others.
              </div>
            )}
          </GlowPanel>
        </div>

        {/* CENTER COLUMN: Chat Arena */}
        <div className="md:col-span-2 flex flex-col min-h-0">
          <ChatArena lobbyId={lobbyId} currentUserId={currentUser.id} participants={lobby.participants} />
        </div>

        {/* RIGHT COLUMN: Participants & Voice Comm */}
        <div className="md:col-span-1 flex flex-col min-h-0">
          <GlowPanel className="flex flex-col h-full !p-0">
            <div className="bg-bg-panel-raised p-4 border-b border-border-hairline flex justify-between items-center">
              <h2 className="text-[10px] uppercase tracking-[0.2em] text-text-secondary">Squad ({lobby.participants?.length || 0})</h2>
              
              <div className="flex gap-2">
                <button 
                  onClick={toggleDeafen}
                  className={`p-1.5 rounded transition ${isDeafened ? 'bg-accent-danger text-white' : 'bg-bg-void text-text-secondary hover:text-white'}`}
                  title={isDeafened ? 'Undeafen' : 'Deafen'}
                >
                  {isDeafened ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>
                <button 
                  onClick={toggleMute}
                  className={`p-1.5 rounded transition ${isMuted ? 'bg-accent-danger text-white' : 'bg-bg-void text-text-secondary hover:text-white'}`}
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <MicOff size={14} /> : <Mic size={14} />}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {lobby.participants?.map((p: any) => {
                const stream = remoteStreams[p.userId];
                // Hidden audio element for voice chat playback
                return (
                  <div key={p.userId} className="flex items-center justify-between rounded bg-bg-void p-3 border border-border-hairline relative overflow-hidden group">
                    {stream && !isDeafened && (
                      <audio autoPlay ref={(audio) => { if (audio) audio.srcObject = stream; }} />
                    )}
                    <div className="flex items-center gap-3 relative z-10">
                      <VoiceActivityRing stream={p.userId === currentUser.id ? localStream : stream} isMuted={p.userId === currentUser.id ? isMuted : false}>
                        <div className="relative">
                          <div className="w-8 h-8 rounded-full bg-bg-panel-raised flex items-center justify-center border border-border-hairline text-text-primary uppercase font-bold text-xs">
                            {p.username.substring(0, 2)}
                          </div>
                          {/* Status indicator */}
                          <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-bg-void ${p.status === 'JOINED' ? 'bg-accent-primary' : 'bg-accent-warn'}`}></div>
                        </div>
                      </VoiceActivityRing>
                      <div className="flex flex-col">
                        <span className="font-mono text-sm text-text-primary flex items-center gap-2">
                          {p.username} 
                          {p.userId === lobby.hostId && <span className="text-[8px] tracking-widest text-accent-electric border border-accent-electric px-1 rounded">HOST</span>}
                        </span>
                        <span className="text-[9px] text-text-secondary uppercase">{p.status}</span>
                      </div>
                    </div>
                    {stream && (
                       <Mic size={14} className="text-accent-primary animate-pulse" />
                    )}
                  </div>
                );
              })}
            </div>
          </GlowPanel>
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

