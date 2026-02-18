import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export type CallStatus = 'idle' | 'ringing' | 'accepted' | 'ended';

interface UseWebRTCOptions {
  currentUserId: string;
  remoteUserId: string;
  callSessionId: string | null;
  isCaller: boolean;
}

export function useWebRTC({ currentUserId, remoteUserId, callSessionId, isCaller }: UseWebRTCOptions) {
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const getLocalStream = useCallback(async () => {
    // If media was already acquired via requestMedia, reuse it
    if (localStreamRef.current) {
      return localStreamRef.current;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localStreamRef.current = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
    return stream;
  }, []);

  // Called directly from a user click handler to satisfy browser gesture requirement
  const requestMedia = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localStreamRef.current = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
    return stream;
  }, []);

  const cleanup = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    setRemoteStream(null);
    setCallStatus('ended');
  }, []);

  const endCall = useCallback(async () => {
    if (callSessionId) {
      await supabase
        .from('call_sessions')
        .update({ status: 'ended' } as any)
        .eq('id', callSessionId);
    }
    cleanup();
  }, [callSessionId, cleanup]);

  const setupPeerConnection = useCallback(
    (stream: MediaStream, channel: ReturnType<typeof supabase.channel>) => {
      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          channel.send({
            type: 'broadcast',
            event: 'ice-candidate',
            payload: { candidate: e.candidate.toJSON(), from: currentUserId },
          });
        }
      };

      pc.ontrack = (e) => {
        const remote = e.streams[0];
        setRemoteStream(remote);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remote;
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
          endCall();
        }
      };

      return pc;
    },
    [currentUserId, endCall]
  );

  const startCall = useCallback(async () => {
    if (!callSessionId) return;
    setCallStatus('ringing');

    const stream = await getLocalStream();
    const channelName = `call-${callSessionId}`;
    const channel = supabase.channel(channelName);
    channelRef.current = channel;

    const pc = setupPeerConnection(stream, channel);

    channel
      .on('broadcast', { event: 'answer' }, async ({ payload }) => {
        if (payload.from === remoteUserId) {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
          setCallStatus('accepted');
        }
      })
      .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
        if (payload.from === remoteUserId && payload.candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
          } catch (e) {
            console.warn('ICE candidate error', e);
          }
        }
      })
      .on('broadcast', { event: 'hangup' }, () => {
        cleanup();
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          channel.send({
            type: 'broadcast',
            event: 'offer',
            payload: { offer, from: currentUserId },
          });
        }
      });
  }, [callSessionId, getLocalStream, setupPeerConnection, remoteUserId, currentUserId, cleanup]);

  const answerCall = useCallback(async () => {
    if (!callSessionId) return;

    await supabase
      .from('call_sessions')
      .update({ status: 'accepted' } as any)
      .eq('id', callSessionId);

    setCallStatus('accepted');
    const stream = await getLocalStream();
    const channelName = `call-${callSessionId}`;
    const channel = supabase.channel(channelName);
    channelRef.current = channel;

    const pc = setupPeerConnection(stream, channel);

    channel
      .on('broadcast', { event: 'offer' }, async ({ payload }) => {
        if (payload.from === remoteUserId) {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          channel.send({
            type: 'broadcast',
            event: 'answer',
            payload: { answer, from: currentUserId },
          });
        }
      })
      .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
        if (payload.from === remoteUserId && payload.candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
          } catch (e) {
            console.warn('ICE candidate error', e);
          }
        }
      })
      .on('broadcast', { event: 'hangup' }, () => {
        cleanup();
      })
      .subscribe();
  }, [callSessionId, getLocalStream, setupPeerConnection, remoteUserId, currentUserId, cleanup]);

  const toggleMute = useCallback(() => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  }, []);

  const toggleCamera = useCallback(() => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsCameraOff(!videoTrack.enabled);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        channelRef.current.send({ type: 'broadcast', event: 'hangup', payload: { from: currentUserId } });
      }
      cleanup();
    };
  }, [cleanup, currentUserId]);

  return {
    callStatus,
    isMuted,
    isCameraOff,
    remoteStream,
    localVideoRef,
    remoteVideoRef,
    startCall,
    answerCall,
    endCall,
    toggleMute,
    toggleCamera,
    requestMedia,
  };
}
