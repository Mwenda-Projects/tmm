import { useEffect, useRef, useState, useCallback } from 'react';
import { useMessages } from '@/hooks/useMessages';
import { useGuestStatus } from '@/contexts/GuestContext';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Video } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { VideoCall } from '@/components/video/VideoCall';

interface ChatWindowProps {
  type: 'dm' | 'group';
  currentUserId: string;
  otherUserId?: string;
  groupId?: string;
  title: string;
}

export function ChatWindow({ type, currentUserId, otherUserId, groupId, title }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const { isGuest } = useGuestStatus();
  const [activeCall, setActiveCall] = useState<{
    sessionId: string;
    isCaller: boolean;
    remoteName: string;
    remoteInstitution?: string;
  } | null>(null);

  const options = type === 'dm'
    ? { type: 'dm' as const, currentUserId, otherUserId: otherUserId! }
    : { type: 'group' as const, currentUserId, groupId: groupId! };

  const { messages, loading, sendMessage } = useMessages(options);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const initiateCall = useCallback(async () => {
    if (type !== 'dm' || !otherUserId || isGuest) return;

    const { data, error } = await supabase
      .from('call_sessions')
      .insert({ caller_id: currentUserId, receiver_id: otherUserId, status: 'ringing' } as any)
      .select()
      .single();

    if (error || !data) {
      console.error('Failed to create call session', error);
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, institution_name')
      .eq('user_id', otherUserId)
      .single();

    setActiveCall({
      sessionId: (data as any).id,
      isCaller: true,
      remoteName: profile?.full_name || title,
      remoteInstitution: profile?.institution_name || undefined,
    });
  }, [type, otherUserId, currentUserId, title, isGuest]);

  if (activeCall) {
    return (
      <VideoCall
        currentUserId={currentUserId}
        remoteUserId={otherUserId!}
        callSessionId={activeCall.sessionId}
        isCaller={activeCall.isCaller}
        remoteName={activeCall.remoteName}
        remoteInstitution={activeCall.remoteInstitution}
        onEnd={() => setActiveCall(null)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="px-4 py-3 border-b border-border bg-card flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground">
            {type === 'dm' ? 'Direct message' : 'Group chat'}
          </p>
        </div>
        {type === 'dm' && !isGuest && (
          <Button variant="ghost" size="icon" onClick={initiateCall}>
            <Video className="h-5 w-5" />
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1 px-4 py-3">
        {loading ? (
          <p className="text-center text-muted-foreground py-8">Loading messages…</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No messages yet. Say hello!</p>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              content={msg.content}
              createdAt={msg.created_at}
              isOwn={msg.sender_id === currentUserId}
            />
          ))
        )}
        <div ref={bottomRef} />
      </ScrollArea>

      {isGuest ? (
        <div className="p-3 border-t border-border bg-muted/50 text-center text-sm text-muted-foreground">
          Guests cannot send messages. Register to participate.
        </div>
      ) : (
        <MessageInput onSend={sendMessage} />
      )}
    </div>
  );
}
