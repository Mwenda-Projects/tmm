import { useEffect, useRef, useState, useCallback } from 'react';
import { useMessages } from '@/hooks/useMessages';
import { useGuestStatus } from '@/contexts/GuestContext';
import { MessageInput } from './MessageInput';
import { VideoCall } from '@/components/video/VideoCall';
import { supabase } from '@/integrations/supabase/client';
import { Video, Check, CheckCheck } from 'lucide-react';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatWindowProps {
  type: 'dm' | 'group';
  currentUserId: string;
  otherUserId?: string;
  groupId?: string;
  title: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMessageTime(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return `Yesterday ${format(d, 'HH:mm')}`;
  return format(d, 'MMM d, HH:mm');
}

function formatDividerDate(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'EEEE, MMMM d');
}

function isSameDay(a: string, b: string) {
  return format(new Date(a), 'yyyy-MM-dd') === format(new Date(b), 'yyyy-MM-dd');
}

// ─── Online presence hook ─────────────────────────────────────────────────────

function useOnlineStatus(userId: string | undefined) {
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    // Check presence table
    const checkPresence = async () => {
      const { data } = await supabase
        .from('user_presence' as any)
        .select('last_seen, is_online')
        .eq('user_id', userId)
        .maybeSingle();

      if (data) {
        setIsOnline((data as any).is_online ?? false);
        setLastSeen((data as any).last_seen ?? null);
      }
    };

    checkPresence();

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`presence-${userId}`)
      .on('postgres_changes' as any, {
        event: '*', schema: 'public', table: 'user_presence',
        filter: `user_id=eq.${userId}`,
      }, (payload: any) => {
        setIsOnline(payload.new?.is_online ?? false);
        setLastSeen(payload.new?.last_seen ?? null);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  return { isOnline, lastSeen };
}

// ─── Own presence heartbeat ───────────────────────────────────────────────────

function useOwnPresence(userId: string) {
  useEffect(() => {
    const update = async () => {
      await supabase.from('user_presence' as any).upsert({
        user_id: userId, is_online: true, last_seen: new Date().toISOString(),
      });
    };
    update();
    const interval = setInterval(update, 30_000);

    const handleVisibility = () => {
      supabase.from('user_presence' as any).upsert({
        user_id: userId, is_online: !document.hidden, last_seen: new Date().toISOString(),
      });
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      supabase.from('user_presence' as any).upsert({
        user_id: userId, is_online: false, last_seen: new Date().toISOString(),
      });
    };
  }, [userId]);
}

// ─── Read receipt hook ────────────────────────────────────────────────────────

function useReadReceipts(conversationId: string, currentUserId: string, lastMessageId: string | undefined) {
  const [readByOther, setReadByOther] = useState(false);

  useEffect(() => {
    if (!lastMessageId) return;

    const checkRead = async () => {
      const { data } = await supabase
        .from('message_read_receipts' as any)
        .select('id')
        .eq('message_id', lastMessageId)
        .neq('user_id', currentUserId)
        .maybeSingle();
      setReadByOther(!!data);
    };
    checkRead();

    const channel = supabase
      .channel(`receipts-${conversationId}`)
      .on('postgres_changes' as any, {
        event: 'INSERT', schema: 'public', table: 'message_read_receipts',
      }, () => checkRead())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId, currentUserId, lastMessageId]);

  // Mark messages as read when window is focused
  useEffect(() => {
    if (!lastMessageId) return;
    supabase.from('message_read_receipts' as any).upsert({
      message_id: lastMessageId, user_id: currentUserId,
    }).then(() => {});
  }, [lastMessageId, currentUserId]);

  return { readByOther };
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function Bubble({ content, createdAt, isOwn, showReceipt, readByOther }: {
  content: string; createdAt: string; isOwn: boolean; showReceipt?: boolean; readByOther?: boolean;
}) {
  return (
    <div className={cn('flex items-end gap-2 mb-1', isOwn ? 'flex-row-reverse' : 'flex-row')}>
      <div className={cn(
        'max-w-[70%] px-4 py-2.5 rounded-[18px] relative',
        isOwn
          ? 'bg-primary text-primary-foreground rounded-br-[4px]'
          : 'bg-white/80 dark:bg-white/[0.08] text-foreground rounded-bl-[4px] backdrop-blur-sm border border-black/[0.05] dark:border-white/[0.08]',
      )}>
        <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words">{content}</p>
        <div className={cn(
          'flex items-center gap-1 mt-1',
          isOwn ? 'justify-end' : 'justify-start',
        )}>
          <span className={cn(
            'text-[10px]',
            isOwn ? 'text-primary-foreground/60' : 'text-muted-foreground',
          )}>
            {formatMessageTime(createdAt)}
          </span>
          {isOwn && showReceipt && (
            readByOther
              ? <CheckCheck style={{ width: 12, height: 12 }} className="text-primary-foreground/80" />
              : <Check style={{ width: 12, height: 12 }} className="text-primary-foreground/50" />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Date Divider ─────────────────────────────────────────────────────────────

function DateDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px bg-black/[0.05] dark:bg-white/[0.06]" />
      <span className="text-[11px] font-medium text-muted-foreground px-2">{label}</span>
      <div className="flex-1 h-px bg-black/[0.05] dark:bg-white/[0.06]" />
    </div>
  );
}

// ─── Typing Indicator ────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex items-end gap-2 mb-2">
      <div className="bg-white/80 dark:bg-white/[0.08] backdrop-blur-sm border border-black/[0.05] dark:border-white/[0.08] px-4 py-3 rounded-[18px] rounded-bl-[4px] flex items-center gap-1">
        {[0, 1, 2].map(i => (
          <span key={i} className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  );
}

// ─── Main ChatWindow ──────────────────────────────────────────────────────────

export function ChatWindow({ type, currentUserId, otherUserId, groupId, title }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const { isGuest } = useGuestStatus();
  const [activeCall, setActiveCall] = useState<{
    sessionId: string; isCaller: boolean; remoteName: string; remoteInstitution?: string;
  } | null>(null);

  const options = type === 'dm'
    ? { type: 'dm' as const, currentUserId, otherUserId: otherUserId! }
    : { type: 'group' as const, currentUserId, groupId: groupId! };

  const { messages, loading, sendMessage } = useMessages(options);

  const conversationId = type === 'dm'
    ? [currentUserId, otherUserId].sort().join('-')
    : groupId!;

  const lastMessage = messages[messages.length - 1];
  const lastOwnMessage = [...messages].reverse().find(m => m.sender_id === currentUserId);

  // Online presence
  const { isOnline, lastSeen } = useOnlineStatus(type === 'dm' ? otherUserId : undefined);
  useOwnPresence(currentUserId);

  // Read receipts
  const { readByOther } = useReadReceipts(conversationId, currentUserId, lastOwnMessage?.id);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const initiateCall = useCallback(async () => {
    if (type !== 'dm' || !otherUserId || isGuest) return;
    const { data, error } = await supabase
      .from('call_sessions')
      .insert({ caller_id: currentUserId, receiver_id: otherUserId, status: 'ringing' } as any)
      .select().single();
    if (error || !data) return;
    const { data: profile } = await supabase.from('profiles').select('full_name, institution_name').eq('user_id', otherUserId).single();
    setActiveCall({ sessionId: (data as any).id, isCaller: true, remoteName: profile?.full_name || title, remoteInstitution: profile?.institution_name || undefined });
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
    <div className="flex flex-col h-full">

      {/* ── Chat Header ── */}
      <div className={cn(
        'px-5 py-3.5 flex items-center justify-between shrink-0',
        'bg-white/60 dark:bg-white/[0.04] backdrop-blur-xl',
        'border-b border-black/[0.05] dark:border-white/[0.05]',
      )}>
        <div className="flex items-center gap-3">
          {/* Online indicator avatar */}
          <div className="relative">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-[12px] font-bold text-primary">
                {title.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
              </span>
            </div>
            {type === 'dm' && (
              <span className={cn(
                'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-[#0d0d0f]',
                isOnline ? 'bg-emerald-500' : 'bg-zinc-400',
              )} />
            )}
          </div>
          <div>
            <h2 className="text-[14px] font-semibold text-foreground leading-tight">{title}</h2>
            <p className="text-[11px] text-muted-foreground leading-tight">
              {type === 'dm'
                ? isOnline
                  ? 'Online now'
                  : lastSeen
                    ? `Last seen ${formatDistanceToNow(new Date(lastSeen), { addSuffix: true })}`
                    : 'Offline'
                : 'Group chat'
              }
            </p>
          </div>
        </div>

        {type === 'dm' && !isGuest && (
          <button onClick={initiateCall}
            className="h-9 w-9 rounded-xl bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors">
            <Video style={{ width: 16, height: 16 }} className="text-primary" />
          </button>
        )}
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-0.5">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <p className="text-[12px] text-muted-foreground">Loading messages…</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <div className="h-12 w-12 rounded-2xl bg-white/70 dark:bg-white/[0.06] backdrop-blur-xl border border-white/60 dark:border-white/[0.08] flex items-center justify-center">
              <span className="text-xl">👋</span>
            </div>
            <p className="text-[13px] font-medium text-foreground">No messages yet</p>
            <p className="text-[12px] text-muted-foreground">Say hello to {title}!</p>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => {
              const prev = messages[i - 1];
              const showDivider = !prev || !isSameDay(prev.created_at, msg.created_at);
              const isOwn = msg.sender_id === currentUserId;
              const isLastOwn = isOwn && msg.id === lastOwnMessage?.id;

              return (
                <div key={msg.id}>
                  {showDivider && <DateDivider label={formatDividerDate(msg.created_at)} />}
                  <Bubble
                    content={msg.content}
                    createdAt={msg.created_at}
                    isOwn={isOwn}
                    showReceipt={isLastOwn}
                    readByOther={isLastOwn ? readByOther : false}
                  />
                </div>
              );
            })}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Input ── */}
      {isGuest ? (
        <div className={cn(
          'px-5 py-3 text-center text-[12px] text-muted-foreground',
          'bg-white/50 dark:bg-white/[0.03] backdrop-blur-xl',
          'border-t border-black/[0.05] dark:border-white/[0.05]',
        )}>
          Guests cannot send messages. <a href="/auth" className="text-primary hover:underline">Register to participate.</a>
        </div>
      ) : (
        <div className={cn(
          'bg-white/50 dark:bg-white/[0.03] backdrop-blur-xl',
          'border-t border-black/[0.05] dark:border-white/[0.05]',
        )}>
          <MessageInput onSend={sendMessage} />
        </div>
      )}
    </div>
  );
}