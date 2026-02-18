import { useWebRTC } from '@/hooks/useWebRTC';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Video, VideoOff, PhoneOff, VideoIcon } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';

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
  } = useWebRTC({ currentUserId, remoteUserId, callSessionId, isCaller });

  // CRITICAL: Request media from a direct user click, not useEffect
  const handleConnect = useCallback(async () => {
    try {
      setMediaError(null);
      await requestMedia();
      setMediaReady(true);
    } catch (err) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setMediaError('Camera and microphone access denied. Please check your browser permissions.');
      } else {
        setMediaError('Failed to access camera/microphone. Please try again.');
      }
    }
  }, [requestMedia]);

  // Once media is ready, start or answer the call
  useEffect(() => {
    if (!mediaReady) return;
    if (isCaller) {
      startCall();
    } else {
      answerCall();
    }
  }, [mediaReady, isCaller, startCall, answerCall]);

  useEffect(() => {
    if (callStatus === 'ended') {
      onEnd();
    }
  }, [callStatus, onEnd]);

  const handleEndCall = async () => {
    await endCall();
    onEnd();
  };

  // Pre-connect screen: ask user to grant permissions via a click
  if (!mediaReady) {
    return (
      <div className="fixed inset-0 z-50 bg-background/95 flex flex-col items-center justify-center gap-6">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold text-foreground">{remoteName}</h2>
          {remoteInstitution && (
            <p className="text-sm text-muted-foreground">{remoteInstitution}</p>
          )}
          <p className="text-sm text-muted-foreground mt-4">
            Click below to allow camera &amp; microphone access and connect.
          </p>
        </div>

        {mediaError && (
          <p className="text-sm text-destructive max-w-xs text-center">{mediaError}</p>
        )}

        <div className="flex gap-3">
          <Button onClick={handleConnect} size="lg" className="gap-2">
            <VideoIcon className="h-5 w-5" /> Connect
          </Button>
          <Button variant="outline" size="lg" onClick={onEnd}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/95 flex flex-col items-center justify-center gap-4">
      {/* Remote info */}
      <div className="text-center mb-2">
        <h2 className="text-xl font-semibold text-foreground">{remoteName}</h2>
        {remoteInstitution && (
          <p className="text-sm text-muted-foreground">{remoteInstitution}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1 capitalize">{callStatus}</p>
      </div>

      {/* Video streams */}
      <div className="relative w-full max-w-3xl aspect-video bg-muted rounded-lg overflow-hidden">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="absolute bottom-3 right-3 w-36 h-28 rounded-lg object-cover border-2 border-border bg-muted"
        />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <Button
          variant={isMuted ? 'destructive' : 'secondary'}
          size="icon"
          onClick={toggleMute}
          className="rounded-full h-12 w-12"
        >
          {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </Button>
        <Button
          variant={isCameraOff ? 'destructive' : 'secondary'}
          size="icon"
          onClick={toggleCamera}
          className="rounded-full h-12 w-12"
        >
          {isCameraOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
        </Button>
        <Button
          variant="destructive"
          size="icon"
          onClick={handleEndCall}
          className="rounded-full h-14 w-14"
        >
          <PhoneOff className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
}
