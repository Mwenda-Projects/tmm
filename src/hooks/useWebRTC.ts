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
  // Oppo A18 / budget Android fix:
  // { exact: true } was too strict and caused getUserMedia to fail silently,
  // falling back to raw audio with no processing at all — making echo worse.
  // Back to soft hints (true) which Chrome applies best-effort.
  // The real echo fix is handled by the AudioContext processing chain below.

  const getLocalStream = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width:  { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 24, max: 30 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,             // mono — better echo handling on budget phones
          sampleRate: 48000,
        },
      });

      // ── WebAudio echo suppression pipeline ──────────────────────────────
      // On budget Android devices, browser-level echoCancellation is unreliable.
      // We route the audio through a DynamicsCompressor which aggressively
      // clamps volume spikes (the beeping pattern) before it enters WebRTC.
      try {
        const audioCtx = new AudioContext({ sampleRate: 48000 });
        const source = audioCtx.createMediaStreamSource(stream);
        const compressor = audioCtx.createDynamicsCompressor();
        compressor.threshold.value = -30;  // clamp anything above -30dB
        compressor.knee.value = 10;
        compressor.ratio.value = 12;       // aggressive compression ratio
        compressor.attack.value = 0.003;
        compressor.release.value = 0.1;
        const dest = audioCtx.createMediaStreamDestination();
        source.connect(compressor);
        compressor.connect(dest);
        // Replace raw audio track with compressed one
        const processedTrack = dest.stream.getAudioTracks()[0];
        const videoTracks = stream.getVideoTracks();
        const processedStream = new MediaStream([...videoTracks, processedTrack]);
        localStreamRef.current = processedStream;
        setLocalStream(processedStream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = processedStream;
          localVideoRef.current.muted = true;
          localVideoRef.current.volume = 0;
        }
        return processedStream;
      } catch (audioErr) {
        // AudioContext failed — fall back to raw stream with constraints only
        console.warn('AudioContext pipeline failed, using raw stream:', audioErr);
        localStreamRef.current = stream;
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.muted = true;
          localVideoRef.current.volume = 0;
        }
        return stream;
      }
    } catch (err) {
      console.error('Camera/mic error:', err);
      // Fallback: audio-only if camera fails
      try {
        const audioOnly = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
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
            remoteVideoRef.current.muted = false;
            remoteVideoRef.current.volume = 1.0;
            // Force play — Chrome on Android requires explicit play() call
            // after srcObject is set, otherwise audio silently fails
            remoteVideoRef.current.play().catch(() => {
              // Autoplay blocked — user interaction needed
              // The video will still show; audio resumes on next user tap
            });
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