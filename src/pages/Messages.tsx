import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useGuestStatus } from '@/contexts/GuestContext';
import { supabase } from '@/integrations/supabase/client';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MessageSquare, Users, ArrowLeft, Search, ShieldAlert } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

// ─── Types ────────────────────────────────────────────────────────────────────

type ConversationTarget =
  | { type: 'dm'; userId: string; name: string }
  | { type: 'group'; groupId: string; name: string };

interface Contact { user_id: string; full_name: string | null; email: string; isOnline?: boolean; }
interface GroupItem { id: string; name: string; }

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// ─── Own presence heartbeat ───────────────────────────────────────────────────

function useOwnPresence(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;
    const update = (online: boolean) =>
      supabase.from('user_presence' as any).upsert({ user_id: userId, is_online: online, last_seen: new Date().toISOString() });

    update(true);
    const interval = setInterval(() => update(true), 30_000);
    const onVisibility = () => update(!document.hidden);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      update(false);
    };
  }, [userId]);
}

// ─── Contact Row ─────────────────────────────────────────────────────────────

function ContactRow({ label, sub, initials, active, isOnline, onClick, accent = false }: {
  label: string; sub: string; initials: string; active: boolean;
  isOnline?: boolean; onClick: () => void; accent?: boolean;
}) {
  return (
    <button onClick={onClick}
      className={cn(
        'w-full text-left px-4 py-3 flex items-center gap-3 transition-all duration-150',
        'border-b border-black/[0.04] dark:border-white/[0.04] last:border-0',
        active ? 'bg-primary/8 dark:bg-primary/10' : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.04]',
      )}>
      {/* Avatar with online dot */}
      <div className="relative shrink-0">
        <Avatar className="h-10 w-10">
          <AvatarFallback className={cn(
            'text-[12px] font-bold',
            accent ? 'bg-violet-500/10 text-violet-500' : 'bg-primary/10 text-primary',
          )}>
            {initials}
          </AvatarFallback>
        </Avatar>
        {!accent && (
          <span className={cn(
            'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2',
            'border-white dark:border-[#0d0d0f]',
            isOnline ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600',
          )} />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className={cn('text-[13px] font-medium truncate', active ? 'text-primary' : 'text-foreground')}>
            {label}
          </p>
          {!accent && isOnline && (
            <span className="text-[10px] text-emerald-500 font-medium shrink-0">Online</span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground truncate">{sub}</p>
      </div>

      {active && <div className="h-2 w-2 rounded-full bg-primary shrink-0" />}
    </button>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Messages() {
  const { user } = useAuth();
  const { isGuest } = useGuestStatus();
  const navigate = useNavigate();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [active, setActive] = useState<ConversationTarget | null>(null);
  const [tab, setTab] = useState<'dms' | 'groups'>('dms');
  const [search, setSearch] = useState('');
  const [totalUnread, setTotalUnread] = useState(0);

  useOwnPresence(user?.id);

  useEffect(() => {
    if (!user) return;

    // Fetch contacts
    supabase.from('profiles').select('user_id, full_name, email').neq('user_id', user.id)
      .then(async ({ data }) => {
        if (!data) return;
        // Fetch presence for all contacts
        const ids = data.map(c => c.user_id);
        const { data: presence } = await supabase
          .from('user_presence' as any)
          .select('user_id, is_online')
          .in('user_id', ids);
        const presenceMap = new Map((presence ?? []).map((p: any) => [p.user_id, p.is_online]));
        setContacts(data.map(c => ({ ...c, isOnline: presenceMap.get(c.user_id) ?? false })));
      });

    // Fetch groups
    supabase.from('group_members').select('group_id, groups(id, name)').eq('user_id', user.id)
      .then(({ data }) => {
        if (data) setGroups(data.map((row: any) => row.groups).filter(Boolean));
      });

    // Unread count
    supabase.from('notifications').select('*', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('type', 'message').eq('is_read', false)
      .then(({ count }) => setTotalUnread(count ?? 0));

    // Realtime presence updates
    const channel = supabase.channel('presence-all')
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'user_presence' },
        (payload: any) => {
          setContacts(prev => prev.map(c =>
            c.user_id === payload.new?.user_id ? { ...c, isOnline: payload.new.is_online } : c
          ));
        })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const filteredContacts = useMemo(() => {
    const list = tab === 'dms' && !search.trim()
      ? [...contacts].sort((a, b) => (b.isOnline ? 1 : 0) - (a.isOnline ? 1 : 0))
      : contacts;
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(c => c.full_name?.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
  }, [contacts, search, tab]);

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return groups;
    const q = search.toLowerCase();
    return groups.filter(g => g.name.toLowerCase().includes(q));
  }, [groups, search]);

  if (!user) return null;

  // ── Guest block ──
  if (isGuest) {
    return (
      <div className="min-h-screen relative overflow-hidden">
        <div className="fixed inset-0 dark:hidden pointer-events-none">
          <div className="absolute inset-0 bg-[#f0f2f5]" />
          <div className="absolute top-[-200px] left-[-100px] w-[600px] h-[600px] rounded-full blur-[120px] opacity-60" style={{ background: 'radial-gradient(circle, #dbeafe, transparent)' }} />
          <div className="absolute top-[100px] right-[-100px] w-[500px] h-[500px] rounded-full blur-[120px] opacity-50" style={{ background: 'radial-gradient(circle, #ede9fe, transparent)' }} />
        </div>
        <div className="fixed inset-0 hidden dark:block pointer-events-none">
          <div className="absolute inset-0 bg-[#0d0d0f]" />
          <div className="absolute top-[-200px] left-[-100px] w-[700px] h-[700px] rounded-full blur-[160px] opacity-30" style={{ background: 'radial-gradient(circle, #312e81, transparent)' }} />
        </div>
        <div className="relative z-10 flex min-h-[80vh] items-center justify-center px-4">
          <div className="text-center space-y-4 max-w-sm">
            <div className="h-16 w-16 rounded-3xl bg-white/70 dark:bg-white/[0.06] backdrop-blur-xl border border-white/60 dark:border-white/[0.08] flex items-center justify-center mx-auto shadow-[0_4px_24px_rgba(0,0,0,0.08)]">
              <ShieldAlert className="h-7 w-7 text-rose-500" />
            </div>
            <h2 className="text-[20px] font-semibold text-foreground">Chat available after verification</h2>
            <p className="text-[14px] text-muted-foreground">Register with your university email to start chatting.</p>
            <Button onClick={() => navigate('/auth')} className="rounded-xl px-6">Register Now</Button>
          </div>
        </div>
      </div>
    );
  }

  const onlineCount = contacts.filter(c => c.isOnline).length;

  return (
    <div className="flex h-[calc(100vh-3rem)] relative overflow-hidden">

      {/* ── GRADIENT MESH BACKGROUND ── */}
      <div className="fixed inset-0 dark:hidden pointer-events-none">
        <div className="absolute inset-0 bg-[#f0f2f5]" />
        <div className="absolute top-[-200px] left-[-100px] w-[600px] h-[600px] rounded-full blur-[120px] opacity-60" style={{ background: 'radial-gradient(circle, #dbeafe, transparent)' }} />
        <div className="absolute top-[100px] right-[-100px] w-[500px] h-[500px] rounded-full blur-[120px] opacity-50" style={{ background: 'radial-gradient(circle, #ede9fe, transparent)' }} />
        <div className="absolute bottom-[-100px] left-[30%] w-[500px] h-[400px] rounded-full blur-[120px] opacity-40" style={{ background: 'radial-gradient(circle, #dcfce7, transparent)' }} />
      </div>
      <div className="fixed inset-0 hidden dark:block pointer-events-none">
        <div className="absolute inset-0 bg-[#0d0d0f]" />
        <div className="absolute top-[-200px] left-[-100px] w-[700px] h-[700px] rounded-full blur-[160px] opacity-30" style={{ background: 'radial-gradient(circle, #312e81, transparent)' }} />
        <div className="absolute top-[200px] right-[-100px] w-[500px] h-[500px] rounded-full blur-[140px] opacity-20" style={{ background: 'radial-gradient(circle, #134e4a, transparent)' }} />
        <div className="absolute bottom-[-50px] left-[40%] w-[600px] h-[400px] rounded-full blur-[140px] opacity-25" style={{ background: 'radial-gradient(circle, #1e1b4b, transparent)' }} />
      </div>

      {/* ── SIDEBAR ── */}
      <div className={cn(
        'relative z-10 w-full md:w-72 flex flex-col shrink-0',
        'bg-white/60 dark:bg-white/[0.03] backdrop-blur-xl',
        'border-r border-black/[0.06] dark:border-white/[0.06]',
        active ? 'hidden md:flex' : 'flex',
      )}>
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-black/[0.05] dark:border-white/[0.05]">
          <h1 className="text-[20px] font-semibold text-foreground tracking-tight">Messages</h1>
          {onlineCount > 0 && (
            <p className="text-[11px] text-emerald-500 font-medium mt-0.5 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
              {onlineCount} online now
            </p>
          )}
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-black/[0.05] dark:border-white/[0.05]">
          <div className="relative">
            <Search style={{ width: 13, height: 13 }} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search contacts or groups…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-9 text-[13px] bg-black/[0.04] dark:bg-white/[0.05] border-black/[0.06] dark:border-white/[0.06] rounded-xl"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-4 py-2 gap-1 border-b border-black/[0.05] dark:border-white/[0.05]">
          {(['dms', 'groups'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[12px] font-medium transition-all',
                tab === t
                  ? 'bg-white dark:bg-white/[0.09] text-foreground shadow-[0_0_0_1px_rgba(0,0,0,0.06)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08)] shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-black/[0.03] dark:hover:bg-white/[0.04]',
              )}>
              {t === 'dms' ? <MessageSquare style={{ width: 13, height: 13 }} /> : <Users style={{ width: 13, height: 13 }} />}
              {t === 'dms' ? 'Direct' : 'Groups'}
              {t === 'dms' && totalUnread > 0 && (
                <span className="h-4 min-w-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {totalUnread > 99 ? '99+' : totalUnread}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Contact / Group list */}
        <div className="flex-1 overflow-y-auto">
          {tab === 'dms' ? (
            filteredContacts.length === 0 ? (
              <div className="p-6">
                <EmptyState icon={MessageSquare}
                  title={search ? 'No matches' : 'No contacts yet'}
                  description={search ? 'Try a different search term.' : 'Other users appear here once registered.'} />
              </div>
            ) : (
              filteredContacts.map(c => {
                const name = c.full_name || c.email;
                return (
                  <ContactRow key={c.user_id}
                    label={name} sub={c.email} initials={getInitials(name)}
                    isOnline={c.isOnline}
                    active={active?.type === 'dm' && (active as any).userId === c.user_id}
                    onClick={() => setActive({ type: 'dm', userId: c.user_id, name })} />
                );
              })
            )
          ) : (
            filteredGroups.length === 0 ? (
              <div className="p-6">
                <EmptyState icon={Users}
                  title={search ? 'No matches' : 'No groups joined'}
                  description={search ? 'Try a different search term.' : 'Join a group from the Groups page.'} />
              </div>
            ) : (
              filteredGroups.map(g => (
                <ContactRow key={g.id}
                  label={g.name} sub="Group chat" initials={getInitials(g.name)}
                  active={active?.type === 'group' && (active as any).groupId === g.id}
                  onClick={() => setActive({ type: 'group', groupId: g.id, name: g.name })}
                  accent />
              ))
            )
          )}
        </div>
      </div>

      {/* ── CHAT AREA ── */}
      <div className={cn(
        'relative z-10 flex-1 flex flex-col min-w-0',
        'bg-white/40 dark:bg-white/[0.02] backdrop-blur-xl',
        !active ? 'hidden md:flex' : 'flex',
      )}>
        {active ? (
          <>
            {/* Mobile back */}
            <div className="md:hidden px-4 py-2.5 border-b border-black/[0.05] dark:border-white/[0.05] bg-white/50 dark:bg-white/[0.03] backdrop-blur-xl">
              <button onClick={() => setActive(null)}
                className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft style={{ width: 14, height: 14 }} /> Back
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <ChatWindow
                type={active.type}
                currentUserId={user.id}
                otherUserId={active.type === 'dm' ? (active as any).userId : undefined}
                groupId={active.type === 'group' ? (active as any).groupId : undefined}
                title={active.name}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center px-4">
            <div className={cn(
              'rounded-3xl p-10 flex flex-col items-center gap-4 max-w-xs text-center',
              'bg-white/70 dark:bg-white/[0.05] backdrop-blur-xl',
              'border border-white/60 dark:border-white/[0.08]',
              'shadow-[0_4px_24px_rgba(0,0,0,0.06)]',
            )}>
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <MessageSquare style={{ width: 24, height: 24 }} className="text-primary" />
              </div>
              <div>
                <p className="text-[15px] font-semibold text-foreground">No conversation selected</p>
                <p className="text-[13px] text-muted-foreground mt-1">Pick a contact or group from the sidebar to start chatting.</p>
              </div>
              {onlineCount > 0 && (
                <p className="text-[12px] text-emerald-500 font-medium flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  {onlineCount} {onlineCount === 1 ? 'person' : 'people'} online right now
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}