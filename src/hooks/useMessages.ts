import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

type Message = Tables<'messages'>;

type UseMessagesOptions =
  | { type: 'dm'; otherUserId: string; currentUserId: string }
  | { type: 'group'; groupId: string; currentUserId: string };

export function useMessages(options: UseMessagesOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  // Build query filters based on type
  const fetchMessages = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true });

    if (options.type === 'dm') {
      query = query
        .is('group_id', null)
        .or(
          `and(sender_id.eq.${options.currentUserId},receiver_id.eq.${options.otherUserId}),and(sender_id.eq.${options.otherUserId},receiver_id.eq.${options.currentUserId})`
        );
    } else {
      query = query.eq('group_id', options.groupId);
    }

    const { data, error } = await query;
    if (!error && data) {
      setMessages(data);
    }
    setLoading(false);
  }, [options.type, options.currentUserId, 
      options.type === 'dm' ? options.otherUserId : '',
      options.type === 'group' ? options.groupId : '']);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Realtime subscription
  useEffect(() => {
    const channelName = options.type === 'dm'
      ? `dm-${[options.currentUserId, options.otherUserId].sort().join('-')}`
      : `group-${options.groupId}`;

    const filter = options.type === 'group'
      ? `group_id=eq.${options.groupId}`
      : undefined;

    const channel = supabase
      .channel(channelName)
      .on<Message>(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          ...(filter ? { filter } : {}),
        },
        (payload) => {
          const newMsg = payload.new;
          if (options.type === 'dm') {
            // Only add if it belongs to this DM conversation
            const isRelevant =
              (newMsg.sender_id === options.currentUserId && newMsg.receiver_id === options.otherUserId) ||
              (newMsg.sender_id === options.otherUserId && newMsg.receiver_id === options.currentUserId);
            if (!isRelevant || newMsg.group_id) return;
          }
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [options.type, options.currentUserId,
      options.type === 'dm' ? options.otherUserId : '',
      options.type === 'group' ? options.groupId : '']);

  const sendMessage = useCallback(async (content: string) => {
    const insert: any = {
      content,
      sender_id: options.currentUserId,
    };
    if (options.type === 'dm') {
      insert.receiver_id = options.otherUserId;
    } else {
      insert.group_id = options.groupId;
    }
    const { error } = await supabase.from('messages').insert(insert);
    return { error };
  }, [options.type, options.currentUserId,
      options.type === 'dm' ? options.otherUserId : '',
      options.type === 'group' ? options.groupId : '']);

  return { messages, loading, sendMessage };
}
