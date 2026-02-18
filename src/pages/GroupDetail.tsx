import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useGuestStatus } from '@/contexts/GuestContext';
import { supabase } from '@/integrations/supabase/client';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { VideoCall } from '@/components/video/VideoCall';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/EmptyState';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { notify } from '@/lib/notify';
import {
  Users, MessageSquare, FileText, ArrowLeft, Clock, ShieldAlert,
  Video, Phone, PhoneOff,
} from 'lucide-react';

function ActivityBanner({ lastActivity }: { lastActivity: string | null }) {
  const getStatus = () => {
    if (!lastActivity) return { label: 'Quiet', desc: 'No recent messages', color: 'bg-muted-foreground', textColor: 'text-muted-foreground' };
    const diff = Date.now() - new Date(lastActivity).getTime();
    if (diff <= 5 * 60 * 1000) return { label: 'Active Now', desc: 'Messages in the last 5 minutes', color: 'bg-green-500', textColor: 'text-green-600 dark:text-green-400' };
    if (diff <= 24 * 60 * 60 * 1000) return { label: 'Recently Active', desc: 'Messages in the last 24 hours', color: 'bg-amber-500', textColor: 'text-amber-600 dark:text-amber-400' };
    return { label: 'Quiet', desc: 'No messages for over 24 hours', color: 'bg-muted-foreground', textColor: 'text-muted-foreground' };
  };
  const { label, desc, color, textColor } = getStatus();
  return (
    <div className="flex items-center gap-2.5">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      <div>
        <span className={`text-sm font-medium ${textColor}`}>{label}</span>
        <span className="text-xs text-muted-foreground ml-2">{desc}</span>
      </div>
    </div>
  );
}

