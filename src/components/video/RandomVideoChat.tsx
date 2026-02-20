import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useGuestStatus } from '@/contexts/GuestContext';
import { supabase } from '@/integrations/supabase/client';
import { VideoCall } from '@/components/video/VideoCall';
import { Video, Loader2, ShieldAlert, Shuffle, X, Users, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type MatchState = 'idle' | 'searching' | 'matched' | 'in-call';

// ─── Animated dots ────────────────────────────────────────────────────────────

function SearchingDots() {
  return (
    <div className="flex items-center gap-1.5">
      {[0, 1, 2].map(i => (
        <span key={i}
          className="h-2 w-2 rounded-full bg-primary animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </div>
  );
}

// ─── Elapsed search timer ─────────────────────────────────────────────────────

function SearchTimer() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return (
    <span className="font-mono text-[13px] text-white/40 tabular-nums">
      {m > 0 ? `${m}m ` : ''}{s}s
    </span>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function RandomVideoChat() {
  const { user } = useAuth();
  const { isGuest } = useGuestStatus();
  const [state, setState] = useState<MatchState>('idle');
  const [matchedUserId, setMatchedUserId] = useState<string | null>(null);
  const [matchedName, setMatchedName] = useState('');
  const [matchedInstitution, setMatchedInstitution] = useState<string | undefined>();
  const [callSessionId, setCallSessionId] = useState<string | null>(null);
  const [isCaller, setIsCaller] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const cleanup = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
  }, []);

  useEffect(() => {
    return () => {
      cleanup();
      if (user) supabase.from('random_match_queue').delete().eq('user_id', user.id).then();
    };
  }, [user, cleanup]);

  const startSearching = useCallback(async () => {
    if (!user) return;
    setState('searching');
    try {
      const { error: queueError } = await supabase
        .from('random_match_queue')
        .upsert({ user_id: user.id } as any, { onConflict: 'user_id' });
      if (queueError) throw new Error('Could not join match queue.');

      const channel = supabase.channel(`random-match-${user.id}`);
      channelRef.current = channel;
      channel.on('broadcast', { event: 'matched' }, async ({ payload }) => {
        cleanup();
        setMatchedUserId(payload.matchedUserId);
        setMatchedName(payload.matchedName || 'Peer');
        setMatchedInstitution(payload.matchedInstitution);
        setCallSessionId(payload.callSessionId);
        setIsCaller(false);
        setState('in-call');
      }).subscribe();

      const poll = setInterval(async () => {
        const { data: matchId, error: rpcError } = await supabase.rpc('find_random_match', { _user_id: user.id });
        if (rpcError) { console.error('RPC Error:', rpcError); return; }
        if (matchId) {
          clearInterval(poll); pollRef.current = null;
          const { data: profile } = await supabase.from('profiles').select('full_name, institution_name').eq('user_id', matchId).maybeSingle();
          const { data: session, error: sessionError } = await supabase.from('call_sessions').insert({ caller_id: user.id, receiver_id: matchId, status: 'accepted' } as any).select('id').single();
          if (sessionError || !session) { toast.error('Failed to establish a call session.'); setState('idle'); return; }
          const { data: myProfile } = await supabase.from('profiles').select('full_name, institution_name').eq('user_id', user.id).maybeSingle();
          const matchChannel = supabase.channel(`random-match-${matchId}`);
          matchChannel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
              await matchChannel.send({ type: 'broadcast', event: 'matched', payload: { matchedUserId: user.id, matchedName: myProfile?.full_name || 'Peer', matchedInstitution: myProfile?.institution_name, callSessionId: session.id } });
              setTimeout(() => supabase.removeChannel(matchChannel), 2000);
            }
          });
          setMatchedUserId(matchId);
          setMatchedName(profile?.full_name || 'Peer');
          setMatchedInstitution(profile?.institution_name || undefined);
          setCallSessionId(session.id);
          setIsCaller(true);
          setState('in-call');
        }
      }, 3000);
      pollRef.current = poll;
    } catch (error: any) {
      toast.error(error.message);
      setState('idle');
    }
  }, [user, cleanup]);

  const cancelSearch = useCallback(async () => {
    cleanup();
    if (user) await supabase.from('random_match_queue').delete().eq('user_id', user.id);
    setState('idle');
  }, [user, cleanup]);

  const handleCallEnd = useCallback(() => {
    setMatchedUserId(null);
    setCallSessionId(null);
    setState('idle');
  }, []);

  // In-call: hand off entirely to VideoCall
  if (state === 'in-call' && user && matchedUserId && callSessionId) {
    return (
      <VideoCall
        currentUserId={user.id}
        remoteUserId={matchedUserId}
        callSessionId={callSessionId}
        isCaller={isCaller}
        remoteName={matchedName}
        remoteInstitution={matchedInstitution}
        onEnd={handleCallEnd}
      />
    );
  }

  return (
    <div className={cn(
      'relative rounded-[20px] overflow-hidden border',
      'bg-white/70 dark:bg-white/[0.04]',
      'border-white/60 dark:border-white/[0.08]',
      'shadow-[0_4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_32px_rgba(0,0,0,0.4)]',
      'backdrop-blur-xl',
    )}>
      {/* Ambient glow (dark only) */}
      <div className="absolute top-0 right-0 w-48 h-48 rounded-full blur-[80px] opacity-20 pointer-events-none hidden dark:block"
        style={{ background: 'radial-gradient(circle, #6366f1, transparent)' }} />

      <div className="relative z-10 p-5">

        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <Shuffle style={{ width: 14, height: 14 }} className="text-primary" />
          </div>
          <div>
            <h3 className="text-[14px] font-semibold text-foreground leading-tight">Random Video Chat</h3>
            <p className="text-[11px] text-muted-foreground">Meet a random student</p>
          </div>
        </div>

        {/* Guest block */}
        {isGuest ? (
          <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-rose-500/8 dark:bg-rose-500/10 border border-rose-500/15">
            <ShieldAlert style={{ width: 15, height: 15 }} className="text-rose-500 mt-0.5 shrink-0" />
            <p className="text-[12px] text-muted-foreground">
              Sign in with a university email to access video chat.
            </p>
          </div>

        ) : state === 'searching' ? (
          /* Searching state */
          <div className="space-y-4">
            {/* Animated search card */}
            <div className="flex flex-col items-center justify-center gap-4 py-7 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.06]">
              {/* Pulsing radar rings */}
              <div className="relative flex items-center justify-center">
                <div className="absolute h-16 w-16 rounded-full border border-primary/30 animate-ping" style={{ animationDuration: '1.5s' }} />
                <div className="absolute h-24 w-24 rounded-full border border-primary/15 animate-ping" style={{ animationDuration: '1.5s', animationDelay: '0.4s' }} />
                <div className="h-12 w-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center z-10">
                  <Users style={{ width: 20, height: 20 }} className="text-primary" />
                </div>
              </div>

              <div className="text-center space-y-1">
                <div className="flex items-center justify-center gap-2">
                  <p className="text-[14px] font-semibold text-foreground">Looking for a peer</p>
                  <SearchingDots />
                </div>
                <div className="flex items-center justify-center gap-1.5">
                  <p className="text-[12px] text-muted-foreground">Searching for</p>
                  <SearchTimer />
                </div>
                <p className="text-[11px] text-muted-foreground">Usually takes less than a minute</p>
              </div>
            </div>

            <button onClick={cancelSearch}
              className={cn(
                'w-full h-10 rounded-xl text-[13px] font-medium flex items-center justify-center gap-2 transition-all',
                'bg-black/[0.04] dark:bg-white/[0.05] hover:bg-black/[0.07] dark:hover:bg-white/[0.08]',
                'border border-black/[0.08] dark:border-white/[0.08] text-muted-foreground hover:text-foreground',
              )}>
              <X style={{ width: 14, height: 14 }} /> Stop Searching
            </button>
          </div>

        ) : (
          /* Idle state */
          <div className="space-y-4">
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              Get matched with a random verified student for a peer-to-peer video call. Great for meeting new people across Kenyan universities!
            </p>

            {/* Feature pills */}
            <div className="flex flex-wrap gap-2">
              {[
                { icon: Zap, label: 'Instant match',      color: 'text-amber-500',   bg: 'bg-amber-500/10'   },
                { icon: Users, label: 'Verified students', color: 'text-blue-500',    bg: 'bg-blue-500/10'    },
                { icon: Video, label: 'HD video',          color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
              ].map(f => (
                <span key={f.label} className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border', f.bg, f.color, 'border-current/20')}>
                  <f.icon style={{ width: 10, height: 10 }} />
                  {f.label}
                </span>
              ))}
            </div>

            <button onClick={startSearching}
              className="w-full h-12 rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all active:scale-[0.98]">
              <Video style={{ width: 17, height: 17 }} />
              Find a Random Peer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}