import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useGuestStatus } from '@/contexts/GuestContext';
import { supabase } from '@/integrations/supabase/client';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MessageSquare, Users, ArrowLeft, Search, ShieldAlert } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';

type ConversationTarget =
  | { type: 'dm'; userId: string; name: string }
  | { type: 'group'; groupId: string; name: string };

interface Contact {
  user_id: string;
  full_name: string | null;
  email: string;
}

interface GroupItem {
  id: string;
  name: string;
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function Messages() {
  const { user } = useAuth();
  const { isGuest } = useGuestStatus();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [active, setActive] = useState<ConversationTarget | null>(null);
  const [tab, setTab] = useState<'dms' | 'groups'>('dms');
  const [search, setSearch] = useState('');
  const [unreadDMs, setUnreadDMs] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user) return;

    // Fetch profiles for DM contacts (excluding self)
    supabase
      .from('profiles')
      .select('user_id, full_name, email')
      .neq('user_id', user.id)
      .then(({ data }) => {
        if (data) setContacts(data);
      });

    // Fetch groups user is a member of
    supabase
      .from('group_members')
      .select('group_id, groups(id, name)')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (data) {
          const g = data.map((row: any) => row.groups).filter(Boolean);
          setGroups(g);
        }
      });

    // Fetch unread DM counts from notifications
    supabase
      .from('notifications')
      .select('reference_id')
      .eq('user_id', user.id)
      .eq('type', 'message')
      .eq('is_read', false)
      .then(({ data }) => {
        if (!data) return;
        const counts: Record<string, number> = {};
        // We group by reference_id loosely — each notification = 1 unread
        data.forEach(() => {
          // We'll count total unread DMs per sender below
        });
      });

    // Simple unread count: count unread 'message' notifications
    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .eq('type', 'message')
      .eq('is_read', false)
      .then(({ data }) => {
        if (!data) return;
        // For each notification, look up the message to find the sender
        // For simplicity, we'll just show total unread badge
        const counts: Record<string, number> = {};
        // reference_id points to the message id — we can't easily get sender from here without joins
        // Instead, just set a generic unread count keyed by 'all'
        setUnreadDMs({ all: data.length });
      });
  }, [user]);

  // Filter contacts / groups by search query
  const filteredContacts = useMemo(() => {
    if (!search.trim()) return contacts;
    const q = search.toLowerCase();
    return contacts.filter(
      (c) =>
        (c.full_name?.toLowerCase().includes(q)) ||
        c.email.toLowerCase().includes(q)
    );
  }, [contacts, search]);

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return groups;
    const q = search.toLowerCase();
    return groups.filter((g) => g.name.toLowerCase().includes(q));
  }, [groups, search]);

  if (!user) return null;

  // Gate Crusher full-page block
  if (isGuest) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-sm">
          <ShieldAlert className="h-12 w-12 mx-auto text-muted-foreground/50" />
          <h2 className="text-lg font-semibold text-foreground">Chat available after verification</h2>
          <p className="text-sm text-muted-foreground">
            Guest users cannot access messaging. Register with your university email to start chatting.
          </p>
          <Button asChild variant="default" size="sm">
            <a href="/auth">Register Now</a>
          </Button>
        </div>
      </div>
    );
  }

  const totalUnread = unreadDMs.all ?? 0;

  return (
    <div className="flex h-[calc(100vh-3rem)] bg-background">
      {/* Sidebar */}
      <div
        className={`w-full md:w-80 border-r border-border flex flex-col ${
          active ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-border">
          <h1 className="text-xl font-bold text-foreground">Messages</h1>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search contacts or groups…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 bg-muted/50"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setTab('dms')}
            className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors relative ${
              tab === 'dms'
                ? 'border-b-2 border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <MessageSquare className="inline h-4 w-4 mr-1.5" />
            Direct
            {totalUnread > 0 && (
              <Badge
                variant="destructive"
                className="ml-1.5 h-5 min-w-5 px-1 text-[10px] font-bold"
              >
                {totalUnread > 99 ? '99+' : totalUnread}
              </Badge>
            )}
          </button>
          <button
            onClick={() => setTab('groups')}
            className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${
              tab === 'groups'
                ? 'border-b-2 border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users className="inline h-4 w-4 mr-1.5" />
            Groups
          </button>
        </div>

        {/* Contact / Group list */}
        <ScrollArea className="flex-1">
          {tab === 'dms' ? (
            filteredContacts.length === 0 ? (
              <EmptyState
                icon={MessageSquare}
                title={search ? 'No matches' : 'No contacts found'}
                description={search ? 'Try a different search term.' : 'Other users will appear here once they register.'}
              />
            ) : (
              filteredContacts.map((c) => {
                const displayName = c.full_name || c.email;
                const isActive =
                  active?.type === 'dm' && active.userId === c.user_id;
                return (
                  <button
                    key={c.user_id}
                    onClick={() =>
                      setActive({ type: 'dm', userId: c.user_id, name: displayName })
                    }
                    className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors border-b border-border ${
                      isActive
                        ? 'bg-accent'
                        : 'hover:bg-accent/50'
                    }`}
                  >
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                        {getInitials(displayName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm text-foreground truncate">
                        {displayName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                    </div>
                  </button>
                );
              })
            )
          ) : filteredGroups.length === 0 ? (
            <EmptyState
              icon={Users}
              title={search ? 'No matches' : "No groups joined"}
              description={search ? 'Try a different search term.' : 'Join a group from the Groups page to chat.'}
            />
          ) : (
            filteredGroups.map((g) => {
              const isActive =
                active?.type === 'group' && active.groupId === g.id;
              return (
                <button
                  key={g.id}
                  onClick={() =>
                    setActive({ type: 'group', groupId: g.id, name: g.name })
                  }
                  className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors border-b border-border ${
                    isActive
                      ? 'bg-accent'
                      : 'hover:bg-accent/50'
                  }`}
                >
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback className="bg-secondary text-secondary-foreground text-xs font-semibold">
                      {getInitials(g.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm text-foreground truncate">
                      {g.name}
                    </p>
                    <p className="text-xs text-muted-foreground">Group chat</p>
                  </div>
                </button>
              );
            })
          )}
        </ScrollArea>
      </div>

      {/* Chat area */}
      <div className={`flex-1 flex flex-col ${!active ? 'hidden md:flex' : 'flex'}`}>
        {active ? (
          <>
            <div className="md:hidden p-2 border-b border-border">
              <Button variant="ghost" size="sm" onClick={() => setActive(null)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            </div>
            <div className="flex-1">
              <ChatWindow
                type={active.type}
                currentUserId={user.id}
                otherUserId={active.type === 'dm' ? active.userId : undefined}
                groupId={active.type === 'group' ? active.groupId : undefined}
                title={active.name}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-4">
            <EmptyState
              icon={MessageSquare}
              title="No conversation selected"
              description="Pick a contact or group to start chatting."
            />
          </div>
        )}
      </div>
    </div>
  );
}
