import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { RealtimeEventMap, RealtimeEventName } from '../types';

interface RealtimeContextValue {
  connected: boolean;
  error: string | null;
  joinQueue: (payload?: { tag?: string }) => void;
  leaveQueue: () => void;
  joinMatch: (matchId: string) => void;
  leaveMatch: (matchId: string) => void;
  finishMatchOnTimeout: (matchId: string) => void;
  forfeitMatch: (matchId: string) => void;
  subscribeToSubmission: (submissionId: string) => void;
  updateMatchCode: (matchId: string, code: string, language: string) => void;
  emit: <K extends RealtimeEventName>(eventName: K, payload: RealtimeEventMap[K]) => void;
  subscribe: <K extends RealtimeEventName>(eventName: K, handler: (payload: RealtimeEventMap[K]) => void) => () => void;
  socket: Socket | null;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);
const SOCKET_URL = (import.meta as ImportMeta & { env?: { VITE_SOCKET_URL?: string } }).env?.VITE_SOCKET_URL ?? 'http://localhost:3000';

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const listenersRef = useRef<Partial<Record<RealtimeEventName, Array<(payload: never) => void>>>>({});
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const socket = io(SOCKET_URL, { 
      transports: ['websocket', 'polling'], 
      withCredentials: true,
      extraHeaders: { 'Bypass-Tunnel-Reminder': 'true',
      'ngrok-skip-browser-warning': 'true' }
    });
    socketRef.current = socket;
    socket.on('connect', () => { setConnected(true); setError(null); });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', (caughtError) => setError(caughtError.message));

    const events: RealtimeEventName[] = ['queue_status', 'match_found', 'opponent_status', 'match_result', 'elo_update', 'evaluation_complete', 'custom_lobby_invite_received', 'custom_lobby_updated', 'custom_lobby_joined', 'custom_match_started', 'custom_lobby_declined', 'custom_lobby_left', 'custom_match_result', 'custom_lobby_submission', 'custom_lobby_chat_message', 'custom_lobby_chat_typing', 'webrtc_offer', 'webrtc_answer', 'webrtc_ice_candidate', 'rematch_requested', 'rematch_declined', 'spectator_code_update', 'spectator_count', 'error', 'public_lobbies_updated'];
    events.forEach((eventName) => {
      socket.on(eventName, (payload) => {
        listenersRef.current[eventName]?.forEach((handler) => handler(payload as never));
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, []);

  const value = useMemo<RealtimeContextValue>(() => ({
    connected,
    error,
    socket: socketRef.current,
    joinQueue: (payload) => {
      if (payload && Object.keys(payload).length > 0) {
        socketRef.current?.emit('join_queue', payload);
        return;
      }

      socketRef.current?.emit('join_queue');
    },
    leaveQueue: () => socketRef.current?.emit('leave_queue'),
    joinMatch: (matchId) => socketRef.current?.emit('join_match', matchId),
    leaveMatch: (matchId) => socketRef.current?.emit('leave_match', matchId),
    finishMatchOnTimeout: (matchId) => socketRef.current?.emit('match_timeout', matchId),
    forfeitMatch: (matchId) => socketRef.current?.emit('forfeit_match', matchId),
    subscribeToSubmission: (submissionId) => socketRef.current?.emit('subscribeToSubmission', submissionId),
    updateMatchCode: (matchId, code, language) => socketRef.current?.emit('match_code_update', { matchId, code, language }),
    emit: (eventName, payload) => socketRef.current?.emit(eventName, payload),
    subscribe: (eventName, handler) => {
      const current = listenersRef.current[eventName] ?? [];
      listenersRef.current[eventName] = [...current, handler as (payload: never) => void];
      return () => {
        listenersRef.current[eventName] = (listenersRef.current[eventName] ?? []).filter((candidate) => candidate !== handler);
      };
    },
  }), [connected, error]);

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtimeContext() {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtimeContext must be used within RealtimeProvider');
  }

  return context;
}

export function useRealtimeEvent<K extends RealtimeEventName>(
  eventName: K,
  handler: (payload: RealtimeEventMap[K]) => void,
) {
  const { subscribe } = useRealtimeContext();
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    const unsubscribe = subscribe(eventName, (payload) => {
      handlerRef.current(payload);
    });
    return unsubscribe;
  }, [eventName, subscribe]);
}

export function useSocket() {
  const context = useContext(RealtimeContext);
  return context?.socket || null;
}
