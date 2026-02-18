import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
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
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const channelRef = useRef<any>(null);

  const cleanup = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    setRemoteStream(null);
    setCallStatus('ended');
  }, []);

  const getLocalStream = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: { ideal: 640 }, height: { ideal: 480 } }, 
        audio: true 
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      return stream;
    } catch (err) {
      console.error("Camera error:", err);
      return null;
    }
  }, []);

  const setupPeerConnection = useCallback((stream: MediaStream, channel: any) => {
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
      if (e.streams[0]) {
        setRemoteStream(e.streams[0]);
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
      }
    };

    return pc;
  }, [currentUserId]);

  const startCall = useCallback(async () => {
    if (!callSessionId) return;
    setCallStatus('ringing');
    const stream = await getLocalStream();
    if (!stream) return;

    const channel = supabase.channel(`call-${callSessionId}`);
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
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(() => {});
        }
      })
      .on('broadcast', { event: 'hangup' }, () => cleanup())
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // WAIT for 1 second to make sure receiver is ready
          setTimeout(async () => {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            channel.send({ type: 'broadcast', event: 'offer', payload: { offer, from: currentUserId } });
          }, 1000);
        }
      });
  }, [callSessionId, getLocalStream, setupPeerConnection, remoteUserId, currentUserId, cleanup]);

  const answerCall = useCallback(async () => {
    if (!callSessionId) return;
    const stream = await getLocalStream();
    if (!stream) return;

    // This UPDATE works now because of your SQL fix
    await supabase.from('call_sessions').update({ status: 'accepted' } as any).eq('id', callSessionId);
    setCallStatus('accepted');

    const channel = supabase.channel(`call-${callSessionId}`);
    channelRef.current = channel;
    const pc = setupPeerConnection(stream, channel);

    channel
      .on('broadcast', { event: 'offer' }, async ({ payload }) => {
        if (payload.from === remoteUserId) {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          channel.send({ type: 'broadcast', event: 'answer', payload: { answer, from: currentUserId } });
        }
      })
      .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
        if (payload.from === remoteUserId && payload.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(() => {});
        }
      })
      .on('broadcast', { event: 'hangup' }, () => cleanup())
      .subscribe();
  }, [callSessionId, getLocalStream, setupPeerConnection, remoteUserId, currentUserId, cleanup]);

  const toggleMute = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; setIsMuted(!track.enabled); }
  };

  const toggleCamera = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) { track.enabled = !track.enabled; setIsCameraOff(!track.enabled); }
  };

  const endCall = useCallback(async () => {
    if (callSessionId) {
      await supabase.from('call_sessions').update({ status: 'ended' } as any).eq('id', callSessionId);
      channelRef.current?.send({ type: 'broadcast', event: 'hangup', payload: { from: currentUserId } });
    }
    cleanup();
  }, [callSessionId, currentUserId, cleanup]);

  useEffect(() => { return () => cleanup(); }, [cleanup]);

  return { callStatus, isMuted, isCameraOff, localStream, remoteStream, localVideoRef, remoteVideoRef, startCall, answerCall, endCall, toggleMute, toggleCamera, requestMedia: getLocalStream };
}