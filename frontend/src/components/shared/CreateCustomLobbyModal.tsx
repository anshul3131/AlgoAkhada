import { useState, useEffect } from 'react';
import { Button } from './Button';
import { useSocket } from '../../providers/RealtimeProvider';

export function CustomLobbyRulesModal({
  isOpen,
  onClose,
  onSubmit,
  isEditMode = false,
  initialData,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (lobbyId: string) => void;
  isEditMode?: boolean;
  initialData?: { lobbyId?: string, topic: string, timeLimitMins: number, maxParticipants: number };
}) {
  const [topic, setTopic] = useState(initialData?.topic || 'dp');
  const [timeLimitMins, setTimeLimitMins] = useState(initialData?.timeLimitMins || 30);
  const [maxParticipants, setMaxParticipants] = useState(initialData?.maxParticipants || 10);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const socket = useSocket();

  useEffect(() => {
    if (isOpen && initialData) {
      setTopic(initialData.topic);
      setTimeLimitMins(initialData.timeLimitMins);
      setMaxParticipants(initialData.maxParticipants);
    }
  }, [isOpen, initialData]);

  useEffect(() => {
    if (!isOpen || !socket) return;

    const handleUpdated = (data: any) => {
      setIsSubmitting(false);
      onSubmit(data.id);
    };
    const handleError = (data: any) => {
      setIsSubmitting(false);
      setError(data.message || 'Failed to process request');
    };

    socket.on('custom_lobby_updated', handleUpdated);
    socket.on('error', handleError);

    return () => {
      socket.off('custom_lobby_updated', handleUpdated);
      socket.off('error', handleError);
    };
  }, [isOpen, socket, onSubmit]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!socket) return;
    setIsSubmitting(true);
    setError(null);
    if (isEditMode && initialData?.lobbyId) {
      socket.emit('custom_lobby_update', { lobbyId: initialData.lobbyId, topic, timeLimit: timeLimitMins * 60, maxParticipants });
    } else {
      socket.emit('custom_lobby_create', { topic, timeLimit: timeLimitMins * 60, maxParticipants });
    }
  };

  const problemTags = [
    'greedy', 'graph matchings', 'brute force', 'geometry', 'games', 'graphs',
    'dfs and similar', 'ternary search', 'string suffix structures', 'chinese remainder theorem',
    'math', 'strings', 'two pointers', 'constructive algorithms', 'dsu', 'trees',
    'fft', 'hashing', 'implementation', 'binary search', 'divide and conquer',
    'schedules', 'probabilities', '2-sat', 'meet-in-the-middle', 'number theory',
    'data structures', 'dp', 'flows', 'expression parsing', 'matrices',
    'shortest paths', 'sortings', 'combinatorics', 'bitmasks'
  ].sort();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl border border-border-hairline bg-bg-panel p-6 shadow-2xl">
        <h2 className="mb-6 text-xl font-medium tracking-[0.1em] text-text-primary uppercase font-mono">
          {isEditMode ? 'Update Match Rules' : 'Create Custom Match'}
        </h2>
        
        <div className="mb-4">
          <label className="mb-2 block text-[10px] uppercase tracking-[0.2em] text-text-secondary">Topic</label>
          <select
            className="w-full rounded border border-border-hairline bg-bg-void px-3 py-2 text-sm text-text-primary focus:border-accent-primary focus:outline-none transition-colors"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          >
            {problemTags.map(tag => (
              <option key={tag} value={tag}>{tag.toUpperCase()}</option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label className="mb-2 block text-[10px] uppercase tracking-[0.2em] text-text-secondary">Time Limit (Minutes)</label>
          <input
            type="number"
            className="w-full rounded border border-border-hairline bg-bg-void px-3 py-2 text-sm text-text-primary focus:border-accent-primary focus:outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            value={timeLimitMins || ''}
            onChange={(e) => setTimeLimitMins(parseInt(e.target.value) || 0)}
            min={1}
            step={1}
          />
        </div>

        <div className="mb-6">
          <label className="block text-xs uppercase tracking-widest text-text-secondary mb-2">Max Participants</label>
          <div className="flex items-center gap-4">
            <input 
              type="range" 
              min="2" max="20" step="1"
              value={maxParticipants}
              onChange={(e) => setMaxParticipants(parseInt(e.target.value))}
              className="flex-1 accent-accent-primary"
            />
            <span className="font-mono text-xl text-accent-primary w-8 text-right">{maxParticipants}</span>
          </div>
        </div>

        {error && <div className="mb-4 text-xs text-accent-danger tracking-wide">{error}</div>}

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Processing...' : (isEditMode ? 'Update Rules' : 'Create Lobby')}
          </Button>
        </div>
      </div>
    </div>
  );
}
