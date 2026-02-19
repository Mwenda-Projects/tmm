import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useGuestStatus } from '@/contexts/GuestContext';
import { supabase } from '@/integrations/supabase/client';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { VideoCall } from '@/components/video/VideoCall';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { EmptyState } from '@/components/EmptyState';
import { notify } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { Users, MessageSquare, FileText, ArrowLeft, Clock, ShieldAlert, Video, Phone } from 'lucide-react';

function GlassCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(
      'relative rounded-[20px] border overflow-hidden backdrop-blur-xl',
      'bg-white/70 dark:bg-white/[0.04]',
      'border-white/60 dark:border-white/[0.08]',
      'shadow-[0_4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_32px_rgba(0,0,0,0.4)]',
      className,
    )}>{children}</div>
  );
}

interface Member { user_id: string; full_name: string | null; email: string; }
interface Post { id: string; title: string; body: string; category: string; created_at: string; }
function getInitials(name: string) { return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2); }

function ActivityBanner({ lastActivity }: { lastActivity: string | null }) {
  const getStatus = () => {
    if (!lastActivity) return { label: 'Quiet', desc: 'No messages for over 24 hours', color: 'bg-zinc-400', text: 'text-muted-foreground' };
    const diff = Date.now() - new Date(lastActivity).getTime();
    if (diff <= 5 * 60 * 1000) return { label: 'Active now', desc: 'Messages in the last 5 minutes', color: 'bg-emerald-500', text: 'text-emerald-500' };
    if (diff <= 24 * 60 * 60 * 1000) return { label: 'Recently active', desc: 'Messages in the last 24h', color: 'bg-amber-500', text: 'text-amber-500' };
    return { label: 'Quiet', desc: 'No messages for over 24 hours', color: 'bg-zinc-400', text: 'text-muted-foreground' };
  };
  const { label, desc, color, text } = getStatus();
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2 w-2 rounded-full shrink-0 ${color}`} />
      <span className={`text-[13px] font-medium ${text}`}>{label}</span>
      <span className="text-[12px] text-muted-foreground">{desc}</span>
    </div>
  );
}

function GuestBanner({ expiresAt }: { expiresAt: Date }) {
  const [remaining, setRemaining] = useState('');
  useEffect(() => {
    const tick = () => {
      const diff = expiresAt.getTime() - Date.now();
      if (diff <= 0) { setRemaining('Expired'); return; }
      setRemaining(`${Math.floor(diff / 3_600_000)}h ${Math.floor((diff % 3_600_000) / 60_000)}m`);
    };
    tick(); const id = setInterval(tick, 30_000); return () => clearInterval(id);
  }, [expiresAt]);
  return (
    <GlassCard className="flex items-center gap-3 p-4 border-amber-500/20">
      <Clock style={{ width: 14, height: 14 }} className="text-amber-500 shrink-0" />
      <p className="text-[12px] text-muted-foreground flex-1">
        <strong className="text-foreground">Read-only mode</strong> — expires in <span className="font-mono font-semibold text-amber-500">{remaining}</span>
      </p>
      <ShieldAlert style={{ width: 13, height: 13 }} className="text-muted-foreground/40 shrink-0" />
    </GlassCard>
  );
}

const CAT: Record<string, string> = {
  scholarship: 'bg-blue-500/10 text-blue-500',
  internship: 'bg-amber-500/10 text-amber-500',
  event: 'bg-rose-500/10 text-rose-500',
  wellness: 'bg-emerald-500/10 text-emerald-500',
  general: 'bg-zinc-500/10 text-zinc-500 dark:text-zinc-400',
};

type TabId = 'chat' | 'video' | 'members' | 'posts';
const TABS: { id: TabId; label: string; icon: typeof MessageSquare }[] = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'video', label: 'Video', icon: Video },
  { id: 'members', label: 'Members', icon: Users },
  { id: 'posts', label: 'Posts', icon: FileText },
];

export default function GroupDetail() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuth();
  const { isGuest, expiresAt } = useGuestStatus();
  const [group, setGroup] = useState<{ id: string; name: string; last_activity: string | null } | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingGroup, setLoadingGroup] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('chat');
  const [activeCall, setActiveCall] = useState<{ targetUserId: string; targetName: string; sessionId: string } | null>(null);

  useEffect(() => {
    if (!groupId || !user) return;
    const fetchAll = async () => {
      const [groupRes, membersRes, postsRes] = await Promise.all([
        supabase.from('groups').select('id, name, last_activity').eq('id', groupId).single(),
        supabase.from('group_members').select('user_id').eq('group_id', groupId),
        supabase.from('thought_posts').select('id, title, body, category, created_at').order('created_at', { ascending: false }).limit(20),
      ]);
      if (groupRes.data) setGroup(groupRes.data);
      if (membersRes.data) {
        const userIds = membersRes.data.map(m => m.user_id);
        if (userIds.length > 0) {
          const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, email').in('user_id', userIds);
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
      const { data, error } = await supabase.from('call_sessions')
        .insert({ caller_id: user.id, receiver_id: targetUserId, status: 'ringing' }).select('id').single();
      if (error) throw error;
      setActiveCall({ targetUserId, targetName, sessionId: data.id });
      notify({ title: 'Calling…', description: `Ringing ${targetName}`, variant: 'info' });
    } catch { notify({ title: 'Call failed', description: 'Could not start video call.', variant: 'error' }); }
  };

  if (!user || !groupId) return null;
  if (activeCall) return <VideoCall currentUserId={user.id} remoteUserId={activeCall.targetUserId} callSessionId={activeCall.sessionId} isCaller={true} remoteName={activeCall.targetName} onEnd={() => setActiveCall(null)} />;
  if (loadingGroup) return <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5] dark:bg-[#0d0d0f]"><div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>;
  if (!group) return <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3"><p className="text-[14px] text-muted-foreground">Group not found.</p><Button asChild variant="outline" size="sm" className="rounded-xl"><Link to="/groups"><ArrowLeft style={{ width: 14, height: 14 }} className="mr-1" /> Back</Link></Button></div>;

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Mesh background */}
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

      <div className="relative z-10 max-w-4xl mx-auto px-6 pt-8 pb-16 space-y-5">
        {/* Header */}
        <div>
          <Link to="/groups" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors mb-4">
            <ArrowLeft style={{ width: 14, height: 14 }} /> Groups
          </Link>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-[28px] font-semibold text-foreground tracking-tight">{group.name}</h1>
              <div className="mt-1.5"><ActivityBanner lastActivity={group.last_activity} /></div>
            </div>
            <span className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground bg-black/[0.04] dark:bg-white/[0.06] px-3 py-1.5 rounded-full border border-black/[0.05] dark:border-white/[0.07] shrink-0">
              <Users style={{ width: 12, height: 12 }} /> {members.length} member{members.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {isGuest && expiresAt && <GuestBanner expiresAt={expiresAt} />}

        {/* Tab bar */}
        <GlassCard className="p-1.5 flex gap-1">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-[14px] text-[13px] font-medium transition-all duration-150',
                activeTab === t.id
                  ? 'bg-white dark:bg-white/[0.09] text-foreground shadow-[0_0_0_1px_rgba(0,0,0,0.06)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08)] shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-black/[0.03] dark:hover:bg-white/[0.04]',
              )}>
              <t.icon style={{ width: 13, height: 13 }} />{t.label}
            </button>
          ))}
        </GlassCard>

        {/* Chat */}
        {activeTab === 'chat' && (
          <GlassCard className="overflow-hidden" style={{ height: 520 }}>
            <ChatWindow type="group" currentUserId={user.id} groupId={groupId} title={group.name} />
          </GlassCard>
        )}

        {/* Video */}
        {activeTab === 'video' && (
          <GlassCard className="p-5">
            <div className="flex items-center gap-2 mb-5">
              <div className="h-7 w-7 rounded-xl bg-primary/10 flex items-center justify-center"><Video style={{ width: 13, height: 13 }} className="text-primary" /></div>
              <h2 className="text-[13px] font-semibold text-foreground">Video Call a Member</h2>
            </div>
            {isGuest ? <EmptyState icon={ShieldAlert} title="Video calls require verification" description="Register with your university email to start video calls." />
              : members.filter(m => m.user_id !== user.id).length === 0 ? <EmptyState icon={Users} title="No other members" description="Invite classmates to join this group." />
              : (
                <div className="space-y-2">
                  {members.filter(m => m.user_id !== user.id).map(m => {
                    const name = m.full_name || m.email;
                    return (
                      <div key={m.user_id} className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.05]">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar className="h-9 w-9 shrink-0"><AvatarFallback className="bg-primary/10 text-primary text-[11px] font-bold">{getInitials(name)}</AvatarFallback></Avatar>
                          <div className="min-w-0">
                            <p className="text-[13px] font-medium text-foreground truncate">{name}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{m.email}</p>
                          </div>
                        </div>
                        <Button size="sm" onClick={() => startVideoCall(m.user_id, name)} className="rounded-xl text-[12px] h-8 gap-1.5 shrink-0">
                          <Phone style={{ width: 12, height: 12 }} /> Call
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
          </GlassCard>
        )}

        {/* Members */}
        {activeTab === 'members' && (
          <GlassCard className="p-5">
            <div className="flex items-center gap-2 mb-5">
              <div className="h-7 w-7 rounded-xl bg-violet-500/10 flex items-center justify-center"><Users style={{ width: 13, height: 13 }} className="text-violet-500" /></div>
              <h2 className="text-[13px] font-semibold text-foreground">Members ({members.length})</h2>
            </div>
            {members.length === 0 ? <p className="text-[13px] text-muted-foreground text-center py-4">No members yet.</p> : (
              <div className="space-y-1">
                {members.map(m => {
                  const name = m.full_name || m.email;
                  const isYou = m.user_id === user.id;
                  return (
                    <div key={m.user_id} className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors">
                      <Avatar className="h-8 w-8 shrink-0"><AvatarFallback className="bg-primary/10 text-primary text-[11px] font-bold">{getInitials(name)}</AvatarFallback></Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-foreground truncate flex items-center gap-1.5">
                          {name}
                          {isYou && <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-full font-semibold">You</span>}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">{m.email}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>
        )}

        {/* Posts */}
        {activeTab === 'posts' && (
          <GlassCard className="p-5">
            <div className="flex items-center gap-2 mb-5">
              <div className="h-7 w-7 rounded-xl bg-amber-500/10 flex items-center justify-center"><FileText style={{ width: 13, height: 13 }} className="text-amber-500" /></div>
              <h2 className="text-[13px] font-semibold text-foreground">Recent Posts</h2>
            </div>
            {posts.length === 0 ? (
              <div className="py-8 text-center">
                <FileText style={{ width: 32, height: 32 }} className="text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-[13px] text-muted-foreground">No posts yet.</p>
              </div>
            ) : (
              <div>
                {posts.map(p => (
                  <div key={p.id} className="flex items-start justify-between gap-3 py-3.5 border-b border-black/[0.05] dark:border-white/[0.05] last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-foreground truncate">{p.title}</p>
                      <p className="text-[12px] text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">{p.body}</p>
                      <p className="text-[11px] text-muted-foreground/50 mt-1">{formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}</p>
                    </div>
                    <span className={`shrink-0 text-[10px] font-semibold px-2.5 py-1 rounded-full mt-0.5 ${CAT[p.category] || CAT.general}`}>{p.category}</span>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        )}
      </div>
    </div>
  );
}