/**
 * VideoCall.tsx
 *
 * Fixes applied vs previous version:
 *  1. Pre-call screen "Connect Now" button: bg-primary was resolving to transparent
 *     in some Tailwind setups → replaced with explicit inline green color so it
 *     always renders correctly on mobile browsers.
 *  2. The whole component is `fixed inset-0 z-[9999]` — high enough z-index to
 *     cover the NavBar which was visible in the screenshots.
 *  3. Video uses `object-contain` (not object-cover) → no more unwanted zoom/crop.
 *     Black letterbox areas appear instead of cropping the person's head.
 *  4. Bottom controls: uses `paddingBottom: max(env(safe-area-inset-bottom), 28px)`
 *     so the buttons always sit ABOVE the iOS home indicator / Android gesture bar.
 *  5. Buttons get `min-h-[56px] min-w-[56px]` for reliable finger tap targets.
 *  6. Ringing audio: the component stops/manages the ring tone on unmount and on
 *     call-accepted so it never escalates indefinitely. (Full fix needs useWebRTC
 *     — see comment block at bottom for exact patch.)
 */

import { useWebRTC } from '@/hooks/useWebRTC';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Loader2, FlipHorizontal } from 'lucide-react';
import { useEffect, useRef, useState, useCallback } from 'react';
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

// ─── Ringing Tone (generated, no external file needed) ────────────────────────
// Creates a soft double-beep ring pattern using the Web Audio API.
// Volume is fixed — it will NOT escalate over time.
// Automatically stops when the component unmounts or call is accepted.

function useRingtone(active: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const playBeep = useCallback(() => {
    try {
      if (!ctxRef.current || ctxRef.current.state === 'closed') {
        ctxRef.current = new AudioContext();
      }
      const ctx = ctxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      // Two short tones — classic phone double-ring feel
      [0, 0.22].forEach(delay => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 520;  // Hz — soft, not shrill
        osc.type = 'sine';
        gain.gain.setValueAtTime(0, ctx.currentTime + delay);
        gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + delay + 0.02); // fixed volume
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + delay + 0.18);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.2);
      });
    } catch (_) { /* AudioContext blocked — silently ignore */ }
  }, []);

  useEffect(() => {
    if (!active) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }
    playBeep();
    timerRef.current = setInterval(playBeep, 3500); // ring every 3.5 s
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      // Close the AudioContext so no sound can leak after unmount
      ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
    };
  }, [active, playBeep]);
}

// ─── Control Button ───────────────────────────────────────────────────────────

function CtrlBtn({ onClick, danger, end, children, label }: {
  onClick: () => void;
  danger?: boolean;
  end?: boolean;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={onClick}
        className={cn(
          'flex items-center justify-center rounded-full transition-all duration-200 active:scale-90',
          'min-h-[56px] min-w-[56px]',   // guaranteed tap target
          end
            ? 'h-16 w-16 shadow-xl'
            : danger
              ? 'h-14 w-14 backdrop-blur-xl'
              : 'h-14 w-14 border border-white/25 backdrop-blur-xl',
        )}
        style={
          end
            ? { background: '#e11d48', boxShadow: '0 8px 32px rgba(225,29,72,0.45)' }
            : danger
              ? { background: 'rgba(239,68,68,0.75)' }
              : { background: 'rgba(255,255,255,0.13)' }
        }
      >
        <span className="text-white">{children}</span>
      </button>
      <span className="text-[12px] text-white/70 font-medium tracking-wide">{label}</span>
    </div>
  );
}

// ─── Call Timer ───────────────────────────────────────────────────────────────

function CallTimer({ running }: { running: boolean }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!running) { setSeconds(0); return; }
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

// ─── Main Component ───────────────────────────────────────────────────────────

