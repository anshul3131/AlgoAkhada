import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { RealtimeEventMap, RealtimeEventName } from '../types';

interface RealtimeContextValue {
  connected: boolean;
  error: string | null;
  joinQueue: (payload?: { tag?: string }) => void;
  leaveQueue: () => void;
  joinMatch: (matchId: string) => void;
  finishMatchOnTimeout: (matchId: string) => void;
  subscribeToSubmission: (submissionId: string) => void;
  emit: <K extends RealtimeEventName>(eventName: K, payload: RealtimeEventMap[K]) => void;
  subscribe: <K extends RealtimeEventName>(eventName: K, handler: (payload: RealtimeEventMap[K]) => void) => () => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);
const SOCKET_URL = (import.meta as ImportMeta & { env?: { VITE_SOCKET_URL?: string } }).env?.VITE_SOCKET_URL ?? 'http://localhost:3000';

export function RealtimeProvider({ token, children }: { token: string | null; children: ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const listenersRef = useRef<Partial<Record<RealtimeEventName, Array<(payload: never) => void>>>>({});
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setConnected(false);
      return;
    }

    const socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    socket.on('connect', () => { setConnected(true); setError(null); });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', (caughtError) => setError(caughtError.message));

    const events: RealtimeEventName[] = ['queue_status', 'match_found', 'opponent_status', 'match_result', 'elo_update', 'evaluation_complete'];
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
  }, [token]);

  const value = useMemo<RealtimeContextValue>(() => ({
    connected,
    error,
    joinQueue: (payload) => {
      if (payload && Object.keys(payload).length > 0) {
        socketRef.current?.emit('join_queue', payload);
        return;
      }

      socketRef.current?.emit('join_queue');
    },
    leaveQueue: () => socketRef.current?.emit('leave_queue'),
    joinMatch: (matchId) => socketRef.current?.emit('join_match', matchId),
    finishMatchOnTimeout: (matchId) => socketRef.current?.emit('match_timeout', matchId),
    subscribeToSubmission: (submissionId) => socketRef.current?.emit('subscribeToSubmission', submissionId),
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

  useEffect(() => {
    const unsubscribe = subscribe(eventName, handler);
    return unsubscribe;
  }, [eventName, handler, subscribe]);
}
