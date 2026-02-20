import { useWebRTC } from '@/hooks/useWebRTC';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Loader2, ShieldCheck, FlipHorizontal } from 'lucide-react';
import { useEffect, useState, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';

interface VideoCallProps {
  currentUserId: string;
  remoteUserId: string;
  callSessionId: string;
  isCaller: boolean;
  remoteName: string;
  remoteInstitution?: string;
  onEnd: () => void;
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// ─── Control Button ───────────────────────────────────────────────────────────

function CtrlBtn({ onClick, active, danger, end, children, label }: {
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  end?: boolean;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button onClick={onClick}
        className={cn(
          'flex items-center justify-center rounded-full transition-all duration-200 active:scale-90',
          end
            ? 'h-16 w-16 bg-rose-600 hover:bg-rose-500 shadow-xl shadow-rose-900/50'
            : danger
              ? 'h-14 w-14 bg-rose-500/80 backdrop-blur-xl hover:bg-rose-500'
              : active
                ? 'h-14 w-14 bg-white/90 backdrop-blur-xl hover:bg-white'
                : 'h-14 w-14 bg-white/15 backdrop-blur-xl hover:bg-white/25 border border-white/20',
        )}>
        <span className={cn(
          end ? 'text-white' : danger ? 'text-white' : active ? 'text-foreground' : 'text-white',
        )}>
          {children}
        </span>
      </button>
      <span className="text-[11px] text-white/60 font-medium">{label}</span>
    </div>
  );
}

// ─── Call Timer ───────────────────────────────────────────────────────────────

function CallTimer({ running }: { running: boolean }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (!running) return null;
  return (
    <span className="text-[13px] text-white/70 font-mono tabular-nums">
      {h > 0 ? `${pad(h)}:` : ''}{pad(m)}:{pad(s)}
    </span>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function VideoCall({
  currentUserId, remoteUserId, callSessionId,
  isCaller, remoteName, remoteInstitution, onEnd,
}: VideoCallProps) {
  const [mediaReady, setMediaReady] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [pipSwapped, setPipSwapped] = useState(false); // swap local/remote PiP

  const {
    callStatus, isMuted, isCameraOff,
    localVideoRef, remoteVideoRef,
    startCall, answerCall, endCall,
    toggleMute, toggleCamera,
    requestMedia, localStream,
  } = useWebRTC({ currentUserId, remoteUserId, callSessionId, isCaller });

  // Attach local stream
  useEffect(() => {
    const v = localVideoRef.current;
    if (v && localStream) {
      v.srcObject = localStream;
      v.play().catch(() => {});
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

  useEffect(() => {
    if (!mediaReady) return;
    if (isCaller) startCall(); else answerCall();
  }, [mediaReady, isCaller, startCall, answerCall]);

  useEffect(() => {
    if (callStatus === 'ended') onEnd();
  }, [callStatus, onEnd]);

  const handleEndCall = async () => { await endCall(); onEnd(); };

  const isConnected = callStatus === 'accepted';

  // ── Pre-call permission screen ──
  if (!mediaReady) {
    return (
      <div className="fixed inset-0 z-50 overflow-hidden flex flex-col items-center justify-center"
        style={{ background: 'linear-gradient(145deg, #07070f 0%, #0d1020 60%, #080b18 100%)' }}>

        {/* Orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute rounded-full blur-[140px] opacity-20 top-[-100px] left-[-100px] w-[500px] h-[500px]"
            style={{ background: 'radial-gradient(circle, #6366f1, transparent)' }} />
          <div className="absolute rounded-full blur-[100px] opacity-15 bottom-[-50px] right-[-50px] w-[400px] h-[400px]"
            style={{ background: 'radial-gradient(circle, #8b5cf6, transparent)' }} />
        </div>

        <div className="relative z-10 flex flex-col items-center text-center px-8 max-w-sm">
          {/* Avatar */}
          <div className="relative mb-6">
            <div className="h-24 w-24 rounded-full bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center text-[28px] font-bold text-white shadow-2xl shadow-primary/30">
              {getInitials(remoteName)}
            </div>
            {/* Pulsing rings */}
            <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping" />
            <div className="absolute inset-[-8px] rounded-full border border-primary/15 animate-ping" style={{ animationDelay: '0.3s' }} />
          </div>

          <h2 className="text-[26px] font-bold text-white mb-1">{remoteName}</h2>
          {remoteInstitution && (
            <p className="text-[13px] text-white/50 mb-2">{remoteInstitution}</p>
          )}
          <p className="text-[13px] text-white/40 mb-8">
            {isCaller ? 'Calling…' : 'Incoming video call'}
          </p>

          <div className="w-full space-y-3">
            <button onClick={handleConnect}
              className="w-full h-14 rounded-2xl bg-primary text-white font-bold text-[15px] flex items-center justify-center gap-2 shadow-xl shadow-primary/30 hover:bg-primary/90 transition-all active:scale-[0.98]">
              <Video className="h-5 w-5" />
              {isCaller ? 'Connect Now' : 'Accept Call'}
            </button>
            <button onClick={onEnd}
              className="w-full h-11 rounded-2xl bg-white/[0.06] text-white/60 font-medium text-[14px] hover:bg-white/10 transition-all border border-white/[0.08]">
              {isCaller ? 'Cancel' : 'Decline'}
            </button>
          </div>

          {mediaError && (
            <p className="mt-4 text-rose-400 text-[13px] bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-2">
              {mediaError}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Active call ──
  return (
    <div className="fixed inset-0 z-50 bg-black overflow-hidden select-none">

      {/* ── MAIN VIDEO (remote = full bg, local = full bg if swapped) ── */}
      <video
        ref={pipSwapped ? localVideoRef : remoteVideoRef}
        autoPlay playsInline
        muted={pipSwapped}
        className={cn(
          'absolute inset-0 w-full h-full object-cover transition-opacity duration-300',
          pipSwapped ? '-scale-x-100' : '',
        )}
      />

      {/* Remote video avatar placeholder when no stream */}
      {!isConnected && !pipSwapped && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0d0d12]">
          <div className="h-24 w-24 rounded-full bg-gradient-to-br from-primary to-primary/40 flex items-center justify-center text-[28px] font-bold text-white">
            {getInitials(remoteName)}
          </div>
        </div>
      )}

      {/* Subtle vignette */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.4) 100%)' }} />

      {/* ── TOP HEADER ── */}
      <div className="absolute top-0 inset-x-0 pt-safe-top">
        <div className="px-5 pt-10 pb-16 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-white text-[20px] font-bold leading-tight">{remoteName}</h2>
              {remoteInstitution && (
                <p className="text-white/50 text-[12px] mt-0.5">{remoteInstitution}</p>
              )}
              <div className="flex items-center gap-2 mt-1.5">
                {isConnected
                  ? <>
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">LIVE</span>
                      <span className="text-white/30 text-[11px]">·</span>
                      <CallTimer running={isConnected} />
                    </>
                  : <>
                      <Loader2 className="h-3 w-3 text-white/60 animate-spin" />
                      <span className="text-[11px] text-white/60 font-medium">Connecting…</span>
                    </>
                }
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── PiP (small floating window, tappable to swap) ── */}
      <button
        onClick={() => setPipSwapped(s => !s)}
        className="absolute top-20 right-4 w-[110px] h-[155px] rounded-[18px] overflow-hidden border-2 border-white/20 shadow-2xl shadow-black/60 z-40 bg-[#1a1a2e] transition-transform active:scale-95">
        <video
          ref={pipSwapped ? remoteVideoRef : localVideoRef}
          autoPlay playsInline
          muted={!pipSwapped}
          className={cn('w-full h-full object-cover', !pipSwapped ? '-scale-x-100' : '')}
        />
        {/* Camera off overlay */}
        {isCameraOff && !pipSwapped && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#1a1a2e]">
            <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center">
              <VideoOff className="h-5 w-5 text-white/50" />
            </div>
          </div>
        )}
        {/* Swap hint */}
        <div className="absolute bottom-2 right-2 h-6 w-6 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
          <FlipHorizontal style={{ width: 11, height: 11 }} className="text-white/70" />
        </div>
      </button>

      {/* Mute indicator overlaid on main video */}
      {isMuted && (
        <div className="absolute top-[calc(5rem+160px)] right-4 z-40 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-black/60 backdrop-blur-sm border border-white/10">
          <MicOff style={{ width: 12, height: 12 }} className="text-rose-400" />
          <span className="text-[11px] text-rose-400 font-medium">Muted</span>
        </div>
      )}

      {/* ── CONNECTING OVERLAY ── */}
      {!isConnected && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/30 backdrop-blur-[2px]">
          <div className="relative">
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary to-primary/40 flex items-center justify-center text-[22px] font-bold text-white">
              {getInitials(remoteName)}
            </div>
            <div className="absolute inset-0 rounded-full border-2 border-primary/40 animate-ping" />
          </div>
          <p className="text-white/70 text-[14px] font-medium">Establishing secure connection…</p>
        </div>
      )}

      {/* ── BOTTOM CONTROLS ── */}
      <div className="absolute bottom-0 inset-x-0 pb-safe-bottom">
        <div className="px-8 pt-6 pb-10 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
          <div className="flex items-end justify-center gap-8">

            <CtrlBtn onClick={toggleMute} danger={isMuted} label={isMuted ? 'Unmute' : 'Mute'}>
              {isMuted
                ? <MicOff style={{ width: 22, height: 22 }} />
                : <Mic style={{ width: 22, height: 22 }} />}
            </CtrlBtn>

            <CtrlBtn onClick={handleEndCall} end label="End">
              <PhoneOff style={{ width: 26, height: 26 }} className="rotate-[135deg]" />
            </CtrlBtn>

            <CtrlBtn onClick={toggleCamera} danger={isCameraOff} label={isCameraOff ? 'Start cam' : 'Stop cam'}>
              {isCameraOff
                ? <VideoOff style={{ width: 22, height: 22 }} />
                : <Video style={{ width: 22, height: 22 }} />}
            </CtrlBtn>

          </div>
        </div>
      </div>
    </div>
  );
}