function GuestCountdownBanner({ expiresAt }: { expiresAt: Date }) {
  const [remaining, setRemaining] = useState('');
  useEffect(() => {
    const tick = () => {
      const diff = expiresAt.getTime() - Date.now();
      if (diff <= 0) { setRemaining('Expired'); return; }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      setRemaining(`${h}h ${m}m`);
    };
    tick();
    const interval = setInterval(tick, 30_000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 p-3">
      <Clock className="h-4 w-4 text-amber-500 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">Read-only mode</strong> — Guest session expires in{' '}
          <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">{remaining}</span>
        </p>
      </div>
      <ShieldAlert className="h-4 w-4 text-muted-foreground/50 shrink-0" />
    </div>
  );
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

interface Member {
  user_id: string;
  full_name: string | null;
  email: string;
}

interface Post {
  id: string;
  title: string;
  body: string;
  category: string;
  created_at: string;
}

export default function GroupDetail() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuth();
  const { isGuest, expiresAt } = useGuestStatus();

  const [group, setGroup] = useState<{ id: string; name: string; last_activity: string | null } | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingGroup, setLoadingGroup] = useState(true);
  const [activeCall, setActiveCall] = useState<{
    targetUserId: string;
    targetName: string;
    sessionId: string;
  } | null>(null);

  useEffect(() => {
    if (!groupId || !user) return;

    const fetchAll = async () => {
      const [groupRes, membersRes, postsRes] = await Promise.all([
        supabase.from('groups').select('id, name, last_activity').eq('id', groupId).single(),
        supabase
          .from('group_members')
          .select('user_id')
          .eq('group_id', groupId),
        supabase
          .from('thought_posts')
          .select('id, title, body, category, created_at')
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      if (groupRes.data) setGroup(groupRes.data);

      if (membersRes.data) {
        // Fetch profiles for members
        const userIds = membersRes.data.map(m => m.user_id);
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, full_name, email')
            .in('user_id', userIds);
          if (profiles) setMembers(profiles);
        }
      }

      if (postsRes.data) setPosts(postsRes.data as Post[]);
      setLoadingGroup(false);
    };

    fetchAll();
  }, [groupId, user]);

  const startVideoCall = async (targetUserId: string, targetName: string) => {
    if (!user || isGuest) return;
    try {
      const { data, error } = await supabase.from('call_sessions').insert({
        caller_id: user.id,
        receiver_id: targetUserId,
        status: 'ringing',
      }).select('id').single();

      if (error) throw error;
      setActiveCall({ targetUserId, targetName, sessionId: data.id });
      notify({ title: 'Calling…', description: `Ringing ${targetName}`, variant: 'info' });
    } catch {
      notify({ title: 'Call failed', description: 'Could not start video call.', variant: 'error' });
    }
  };

  if (!user || !groupId) return null;

  if (loadingGroup) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading group…</p>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <p className="text-sm text-muted-foreground">Group not found.</p>
        <Button asChild variant="outline" size="sm">
          <Link to="/groups"><ArrowLeft className="h-4 w-4 mr-1" /> Back to Groups</Link>
        </Button>
      </div>
    );
  }

  // Active video call overlay
  if (activeCall && user) {
    return (
      <VideoCall
        currentUserId={user.id}
        remoteUserId={activeCall.targetUserId}
        callSessionId={activeCall.sessionId}
        isCaller={true}
        remoteName={activeCall.targetName}
        onEnd={() => setActiveCall(null)}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
      {/* Back link + Header */}
      <div className="space-y-3">
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
          <Link to="/groups"><ArrowLeft className="h-4 w-4 mr-1" /> Groups</Link>
        </Button>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{group.name}</h1>
            <div className="mt-1">
              <ActivityBanner lastActivity={group.last_activity} />
            </div>
          </div>
          <Badge variant="secondary" className="shrink-0">
            <Users className="h-3 w-3 mr-1" />
            {members.length} member{members.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      </div>

      {/* Guest banner */}
      {isGuest && expiresAt && <GuestCountdownBanner expiresAt={expiresAt} />}

      {/* Tabs: Chat / Video / Members / Posts */}
      <Tabs defaultValue="chat" className="space-y-4">
        <TabsList>
          <TabsTrigger value="chat" className="gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" /> Chat
          </TabsTrigger>
          <TabsTrigger value="video" className="gap-1.5">
            <Video className="h-3.5 w-3.5" /> Video
          </TabsTrigger>
          <TabsTrigger value="members" className="gap-1.5">
            <Users className="h-3.5 w-3.5" /> Members
          </TabsTrigger>
          <TabsTrigger value="posts" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Posts
          </TabsTrigger>
        </TabsList>

        {/* Chat tab */}
        <TabsContent value="chat" className="mt-0">
          <Card className="border-border overflow-hidden">
            <div className="h-[500px]">
              <ChatWindow
                type="group"
                currentUserId={user.id}
                groupId={groupId}
                title={group.name}
              />
            </div>
          </Card>
        </TabsContent>

        {/* Video tab */}
        <TabsContent value="video" className="mt-0">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Video className="h-4 w-4" /> Video Call a Member
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isGuest ? (
                <EmptyState
                  icon={ShieldAlert}
                  title="Video calls require verification"
                  description="Register with your university email to start video calls."
                />
              ) : members.filter(m => m.user_id !== user.id).length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No other members"
                  description="Invite classmates to join this group to start video chatting."
                />
              ) : (
                <ScrollArea className="max-h-[400px]">
                  <div className="space-y-1">
                    {members
                      .filter(m => m.user_id !== user.id)
                      .map((m) => {
                        const name = m.full_name || m.email;
                        return (
                          <div
                            key={m.user_id}
                            className="flex items-center justify-between gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <Avatar className="h-9 w-9">
                                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                                  {getInitials(name)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">{name}</p>
                                <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => startVideoCall(m.user_id, name)}
                              className="shrink-0 gap-1.5"
                            >
                              <Phone className="h-3.5 w-3.5" />
                              Call
                            </Button>
                          </div>
                        );
                      })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Members tab */}
        <TabsContent value="members" className="mt-0">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Members ({members.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {members.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No members yet.</p>
              ) : (
                <ScrollArea className="max-h-[400px]">
                  <div className="space-y-1">
                    {members.map((m) => {
                      const name = m.full_name || m.email;
                      return (
                        <div key={m.user_id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent/50 transition-colors">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                              {getInitials(name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{name}</p>
                            <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Posts tab */}
        <TabsContent value="posts" className="mt-0">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recent Posts</CardTitle>
            </CardHeader>
            <CardContent>
              {posts.length === 0 ? (
                <div className="py-8 text-center">
                  <FileText className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">No posts yet.</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[400px]">
                  <ul className="divide-y divide-border">
                    {posts.map((p) => (
                      <li key={p.id} className="py-3 first:pt-0 last:pb-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{p.title}</p>
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{p.body}</p>
                          </div>
                          <Badge variant="secondary" className="shrink-0 text-[10px]">
                            {p.category}
                          </Badge>
                        </div>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
