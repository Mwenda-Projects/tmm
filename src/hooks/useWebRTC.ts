import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

// ─── ICE / STUN ───────────────────────────────────────────────────────────────
// Added more STUN servers + a public TURN fallback for networks that block
// peer-to-peer UDP (common on mobile data / campus networks in Kenya).
const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    // Free open TURN — replace with your own Twilio/Metered TURN for production
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
  iceCandidatePoolSize: 10,
};

export type CallStatus = 'idle' | 'ringing' | 'accepted' | 'ended';

interface UseWebRTCOptions {
  currentUserId: string;
  remoteUserId: string;
  callSessionId: string | null;
  isCaller: boolean;
}

export function useWebRTC({
  currentUserId,
  remoteUserId,
  callSessionId,
  isCaller,
}: UseWebRTCOptions) {
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
  // Tracks whether we've already processed an offer (prevents double-answer bug)
  const offerHandledRef = useRef(false);

  // ─── Cleanup ───────────────────────────────────────────────────────────────

  const cleanup = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);

    if (pcRef.current) {
      pcRef.current.ontrack = null;
      pcRef.current.onicecandidate = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    offerHandledRef.current = false;
    setRemoteStream(null);
    setCallStatus('ended');
  }, []);

  // ─── Get local camera + mic ────────────────────────────────────────────────
  // KEY FIX for the bleeping/echo sound:
  //   echoCancellation, noiseSuppression, autoGainControl are all set to true.
  //   Without these, the mic picks up audio from the speaker and feeds it back,
  //   creating the escalating bleep you were hearing.
  //
  // KEY FIX for the camera zoom:
  //   facingMode: 'user' selects the front camera on phones (not the wide-angle
  //   ultra-wide which some phones default to and which zooms in oddly).
  //   width/height ideals are now 1280×720 for better quality.

  const getLocalStream = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',          // front camera on phones
          width:  { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 24, max: 30 },
        },
        audio: {
          echoCancellation: true,      // ← FIXES the bleeping/echo
          noiseSuppression: true,      // ← Removes background hum
          autoGainControl: true,       // ← Prevents volume escalation
          sampleRate: 48000,
        },
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        // Mute local video element — we NEVER want to hear our own voice back
        localVideoRef.current.muted = true;
        localVideoRef.current.volume = 0;
      }
      return stream;
    } catch (err) {
      console.error('Camera/mic error:', err);
      // Fallback: try audio-only if camera fails
      try {
        const audioOnly = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        localStreamRef.current = audioOnly;
        setLocalStream(audioOnly);
        return audioOnly;
      } catch {
        return null;
      }
    }
  }, []);

  // ─── Peer connection setup ─────────────────────────────────────────────────

  const setupPeerConnection = useCallback(
    (stream: MediaStream, channel: any) => {
      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;

      // Add all local tracks to the peer connection
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // Send ICE candidates to the remote peer via Supabase Realtime
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          channel.send({
            type: 'broadcast',
            event: 'ice-candidate',
            payload: { candidate: e.candidate.toJSON(), from: currentUserId },
          });
        }
      };

      // When remote tracks arrive, attach to the remote video element
      pc.ontrack = (e) => {
        if (e.streams[0]) {
          setRemoteStream(e.streams[0]);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = e.streams[0];
            // Remote video should have audio ON (we want to hear them)
            remoteVideoRef.current.muted = false;
          }
        }
      };

      // Detect dropped connections and clean up
      pc.onconnectionstatechange = () => {
        if (
          pc.connectionState === 'failed' ||
          pc.connectionState === 'disconnected' ||
          pc.connectionState === 'closed'
        ) {
          setCallStatus('ended');
        }
      };

      return pc;
    },
    [currentUserId],
  );

  // ─── Caller: create offer ──────────────────────────────────────────────────

  const startCall = useCallback(async () => {
    if (!callSessionId) return;
    setCallStatus('ringing');

    const stream = await getLocalStream();
    if (!stream) return;

    const channel = supabase.channel(`call-${callSessionId}`);
    channelRef.current = channel;
    const pc = setupPeerConnection(stream, channel);

    channel
      .on('broadcast', { event: 'answer' }, async ({ payload }: any) => {
        if (payload.from !== remoteUserId) return;
        if (pc.signalingState !== 'have-local-offer') return; // guard double-answer
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
          setCallStatus('accepted');
        } catch (err) {
          console.error('setRemoteDescription (answer) failed:', err);
        }
      })
      .on('broadcast', { event: 'ice-candidate' }, async ({ payload }: any) => {
        if (payload.from !== remoteUserId || !payload.candidate) return;
        try {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        } catch { /* ignore — harmless stale candidates */ }
      })
      .on('broadcast', { event: 'hangup' }, () => cleanup())
      .subscribe(async (status: string) => {
        if (status !== 'SUBSCRIBED') return;
        // Small delay so the callee has time to subscribe before offer arrives
        setTimeout(async () => {
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            channel.send({
              type: 'broadcast',
              event: 'offer',
              payload: { offer, from: currentUserId },
            });
          } catch (err) {
            console.error('createOffer failed:', err);
          }
        }, 1200);
      });
  }, [callSessionId, getLocalStream, setupPeerConnection, remoteUserId, currentUserId, cleanup]);

  // ─── Callee: answer offer ──────────────────────────────────────────────────

  const answerCall = useCallback(async () => {
    if (!callSessionId) return;

    const stream = await getLocalStream();
    if (!stream) return;

    await supabase
      .from('call_sessions')
      .update({ status: 'accepted' } as any)
      .eq('id', callSessionId);

    setCallStatus('accepted');

    const channel = supabase.channel(`call-${callSessionId}`);
    channelRef.current = channel;
    const pc = setupPeerConnection(stream, channel);

    channel
      .on('broadcast', { event: 'offer' }, async ({ payload }: any) => {
        if (payload.from !== remoteUserId) return;
        // Prevent handling the same offer twice (Supabase can re-deliver)
        if (offerHandledRef.current) return;
        offerHandledRef.current = true;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          channel.send({
            type: 'broadcast',
            event: 'answer',
            payload: { answer, from: currentUserId },
          });
        } catch (err) {
          console.error('answerCall signalling failed:', err);
          offerHandledRef.current = false; // allow retry
        }
      })
      .on('broadcast', { event: 'ice-candidate' }, async ({ payload }: any) => {
        if (payload.from !== remoteUserId || !payload.candidate) return;
        try {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        } catch { /* ignore */ }
      })
      .on('broadcast', { event: 'hangup' }, () => cleanup())
      .subscribe();
  }, [callSessionId, getLocalStream, setupPeerConnection, remoteUserId, currentUserId, cleanup]);

  // ─── Controls ─────────────────────────────────────────────────────────────

  const toggleMute = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setIsMuted(!track.enabled);
    }
  }, []);

  const toggleCamera = useCallback(() => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setIsCameraOff(!track.enabled);
    }
  }, []);

  const endCall = useCallback(async () => {
    if (callSessionId) {
      await supabase
        .from('call_sessions')
        .update({ status: 'ended' } as any)
        .eq('id', callSessionId);
      channelRef.current?.send({
        type: 'broadcast',
        event: 'hangup',
        payload: { from: currentUserId },
      });
    }
    cleanup();
  }, [callSessionId, currentUserId, cleanup]);

  // Cleanup on unmount
  useEffect(() => () => cleanup(), [cleanup]);

  return {
    callStatus,
    isMuted,
    isCameraOff,
    localStream,
    remoteStream,
    localVideoRef,
    remoteVideoRef,
    startCall,
    answerCall,
    endCall,
    toggleMute,
    toggleCamera,
    requestMedia: getLocalStream,
  };
}