import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface IncomingCall {
  id: string;
  caller_id: string;
  callerName: string;
  callerInstitution?: string;
}

export function useIncomingCalls(currentUserId: string | undefined) {
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);

  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel(`incoming-calls-${currentUserId}`)
      .on(
        'postgres_changes' as any,
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_sessions',
          filter: `receiver_id=eq.${currentUserId}`,
        },
        async (payload: any) => {
          const session = payload.new;
          if (session.status !== 'ringing') return;

          // Fetch caller profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, institution_name')
            .eq('user_id', session.caller_id)
            .single();

          setIncomingCall({
            id: session.id,
            caller_id: session.caller_id,
            callerName: profile?.full_name || 'Unknown',
            callerInstitution: profile?.institution_name || undefined,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  const declineCall = useCallback(async () => {
    if (incomingCall) {
      await supabase
        .from('call_sessions')
        .update({ status: 'ended' } as any)
        .eq('id', incomingCall.id);
      setIncomingCall(null);
    }
  }, [incomingCall]);

  const acceptCall = useCallback(() => {
    // Return the call info and clear the notification
    const call = incomingCall;
    setIncomingCall(null);
    return call;
  }, [incomingCall]);

  return { incomingCall, acceptCall, declineCall };
}
