import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Bell, Phone, MessageSquare, X, CheckCheck, Trash2, BellOff } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Notification {
  id: string;
  user_id: string;
  type: 'call' | 'message' | string;
  content?: string;
  body?: string;
  is_read: boolean;
  created_at: string;
}

// ─── Notification icon by type ────────────────────────────────────────────────

function NotifIcon({ type }: { type: string }) {
  if (type === 'call') {
    return (
      <div className="h-8 w-8 rounded-xl bg-violet-500/12 flex items-center justify-center shrink-0">
        <Phone style={{ width: 14, height: 14 }} className="text-violet-500" />
      </div>
    );
  }
  return (
    <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
      <MessageSquare style={{ width: 14, height: 14 }} className="text-primary" />
    </div>
  );
}

// ─── Single row ───────────────────────────────────────────────────────────────

function NotifRow({ notif, onMarkRead, onDelete }: {
  notif: Notification;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const text = notif.content || notif.body || (
    notif.type === 'call' ? 'Incoming call' : 'New message'
  );

  return (
    <div className={cn(
      'group relative flex items-start gap-3 px-4 py-3 transition-all duration-150',
      'border-b border-black/[0.04] dark:border-white/[0.04] last:border-0',
      !notif.is_read
        ? 'bg-primary/[0.035] dark:bg-primary/[0.06] hover:bg-primary/[0.06] dark:hover:bg-primary/[0.09]'
        : 'hover:bg-black/[0.02] dark:hover:bg-white/[0.03]',
    )}>
      {/* Unread dot */}
      {!notif.is_read && (
        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
      )}

      <NotifIcon type={notif.type} />

      <div className="flex-1 min-w-0 pr-6">
        <p className={cn(
          'text-[13px] leading-snug truncate',
          notif.is_read ? 'text-muted-foreground font-normal' : 'text-foreground font-medium',
        )}>
          {text}
        </p>
        <p className="text-[11px] text-muted-foreground/70 mt-0.5">
          {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
        </p>
      </div>

      {/* Actions — appear on hover */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {!notif.is_read && (
          <button
            onClick={(e) => { e.stopPropagation(); onMarkRead(notif.id); }}
            title="Mark as read"
            className="h-6 w-6 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all">
            <CheckCheck style={{ width: 12, height: 12 }} />
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(notif.id); }}
          title="Remove"
          className="h-6 w-6 rounded-lg flex items-center justify-center text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-all">
          <X style={{ width: 11, height: 11 }} />
        </button>
      </div>
    </div>
  );
}

// ─── Main Bell Component ──────────────────────────────────────────────────────

export function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  // ── Fetch ──
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setNotifications(data as Notification[]);
    setLoading(false);
  }, [user]);

  // ── Realtime ──
  useEffect(() => {
    if (!user) return;
    fetchNotifications();

    const channel = supabase
      .channel('notifications-bell')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, () => fetchNotifications())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchNotifications]);

  // ── Close on outside click ──
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // ── Mark all read when opening ──
  const handleOpen = async () => {
    setOpen(o => !o);
    if (!open && unreadCount > 0 && user) {
      // Optimistic
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
    }
  };

  // ── Mark single read ──
  const handleMarkRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  };

  // ── Delete single ──
  const handleDelete = async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    await supabase.from('notifications').delete().eq('id', id);
  };

  // ── Clear all ──
  const handleClearAll = async () => {
    if (!user || clearing || notifications.length === 0) return;
    setClearing(true);
    setNotifications([]);
    await supabase.from('notifications').delete().eq('user_id', user.id);
    setClearing(false);
  };

  return (
    <div className="relative" ref={ref}>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        className={cn(
          'relative h-8 w-8 rounded-xl flex items-center justify-center transition-all',
          open
            ? 'bg-white dark:bg-white/[0.09] shadow-[0_0_0_1px_rgba(0,0,0,0.08)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.10)]'
            : 'text-muted-foreground hover:text-foreground hover:bg-black/[0.05] dark:hover:bg-white/[0.07]',
        )}>
        <Bell style={{ width: 16, height: 16 }} className={open ? 'text-foreground' : ''} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className={cn(
          'absolute right-0 top-[calc(100%+8px)] z-50',
          'w-[340px] rounded-[20px] overflow-hidden',
          // Glass surface matching app design
          'bg-white/90 dark:bg-[#13131a]/95',
          'backdrop-blur-2xl',
          'border border-black/[0.07] dark:border-white/[0.09]',
          'shadow-[0_8px_40px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_48px_rgba(0,0,0,0.5)]',
        )}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-black/[0.05] dark:border-white/[0.06]">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center">
                <Bell style={{ width: 12, height: 12 }} className="text-primary" />
              </div>
              <h3 className="text-[14px] font-semibold text-foreground">Notifications</h3>
              {unreadCount > 0 && (
                <span className="h-5 min-w-5 px-1.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </div>

            {/* Clear all button */}
            {notifications.length > 0 && (
              <button
                onClick={handleClearAll}
                disabled={clearing}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-medium text-muted-foreground hover:text-rose-500 hover:bg-rose-500/[0.08] transition-all disabled:opacity-50">
                <Trash2 style={{ width: 11, height: 11 }} />
                Clear all
              </button>
            )}
          </div>

          {/* Scrollable list — fixed max height */}
          <div className="overflow-y-auto" style={{ maxHeight: '360px' }}>
            {loading ? (
              <div className="space-y-0">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3 border-b border-black/[0.04] dark:border-white/[0.04] last:border-0 animate-pulse">
                    <div className="h-8 w-8 rounded-xl bg-black/[0.06] dark:bg-white/[0.06] shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-3/4 bg-black/[0.06] dark:bg-white/[0.06] rounded-full" />
                      <div className="h-2.5 w-1/3 bg-black/[0.04] dark:bg-white/[0.04] rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="h-12 w-12 rounded-2xl bg-black/[0.04] dark:bg-white/[0.05] flex items-center justify-center">
                  <BellOff style={{ width: 22, height: 22 }} className="text-muted-foreground/30" />
                </div>
                <div className="text-center">
                  <p className="text-[13px] font-medium text-foreground">You're all caught up</p>
                  <p className="text-[12px] text-muted-foreground mt-0.5">No notifications yet</p>
                </div>
              </div>
            ) : (
              notifications.map(n => (
                <NotifRow
                  key={n.id}
                  notif={n}
                  onMarkRead={handleMarkRead}
                  onDelete={handleDelete}
                />
              ))
            )}
          </div>

          {/* Footer — only if there are items */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-black/[0.05] dark:border-white/[0.06] flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground">
                {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
              </p>
              {unreadCount === 0 && (
                <span className="flex items-center gap-1 text-[11px] text-emerald-500 font-medium">
                  <CheckCheck style={{ width: 11, height: 11 }} />
                  All read
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}