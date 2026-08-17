import { useState, useEffect } from 'react';
import { Button } from '../../components/shared/Button';
import { userApi } from '../../lib/api';
import { useSocket, useRealtimeEvent } from '../../providers/RealtimeProvider';

export function UserSearch({ lobbyId }: { lobbyId: string }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<Map<string, 'invited' | 'declined'>>(new Map());
  const socket = useSocket();

  useRealtimeEvent('custom_lobby_declined', (data: any) => {
    if (data.lobbyId === lobbyId) {
      setInviteStatus(prev => {
        const next = new Map(prev);
        next.delete(data.declinerId);
        return next;
      });
    }
  });

  useRealtimeEvent('custom_lobby_left', (data: any) => {
    if (data.lobbyId === lobbyId) {
      setInviteStatus(prev => {
        const next = new Map(prev);
        next.delete(data.userId);
        return next;
      });
    }
  });

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const users = await userApi.searchUsers(query);
        setResults(users.users || []);
      } catch (err) {
        console.error('Failed to search users', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleInvite = (userId: string) => {
    if (!socket) return;
    socket.emit('custom_lobby_invite', { lobbyId, invitedUserId: userId });
    setInviteStatus(prev => {
      const next = new Map(prev);
      next.set(userId, 'invited');
      return next;
    });
  };

  return (
    <div className="relative">
      <input
        type="text"
        className="w-full rounded-lg border border-border-hairline bg-bg-void px-4 py-3 text-sm text-text-primary focus:border-accent-primary focus:outline-none transition-colors"
        placeholder="Search users by name to invite..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full mt-2 overflow-hidden rounded-lg border border-border-hairline bg-bg-panel shadow-2xl z-10 max-h-60 overflow-y-auto">
          {isSearching ? (
            <div className="p-4 text-xs text-text-secondary text-center">Searching...</div>
          ) : results.length === 0 ? (
            <div className="p-4 text-xs text-text-secondary text-center">No users found</div>
          ) : (
            results.map((u) => {
              const status = inviteStatus.get(u.id);
              const isInvited = status === 'invited';
              const isDeclined = status === 'declined';
              
              return (
                <div key={u.id} className="flex items-center justify-between border-b border-border-hairline p-3 hover:bg-bg-panel-raised last:border-b-0">
                  <div>
                    <div className="text-sm font-medium text-text-primary">{u.username}</div>
                    <div className="text-[10px] text-text-secondary uppercase tracking-widest">Elo: {u.eloRating}</div>
                  </div>
                  <Button
                    variant={isInvited ? 'ghost' : (isDeclined ? 'danger' : 'primary')}
                    className="text-[10px] uppercase tracking-wider py-1 px-3"
                    onClick={() => handleInvite(u.id)}
                    disabled={isInvited}
                  >
                    {isInvited ? 'Invited' : (isDeclined ? 'Declined (Re-invite)' : 'Invite')}
                  </Button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
