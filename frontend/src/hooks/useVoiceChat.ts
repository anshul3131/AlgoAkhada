import { useEffect, useRef, useState, useCallback } from 'react';
import { useSocket, useRealtimeEvent } from '../providers/RealtimeProvider';

export function useVoiceChat(lobbyId: string, currentUserId: string) {
  const socket = useSocket();
  
  const localStream = useRef<MediaStream | null>(null);
  const peerConnections = useRef<{ [key: string]: RTCPeerConnection }>({});
  
  const [isMuted, setIsMuted] = useState(true);
  const [isDeafened, setIsDeafened] = useState(true);
  
  const [remoteStreams, setRemoteStreams] = useState<{ [key: string]: MediaStream }>({});
  const [isMediaReady, setIsMediaReady] = useState(false);
  
  const config = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]
  };

  const getMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStream.current = stream;
      setIsMediaReady(true);
      
      stream.getAudioTracks().forEach(track => {
        track.enabled = false; // Initially muted
      });
      
    } catch (err) {
      console.error('Failed to get local audio', err);
    }
  }, []);

  const createPeerConnection = useCallback((targetUserId: string) => {
    if (peerConnections.current[targetUserId]) return peerConnections.current[targetUserId];

    const pc = new RTCPeerConnection(config);
    peerConnections.current[targetUserId] = pc;

    if (localStream.current) {
      localStream.current.getTracks().forEach(track => pc.addTrack(track, localStream.current!));
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('webrtc_ice_candidate', {
          targetUserId,
          lobbyId,
          candidate: event.candidate
        });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStreams(prev => ({
        ...prev,
        [targetUserId]: event.streams[0]
      }));
    };

    return pc;
  }, [lobbyId, socket]);

  // Handle incoming WEBRTC signaling
  const handleOffer = useCallback(async ({ senderId, offer }: any) => {
    const pc = createPeerConnection(senderId);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    
    if (socket) {
      socket.emit('webrtc_answer', {
        targetUserId: senderId,
        lobbyId,
        answer
      });
    }
  }, [createPeerConnection, socket, lobbyId]);

  const handleAnswer = useCallback(async ({ senderId, answer }: any) => {
    const pc = peerConnections.current[senderId];
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
  }, []);

  const handleIceCandidate = useCallback(async ({ senderId, candidate }: any) => {
    const pc = peerConnections.current[senderId];
    if (pc && candidate) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
    }
  }, []);

  useRealtimeEvent('webrtc_offer', handleOffer);
  useRealtimeEvent('webrtc_answer', handleAnswer);
  useRealtimeEvent('webrtc_ice_candidate', handleIceCandidate);

  // Whenever a new user is detected in the lobby, we should initiate an offer to them
  // To avoid duplicate connections, the user with lower ID can act as the initiator
  const initiateConnection = useCallback(async (targetUserId: string) => {
    if (currentUserId > targetUserId) return; // Wait for them to initiate
    
    const pc = createPeerConnection(targetUserId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    if (socket) {
      socket.emit('webrtc_offer', {
        targetUserId,
        lobbyId,
        offer
      });
    }
  }, [currentUserId, lobbyId, socket, createPeerConnection]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const newMutedState = !prev;
      if (localStream.current) {
        localStream.current.getAudioTracks().forEach(track => {
          track.enabled = !newMutedState;
        });
      }
      return newMutedState;
    });
  }, []);

  const toggleDeafen = () => {
    setIsDeafened(!isDeafened);
  };

  useEffect(() => {
    getMedia();
    return () => {
      // Cleanup streams and connections
      if (localStream.current) {
        localStream.current.getTracks().forEach(track => track.stop());
      }
      Object.values(peerConnections.current).forEach(pc => pc.close());
    };
  }, [getMedia]);

  return {
    isMuted,
    isDeafened,
    toggleMute,
    toggleDeafen,
    remoteStreams,
    initiateConnection,
    isMediaReady,
    localStream: localStream.current
  };
}
