import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { cn } from '@/lib/utils';

interface IncomingCallModalProps {
  callerName: string;
  callerInstitution?: string;
  onAccept: () => void;
  onDecline: () => void;
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function RingingTimer() {
  const [dots, setDots] = useState('');
  useEffect(() => {
    const t = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 600);
    return () => clearInterval(t);
  }, []);
  return <span className="text-white/50 text-[13px]">Ringing{dots}</span>;
}

export function IncomingCallModal({ callerName, callerInstitution, onAccept, onDecline }: IncomingCallModalProps) {
  const modal = (
    <div
      className="fixed inset-0 flex items-end sm:items-center justify-center p-4"
      style={{ zIndex: 99999 }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={onDecline}
        style={{ zIndex: 0 }}
      />

      {/* Card */}
      <div
        className={cn(
          'relative w-full max-w-sm rounded-[28px] overflow-hidden',
          'border border-white/[0.12]',
          'shadow-[0_32px_80px_rgba(0,0,0,0.8)]',
        )}
        style={{
          background: 'linear-gradient(145deg, #111118 0%, #0d1020 100%)',
          zIndex: 1,
        }}
      >
        {/* Ambient glow */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full blur-[80px] opacity-30 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #6366f1, transparent)' }}
        />

        <div className="relative z-10 px-8 pt-10 pb-8 text-center flex flex-col items-center gap-5">

          {/* Avatar with pulsing rings */}
          <div className="relative">
            <div className="absolute inset-[-16px] rounded-full border border-primary/20 animate-ping" style={{ animationDuration: '1.8s' }} />
            <div className="absolute inset-[-8px] rounded-full border border-primary/30 animate-ping" style={{ animationDuration: '1.8s', animationDelay: '0.4s' }} />
            <div className="h-24 w-24 rounded-full bg-gradient-to-br from-primary to-primary/40 flex items-center justify-center text-[26px] font-bold text-white shadow-xl shadow-primary/20 relative z-10">
              {getInitials(callerName)}
            </div>
            <div className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center border-2 border-[#111118] z-20">
              <Video style={{ width: 14, height: 14 }} className="text-white" />
            </div>
          </div>

          {/* Caller info */}
          <div className="space-y-1">
            <p className="text-[11px] text-white/40 uppercase tracking-widest font-semibold">Incoming Video Call</p>
            <h3 className="text-[22px] font-bold text-white leading-tight">{callerName}</h3>
            {callerInstitution && (
              <p className="text-[13px] text-white/50">{callerInstitution}</p>
            )}
            <RingingTimer />
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-center gap-10 pt-2 w-full">
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={onDecline}
                className="h-16 w-16 rounded-full bg-rose-500/90 hover:bg-rose-500 flex items-center justify-center shadow-xl shadow-rose-900/50 transition-all active:scale-90"
              >
                <PhoneOff style={{ width: 24, height: 24 }} className="text-white rotate-[135deg]" />
              </button>
              <span className="text-[12px] text-white/50 font-medium">Decline</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={onAccept}
                className="h-16 w-16 rounded-full bg-emerald-500 hover:bg-emerald-400 flex items-center justify-center shadow-xl shadow-emerald-900/50 transition-all active:scale-90 animate-[pulse_2s_ease-in-out_infinite]"
              >
                <Phone style={{ width: 24, height: 24 }} className="text-white" />
              </button>
              <span className="text-[12px] text-white/50 font-medium">Accept</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Portal to document.body so it escapes ALL stacking contexts
  return createPortal(modal, document.body);
}