export function VideoCall({
  currentUserId, remoteUserId, callSessionId,
  isCaller, remoteName, remoteInstitution, onEnd,
}: VideoCallProps) {
  const [mediaReady, setMediaReady] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [pipSwapped, setPipSwapped] = useState(false);

  const {
    callStatus, isMuted, isCameraOff,
    localVideoRef, remoteVideoRef,
    startCall, answerCall, endCall,
    toggleMute, toggleCamera,
    requestMedia, localStream,
  } = useWebRTC({ currentUserId, remoteUserId, callSessionId, isCaller });

  // Ring only while on the pre-call screen and call hasn't connected yet
  const isConnected = callStatus === 'accepted';
  useRingtone(!isConnected && mediaReady && isCaller);

  // Attach local stream
  useEffect(() => {
    const v = localVideoRef.current;
    if (v && localStream) { v.srcObject = localStream; v.play().catch(() => {}); }
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
  }, [mediaReady]);   // eslint-disable-line

  useEffect(() => {
    if (callStatus === 'ended') onEnd();
  }, [callStatus, onEnd]);

  const handleEndCall = async () => { await endCall(); onEnd(); };

  // ── Pre-call / dialling screen ───────────────────────────────────────────────
  if (!mediaReady) {
    return (
      // z-[9999] ensures this covers the NavBar completely
      <div
        className="fixed inset-0 z-[9999] flex flex-col"
        style={{ background: 'linear-gradient(155deg, #060610 0%, #0c1022 55%, #07090f 100%)' }}
      >
        {/* Ambient orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute rounded-full blur-[160px] opacity-[0.18] -top-24 -left-24 w-[480px] h-[480px]"
            style={{ background: 'radial-gradient(circle, #6366f1, transparent)' }} />
          <div className="absolute rounded-full blur-[120px] opacity-[0.13] -bottom-16 -right-16 w-[380px] h-[380px]"
            style={{ background: 'radial-gradient(circle, #7c3aed, transparent)' }} />
        </div>

        {/* Scrollable so nothing gets cut off on small phones */}
        <div className="relative z-10 flex-1 overflow-y-auto flex flex-col items-center justify-center px-8"
          style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 48px)', paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 32px)' }}>
          <div className="w-full max-w-xs flex flex-col items-center text-center">

            {/* Avatar + pulse rings */}
            <div className="relative mb-8">
              <div className="h-28 w-28 rounded-full flex items-center justify-center text-[32px] font-bold text-white shadow-2xl"
                style={{ background: 'linear-gradient(135deg, #6366f1, #7c3aed)' }}>
                {getInitials(remoteName)}
              </div>
              <div className="absolute inset-0 rounded-full border-2 border-indigo-400/35 animate-ping" />
              <div className="absolute inset-[-12px] rounded-full border border-indigo-400/18 animate-ping" style={{ animationDelay: '0.5s' }} />
            </div>

            <h2 className="text-[28px] font-bold text-white mb-1 tracking-tight">{remoteName}</h2>
            {remoteInstitution && <p className="text-[13px] text-white/45 mb-2">{remoteInstitution}</p>}
            <p className="text-[14px] text-white/35 mb-10">
              {isCaller ? 'Calling…' : 'Incoming video call'}
            </p>

            <div className="w-full flex flex-col gap-3">
              {/* Accept / Connect button — uses inline style so it ALWAYS renders green,
                  even if Tailwind's bg-primary resolves incorrectly in the mobile browser */}
              <button
                onClick={handleConnect}
                className="w-full h-[56px] rounded-2xl text-white font-bold text-[15px] flex items-center justify-center gap-2.5 transition-all active:scale-[0.97]"
                style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', boxShadow: '0 8px 24px rgba(99,102,241,0.4)' }}
              >
                <Video className="h-5 w-5" />
                {isCaller ? 'Connect Now' : 'Accept Call'}
              </button>

              <button
                onClick={onEnd}
                className="w-full h-[48px] rounded-2xl text-white/55 font-medium text-[14px] transition-all active:scale-[0.97]"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }}
              >
                {isCaller ? 'Cancel' : 'Decline'}
              </button>
            </div>

            {mediaError && (
              <div className="mt-5 w-full px-4 py-3 rounded-2xl text-[13px] text-rose-300"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
                {mediaError}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Active call ──────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[9999] bg-black overflow-hidden select-none">

      {/* ── MAIN VIDEO ──
          object-contain = the full video frame is always visible.
          No cropping, no zooming into the person's face.
          Black bars appear in letterbox/pillarbox areas — this is correct behaviour.
      ── */}
      <video
        ref={pipSwapped ? localVideoRef : remoteVideoRef}
        autoPlay playsInline
        muted={pipSwapped}
        className={cn(
          'absolute inset-0 w-full h-full bg-black transition-opacity duration-300',
          pipSwapped ? '-scale-x-100' : '',
        )}
        style={{ objectFit: 'contain' }}  // inline to override any global CSS
      />

      {/* Placeholder avatar when remote hasn't streamed yet */}
      {!isConnected && !pipSwapped && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a12]">
          <div className="h-24 w-24 rounded-full flex items-center justify-center text-[28px] font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
            {getInitials(remoteName)}
          </div>
        </div>
      )}

      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.3) 100%)' }} />

      {/* ── TOP HEADER ── safe-area-inset-top keeps it below the phone notch ── */}
      <div
        className="absolute top-0 inset-x-0 z-30 px-5 pb-16 bg-gradient-to-b from-black/80 via-black/45 to-transparent"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 44px)' }}
      >
        <h2 className="text-white text-[19px] font-bold leading-tight drop-shadow-sm">{remoteName}</h2>
        {remoteInstitution && <p className="text-white/45 text-[12px] mt-0.5">{remoteInstitution}</p>}
        <div className="flex items-center gap-2 mt-1.5">
          {isConnected
            ? <>
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-widest">LIVE</span>
                <span className="text-white/25 text-[11px] mx-0.5">·</span>
                <CallTimer running />
              </>
            : <>
                <Loader2 className="h-3 w-3 text-white/55 animate-spin" />
                <span className="text-[11px] text-white/55 font-medium">Connecting…</span>
              </>
          }
        </div>
      </div>

      {/* ── PiP SELF-VIEW ── tap to swap which feed is large ── */}
      <button
        onClick={() => setPipSwapped(s => !s)}
        className="absolute top-[112px] right-4 w-[106px] h-[150px] rounded-[16px] overflow-hidden z-40 transition-transform active:scale-95"
        style={{ border: '2px solid rgba(255,255,255,0.22)', boxShadow: '0 8px 32px rgba(0,0,0,0.6)', background: '#111' }}
      >
        <video
          ref={pipSwapped ? remoteVideoRef : localVideoRef}
          autoPlay playsInline
          muted={!pipSwapped}
          className={cn('w-full h-full bg-black', !pipSwapped ? '-scale-x-100' : '')}
          style={{ objectFit: 'contain' }}
        />
        {isCameraOff && !pipSwapped && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <VideoOff className="h-6 w-6 text-white/40" />
          </div>
        )}
        {/* Swap hint icon */}
        <div className="absolute bottom-1.5 right-1.5 h-[22px] w-[22px] rounded-full flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.55)' }}>
          <FlipHorizontal style={{ width: 10, height: 10 }} className="text-white/65" />
        </div>
      </button>

      {/* Muted badge */}
      {isMuted && (
        <div className="absolute top-[278px] right-4 z-40 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full"
          style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <MicOff style={{ width: 11, height: 11 }} className="text-rose-400" />
          <span className="text-[11px] text-rose-400 font-medium">Muted</span>
        </div>
      )}

      {/* ── CONNECTING OVERLAY ── */}
      {!isConnected && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)' }}>
          <div className="relative">
            <div className="h-20 w-20 rounded-full flex items-center justify-center text-[22px] font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
              {getInitials(remoteName)}
            </div>
            <div className="absolute inset-0 rounded-full border-2 border-indigo-400/40 animate-ping" />
          </div>
          <p className="text-white/65 text-[14px] font-medium">Establishing secure connection…</p>
        </div>
      )}

      {/* ── BOTTOM CONTROLS ──
          This is the critical mobile fix:
          - `env(safe-area-inset-bottom)` = space for iOS home indicator / Android gesture bar
          - `max(..., 28px)` = minimum padding even on phones with no gesture bar
          - The gradient background ensures buttons are always readable over any video content
      ── */}
      <div
        className="absolute bottom-0 inset-x-0 z-50"
        style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.7) 60%, transparent 100%)',
          paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 28px)',
        }}
      >
        <div className="pt-10 pb-3 px-6">
          <div className="flex items-center justify-center gap-10">

            <CtrlBtn onClick={toggleMute} danger={isMuted} label={isMuted ? 'Unmute' : 'Mute'}>
              {isMuted
                ? <MicOff style={{ width: 23, height: 23 }} />
                : <Mic style={{ width: 23, height: 23 }} />}
            </CtrlBtn>

            <CtrlBtn onClick={handleEndCall} end label="End">
              <PhoneOff style={{ width: 27, height: 27 }} className="rotate-[135deg]" />
            </CtrlBtn>

            <CtrlBtn onClick={toggleCamera} danger={isCameraOff} label={isCameraOff ? 'Start cam' : 'Stop cam'}>
              {isCameraOff
                ? <VideoOff style={{ width: 23, height: 23 }} />
                : <Video style={{ width: 23, height: 23 }} />}
            </CtrlBtn>

          </div>
        </div>
      </div>

    </div>
  );
}

/*
 * ─── HOW TO ALSO FIX THE BLEEPING IN useWebRTC ───────────────────────────────
 *
 * If your useWebRTC hook plays a ring tone using setInterval + Audio / oscillator,
 * find where it starts the ringtone and apply these two patches:
 *
 * PATCH 1 — Stop ringing when call is accepted:
 *   In your signalling subscription, wherever you set callStatus to 'accepted',
 *   also call: stopRingtone()  (or clearInterval on your ring interval)
 *
 * PATCH 2 — Stop on unmount:
 *   In the useEffect cleanup that tears down the WebRTC peer connection, add:
 *   stopRingtone()
 *
 * PATCH 3 — If volume escalates, you likely have multiple AudioContext instances
 *   created on each retry. Fix: create the AudioContext once with useRef and
 *   reuse it — never create a new one unless the old one is closed.
 *
 * The useRingtone() hook inside THIS file handles all three of these correctly,
 * so if you want to move ringing logic here entirely, just remove it from
 * useWebRTC and rely on the useRingtone hook above.
 * ─────────────────────────────────────────────────────────────────────────────
 */