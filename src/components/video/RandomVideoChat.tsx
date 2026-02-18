import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useGuestStatus } from '@/contexts/GuestContext';
import { supabase } from '@/integrations/supabase/client';
import { VideoCall } from '@/components/video/VideoCall';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Video, Loader2, ShieldAlert, Shuffle, X } from 'lucide-react';

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

  // Remove from queue on unmount
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

    // Join queue
    await supabase.from('random_match_queue').upsert({ user_id: user.id } as any, { onConflict: 'user_id' });

    // Listen for being matched (other user calls us via broadcast)
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

    // Poll for a match every 3 seconds
    const poll = setInterval(async () => {
      const { data: matchId } = await supabase.rpc('find_random_match', { _user_id: user.id });

      if (matchId) {
        clearInterval(poll);
        pollRef.current = null;

        // Get matched user profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, institution_name')
          .eq('user_id', matchId)
          .maybeSingle();

        // Create call session
        const { data: session } = await supabase
          .from('call_sessions')
          .insert({ caller_id: user.id, receiver_id: matchId, status: 'accepted' } as any)
          .select('id')
          .single();

        if (!session) { setState('idle'); return; }

        // Notify the matched user via their broadcast channel
        const matchChannel = supabase.channel(`random-match-${matchId}`);
        
        // Get our own profile for the other user
        const { data: myProfile } = await supabase
          .from('profiles')
          .select('full_name, institution_name')
          .eq('user_id', user.id)
          .maybeSingle();

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
            // Clean up notification channel after a short delay
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

  // Active video call overlay
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
    <Card className="border-border overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
          <Shuffle className="h-4 w-4 text-primary" /> Random Video Chat
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Get matched with a random student for a peer-to-peer video conversation. Great for meeting new people across universities!
        </p>

        {isGuest ? (
          <div className="flex items-center gap-2 text-xs text-destructive">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>Register with a university email to use video chat.</span>
          </div>
        ) : state === 'searching' ? (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 py-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Looking for a match…</span>
            </div>
            <Button variant="outline" onClick={cancelSearch} className="w-full" size="sm">
              <X className="h-4 w-4 mr-1" /> Cancel
            </Button>
          </div>
        ) : (
          <Button onClick={startSearching} className="w-full" size="sm">
            <Video className="h-4 w-4 mr-1" /> Find a Random Peer
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
