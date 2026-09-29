import { useEffect, useState } from 'react';
import { GlowPanel } from './GlowPanel';
import { Badge } from './Badge';
import { customMatchApi } from '../../lib/api';
import { useRealtimeEvent } from '../../providers/RealtimeProvider';

interface PublicLobbiesPanelProps {
  onJoinCode: (code: string) => void;
  className?: string;
}

export function PublicLobbiesPanel({ onJoinCode, className = "" }: PublicLobbiesPanelProps) {
  const [lobbies, setLobbies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLobbies = async () => {
    try {
      const data = await customMatchApi.getPublicLobbies();
      setLobbies(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useRealtimeEvent('public_lobbies_updated', (payload) => {
    if (Array.isArray(payload)) setLobbies(payload);
  });

  useEffect(() => {
    const timer = setTimeout(() => {
    fetchLobbies();
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <GlowPanel className={`flex min-h-0 flex-col gap-4 overflow-hidden ${className}`}>
      <div className="flex items-center justify-between border-b border-border-hairline pb-2">
        <p className="text-xs uppercase tracking-[0.22em] text-text-secondary flex items-center gap-2">
          <span className="text-accent-electric drop-shadow-[0_0_8px_rgba(0,195,255,0.5)]">●</span> 
          Public Lobbies
        </p>
        <Badge label={`${(lobbies || []).length} LIVE`} tone="electric" />
      </div>
      
      <div className="flex-1 overflow-y-auto pr-2 space-y-3">
        {loading ? (
          <div className="text-xs text-text-secondary animate-pulse">Scanning arena...</div>
        ) : (lobbies || []).length === 0 ? (
          <div className="text-xs text-text-secondary italic">No public lobbies open right now. Be the first to create one!</div>
        ) : (
          (lobbies || []).map(lobby => (
            <div key={lobby.id} className="bg-bg-void border border-border-hairline rounded-lg p-3 hover:border-accent-electric/50 transition-colors cursor-pointer group" onClick={() => onJoinCode(lobby.joinCode)}>
              <div className="flex justify-between items-start mb-2">
                <span className="font-bold text-sm text-text-primary group-hover:text-accent-electric transition-colors truncate max-w-[150px]">{lobby.name || 'Custom Match'}</span>
                <span className="text-[10px] text-text-secondary font-mono bg-bg-panel px-1.5 py-0.5 rounded">{lobby.participants || lobby.participantCount}/{lobby.maxParticipants}</span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <Badge label={lobby.topic} tone="primary" />
                <span className={`text-[10px] font-bold uppercase tracking-widest ${lobby.difficulty === 'Hard' ? 'text-accent-danger' : lobby.difficulty === 'Medium' ? 'text-accent-warn' : 'text-accent-primary'}`}>
                  {lobby.difficulty}
                </span>
              </div>
              <div className="flex justify-between items-center mt-2 pt-2 border-t border-border-hairline/50">
                <span className="text-[10px] text-text-secondary uppercase">Host: {lobby.hostUsername || 'Unknown'}</span>
                <span className="text-[10px] text-accent-electric uppercase font-bold opacity-0 group-hover:opacity-100 transition-opacity">Click to Join</span>
              </div>
            </div>
          ))
        )}
      </div>
    </GlowPanel>
  );
}
