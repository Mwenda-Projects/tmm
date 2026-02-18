import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useGuestStatus } from '@/contexts/GuestContext';
import { supabase } from '@/integrations/supabase/client';
import { VideoCall } from '@/components/video/VideoCall';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Video, Loader2, ShieldAlert, Shuffle, X } from 'lucide-react';
import { toast } from 'sonner';

type MatchState = 'idle' | 'searching' | 'matched' | 'in-call';

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
      if (user) {
        supabase.from('random_match_queue').delete().eq('user_id', user.id).then();
      }
    };
  }, [user, cleanup]);

  const startSearching = useCallback(async () => {
    if (!user) return;
    setState('searching');

    try {
      const { error: queueError } = await supabase
        .from('random_match_queue')
        .upsert({ user_id: user.id } as any, { onConflict: 'user_id' });

      if (queueError) throw new Error("Could not join match queue.");

      const channel = supabase.channel(`random-match-${user.id}`);
      channelRef.current = channel;

      channel
        .on('broadcast', { event: 'matched' }, async ({ payload }) => {
          cleanup();
          setMatchedUserId(payload.matchedUserId);
          setMatchedName(payload.matchedName || 'Peer');
          setMatchedInstitution(payload.matchedInstitution);
          setCallSessionId(payload.callSessionId);
          setIsCaller(false);
          setState('in-call');
        })
        .subscribe();

      const poll = setInterval(async () => {
        const { data: matchId, error: rpcError } = await supabase.rpc('find_random_match', { _user_id: user.id });

        if (rpcError) {
          console.error("RPC Error:", rpcError);
          return;
        }

        if (matchId) {
          clearInterval(poll);
          pollRef.current = null;

          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, institution_name')
            .eq('user_id', matchId)
            .maybeSingle();

          const { data: session, error: sessionError } = await supabase
            .from('call_sessions')
            .insert({ 
              caller_id: user.id, 
              receiver_id: matchId, 
              status: 'accepted' 
            } as any)
            .select('id')
            .single();

          if (sessionError || !session) {
            console.error("Session creation error:", sessionError);
            toast.error("Failed to establish a secure call session.");
            setState('idle');
            return;
          }

          const { data: myProfile } = await supabase
            .from('profiles')
            .select('full_name, institution_name')
            .eq('user_id', user.id)
            .maybeSingle();

          const matchChannel = supabase.channel(`random-match-${matchId}`);
          
          matchChannel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
              await matchChannel.send({
                type: 'broadcast',
                event: 'matched',
                payload: {
                  matchedUserId: user.id,
                  matchedName: myProfile?.full_name || 'Peer',
                  matchedInstitution: myProfile?.institution_name,
                  callSessionId: session.id,
                },
              });
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
    if (user) {
      await supabase.from('random_match_queue').delete().eq('user_id', user.id);
    }
    setState('idle');
  }, [user, cleanup]);

  const handleCallEnd = useCallback(() => {
    setMatchedUserId(null);
    setCallSessionId(null);
    setState('idle');
  }, []);

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
    <Card className="border-border overflow-hidden bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
          <Shuffle className="h-4 w-4 text-primary" /> Random Video Chat
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Get matched with a random student for a peer-to-peer video conversation. Great for meeting new people across universities!
        </p>

        {isGuest ? (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-xs text-destructive">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>Please sign in with a university email to access video chat.</span>
          </div>
        ) : state === 'searching' ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center gap-3 py-6 rounded-lg bg-muted/30 border border-dashed border-border">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="text-center">
                <p className="text-sm font-medium">Looking for a peer...</p>
                <p className="text-xs text-muted-foreground">This usually takes less than a minute</p>
              </div>
            </div>
            <Button variant="ghost" onClick={cancelSearch} className="w-full text-muted-foreground hover:text-destructive" size="sm">
              <X className="h-4 w-4 mr-2" /> Stop Searching
            </Button>
          </div>
        ) : (
          <Button onClick={startSearching} className="w-full shadow-lg hover:shadow-primary/20 transition-all" size="lg">
            <Video className="h-4 w-4 mr-2" /> Find a Random Peer
          </Button>
        )}
      </CardContent>
    </Card>
  );
}