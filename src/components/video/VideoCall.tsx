import { useWebRTC } from '@/hooks/useWebRTC';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Video, VideoOff, PhoneOff, VideoIcon, Loader2, ShieldCheck } from 'lucide-react';
import { useEffect, useState, useCallback, useRef } from 'react';

interface VideoCallProps {
  currentUserId: string;
  remoteUserId: string;
  callSessionId: string;
  isCaller: boolean;
  remoteName: string;
  remoteInstitution?: string;
  onEnd: () => void;
}

export function VideoCall({
  currentUserId,
  remoteUserId,
  callSessionId,
  isCaller,
  remoteName,
  remoteInstitution,
  onEnd,
}: VideoCallProps) {
  const [mediaReady, setMediaReady] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  // Note: Ensure your useWebRTC hook returns these exact values
  const {
    callStatus,
    isMuted,
    isCameraOff,
    localVideoRef,
    remoteVideoRef,
    startCall,
    answerCall,
    endCall,
    toggleMute,
    toggleCamera,
    requestMedia,
    localStream,
  } = useWebRTC({ currentUserId, remoteUserId, callSessionId, isCaller });

  // 1. ATTACH LOCAL STREAM (With safety check)
  useEffect(() => {
    const localVideo = localVideoRef.current;
    if (localVideo && localStream) {
      localVideo.srcObject = localStream;
      localVideo.play().catch((err) => console.warn("Video play interrupted:", err));
    }
  }, [localStream, localVideoRef]);

  const handleConnect = useCallback(async () => {
    try {
      setMediaError(null);
      await requestMedia();
      setMediaReady(true);
    } catch (err: any) {
      setMediaError(err?.message || 'Camera/Mic access denied.');
    }
  }, [requestMedia]);

  // 2. SIGNALING INITIATION
  useEffect(() => {
    if (!mediaReady) return;
    if (isCaller) {
      startCall();
    } else {
      answerCall();
    }
  }, [mediaReady, isCaller, startCall, answerCall]);

  // 3. AUTO-CLOSE ON END
  useEffect(() => {
    if (callStatus === 'ended') {
      onEnd();
    }
  }, [callStatus, onEnd]);

  const handleEndCall = async () => {
    await endCall();
    onEnd();
  };

  // UI: Permissions / Pre-call Screen
  if (!mediaReady) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mb-6 ring-4 ring-primary/10">
          <ShieldCheck className="h-10 w-10 text-primary" />
        </div>
        <h2 className="text-2xl font-bold mb-2">{remoteName}</h2>
        <p className="text-slate-400 mb-8 max-w-xs">
          Grant camera and microphone permissions to join the call.
        </p>
        <div className="flex flex-col w-full max-w-xs gap-3">
          <Button onClick={handleConnect} size="lg" className="h-14 text-lg font-bold rounded-2xl shadow-lg">
            Connect Now
          </Button>
          <Button variant="ghost" onClick={onEnd} className="text-slate-500">Cancel</Button>
        </div>
        {mediaError && <p className="mt-4 text-red-400 text-sm">{mediaError}</p>}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black overflow-hidden select-none">
      
      {/* REMOTE VIDEO (Background) */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* TOP HEADER (Name & Status) */}
      <div className="absolute top-0 inset-x-0 p-8 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
        <h2 className="text-white text-xl font-bold">{remoteName}</h2>
        <div className="flex items-center gap-2 mt-1">
          <div className={`w-2 h-2 rounded-full ${callStatus === 'accepted' ? 'bg-green-500 animate-pulse' : 'bg-orange-500'}`} />
          <span className="text-xs font-bold text-white/80 uppercase tracking-tighter">
            {callStatus === 'accepted' ? 'Live' : 'Connecting...'}
          </span>
        </div>
      </div>

      {/* LOCAL PREVIEW (Floating Corner) */}
      <div className="absolute top-8 right-8 w-28 h-40 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl z-50 bg-slate-900 shadow-black/50">
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover -scale-x-100"
        />
        {isCameraOff && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
            <VideoOff className="h-6 w-6 text-slate-500" />
          </div>
        )}
      </div>

      {/* LOADING STATE */}
      {callStatus !== 'accepted' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="text-center">
            <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto mb-4" />
            <p className="text-white font-medium">Establishing secure connection...</p>
          </div>
        </div>
      )}

      {/* CALL CONTROLS */}
      <div className="absolute bottom-12 inset-x-0 flex justify-center items-center gap-6 px-6 z-50">
        <Button
          variant="outline"
          onClick={toggleMute}
          className={`h-14 w-14 rounded-full border-none backdrop-blur-xl ${isMuted ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
        >
          {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </Button>

        <Button
          onClick={handleEndCall}
          className="h-16 w-16 rounded-full bg-red-600 hover:bg-red-700 shadow-xl transition-transform active:scale-90"
        >
          <PhoneOff className="h-8 w-8 text-white" />
        </Button>

        <Button
          variant="outline"
          onClick={toggleCamera}
          className={`h-14 w-14 rounded-full border-none backdrop-blur-xl ${isCameraOff ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
        >
          {isCameraOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
        </Button>
      </div>
    </div>
  );
}