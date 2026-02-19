import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNotifications } from '@/hooks/useNotifications';
import {
  Users, FileText, MessageSquare, Bell, ArrowRight,
  Heart, Calendar, Send, Clock, Sparkles, Video,
  TrendingUp, ChevronRight, Zap,
} from 'lucide-react';
import { RandomVideoChat } from '@/components/video/RandomVideoChat';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/EmptyState';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RecentPost {
  id: string; title: string; category: string;
  created_at: string; authorName?: string; likeCount?: number;
}
interface UpcomingEvent { id: string; title: string; created_at: string; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting(name: string) {
  const h = new Date().getHours();
  const first = name?.split(' ')[0] || 'there';
  if (h < 12) return `Good morning, ${first}.`;
  if (h < 17) return `Good afternoon, ${first}.`;
  return `Good evening, ${first}.`;
}

const CAT: Record<string, { pill: string; dot: string }> = {
  wellness:    { pill: 'bg-emerald-500/15 text-emerald-400', dot: 'bg-emerald-400' },
  scholarship: { pill: 'bg-blue-500/15 text-blue-400',       dot: 'bg-blue-400' },
  internship:  { pill: 'bg-amber-500/15 text-amber-400',     dot: 'bg-amber-400' },
  event:       { pill: 'bg-rose-500/15 text-rose-400',       dot: 'bg-rose-400' },
  general:     { pill: 'bg-white/10 text-white/50',          dot: 'bg-white/30' },
};
const getCat = (c: string) => CAT[c] || CAT.general;

// ─── Animated counter ─────────────────────────────────────────────────────────

function AnimNum({ value }: { value: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!value) return;
    let i = 0;
    const inc = value / 20;
    const t = setInterval(() => {
      i += inc;
      if (i >= value) { setN(value); clearInterval(t); }
      else setN(Math.floor(i));
    }, 30);
    return () => clearInterval(t);
  }, [value]);
  return <>{n}</>;
}

// ─── Glass Card ───────────────────────────────────────────────────────────────

function GlassCard({ children, className = '', hover = true }: {
  children: React.ReactNode; className?: string; hover?: boolean;
}) {
  return (
    <div className={`
      relative rounded-[20px] border overflow-hidden
      bg-white/70 dark:bg-white/[0.04]
      border-white/60 dark:border-white/[0.08]
      shadow-[0_4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_32px_rgba(0,0,0,0.4)]
      backdrop-blur-xl
      ${hover ? 'transition-all duration-200 hover:shadow-[0_8px_32px_rgba(0,0,0,0.10)] dark:hover:shadow-[0_8px_40px_rgba(0,0,0,0.5)] hover:border-white/80 dark:hover:border-white/[0.12]' : ''}
      ${className}
    `}>
      {children}
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, value, label, sub, href, iconBg, iconColor }: {
  icon: typeof Users; value: number; label: string; sub?: string;
  href: string; iconBg: string; iconColor: string;
}) {
  return (
    <Link to={href} className="group">
      <GlassCard className="p-5 flex flex-col gap-4 min-h-[130px] justify-between">
        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${iconBg}`}>
          <Icon style={{ width: 18, height: 18 }} className={iconColor} />
        </div>
        <div>
          <p className="text-[32px] font-semibold text-foreground leading-none tracking-tight">
            <AnimNum value={value} />
          </p>
          <p className="text-[13px] text-muted-foreground mt-1 font-medium">{label}</p>
          {sub && <p className="text-[11px] text-muted-foreground/50 mt-0.5">{sub}</p>}
        </div>
        <ArrowRight
          style={{ width: 14, height: 14 }}
          className="absolute bottom-4 right-4 text-muted-foreground/0 group-hover:text-muted-foreground/40 transition-all group-hover:translate-x-0.5"
        />
      </GlassCard>
    </Link>
  );
}

// ─── Post Row ─────────────────────────────────────────────────────────────────

function PostRow({ post }: { post: RecentPost }) {
  const cat = getCat(post.category);
  return (
    <Link to="/posts"
      className="group flex items-center gap-3 py-3 border-b border-black/5 dark:border-white/5 last:border-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] -mx-5 px-5 rounded-xl transition-colors">
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${cat.dot}`} />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-foreground group-hover:text-primary transition-colors truncate">{post.title}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-[11px] text-muted-foreground">{post.authorName}</span>
          <span className="text-muted-foreground/30 text-[10px]">·</span>
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Clock style={{ width: 10, height: 10 }} />
            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
          </span>
          {(post.likeCount ?? 0) > 0 && (
            <>
              <span className="text-muted-foreground/30 text-[10px]">·</span>
              <span className="text-[11px] text-rose-400 flex items-center gap-0.5">
                <Heart style={{ width: 10, height: 10 }} className="fill-rose-400" /> {post.likeCount}
              </span>
            </>
          )}
        </div>
      </div>
      <span className={`shrink-0 text-[10px] font-semibold px-2.5 py-1 rounded-full ${cat.pill}`}>
        {post.category}
      </span>
    </Link>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, action }: {
  icon: typeof FileText; title: string; action?: { label: string; href: string };
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Icon style={{ width: 14, height: 14 }} className="text-muted-foreground" />
        <h2 className="text-[13px] font-semibold text-foreground tracking-tight">{title}</h2>
      </div>
      {action && (
        <Link to={action.href} className="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-primary transition-colors">
          {action.label} <ArrowRight style={{ width: 11, height: 11 }} />
        </Link>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Index() {
  const { user } = useAuth();
  const { unreadCount } = useNotifications(user?.id);
  const { toast } = useToast();

  const [stats, setStats] = useState({ groupsJoined: 0, newPosts: 0, newMessages: 0 });
  const [recentPosts, setRecentPosts] = useState<RecentPost[]>([]);
  const [events, setEvents] = useState<UpcomingEvent[]>([]);
  const [fullName, setFullName] = useState('');
  const [userGroups, setUserGroups] = useState<{ group_id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [quickPost, setQuickPost] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const ago24 = new Date(Date.now() - 86400000).toISOString();
      const [grpRes, postsRes, msgsRes, recentRes, eventsRes, profileRes, grpNamesRes] = await Promise.all([
        supabase.from('group_members').select('group_id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('thought_posts').select('id', { count: 'exact', head: true }).gte('created_at', ago24),
        supabase.from('messages').select('id', { count: 'exact', head: true }).eq('receiver_id', user.id).gte('created_at', ago24),
        supabase.from('thought_posts').select('id, title, category, created_at, user_id').order('created_at', { ascending: false }).limit(6),
        supabase.from('thought_posts').select('id, title, created_at').eq('category', 'event').order('created_at', { ascending: false }).limit(4),
        supabase.from('profiles').select('full_name').eq('user_id', user.id).single(),
        supabase.from('group_members').select('group_id, groups(name)').eq('user_id', user.id).limit(5),
      ]);

      const posts = recentRes.data ?? [];
      let enriched: RecentPost[] = posts;
      if (posts.length) {
        const uids = [...new Set(posts.map(p => p.user_id))];
        const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', uids);
        const pmap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);
        const likes = await Promise.all(posts.map(p =>
          (supabase as any).from('post_likes').select('id', { count: 'exact', head: true }).eq('post_id', p.id)
        ));
        enriched = posts.map((p, i) => ({
          ...p, authorName: pmap.get(p.user_id) || 'Unknown', likeCount: likes[i]?.count ?? 0,
        }));
      }

      setStats({ groupsJoined: grpRes.count ?? 0, newPosts: postsRes.count ?? 0, newMessages: msgsRes.count ?? 0 });
      setRecentPosts(enriched);
      setEvents(eventsRes.data ?? []);
      setFullName(profileRes.data?.full_name || '');
      setUserGroups((grpNamesRes.data ?? []).map((g: any) => ({ group_id: g.group_id, name: g.groups?.name || 'Group' })));
      setLoading(false);
    };
    load();
  }, [user]);

  const handleQuickPost = async () => {
    if (!quickPost.trim() || !user) return;
    setPosting(true);
    const { error } = await supabase.from('thought_posts').insert({
      user_id: user.id, title: quickPost.trim().slice(0, 80), body: quickPost.trim(), category: 'general',
    });
    if (error) toast({ title: 'Error', variant: 'destructive' });
    else { toast({ title: 'Posted.' }); setQuickPost(''); }
    setPosting(false);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen relative overflow-hidden">

      {/* ── GRADIENT MESH BACKGROUND ─────────────────── */}
      {/* Light mode mesh */}
      <div className="fixed inset-0 dark:hidden pointer-events-none">
        <div className="absolute inset-0 bg-[#f0f2f5]" />
        <div className="absolute top-[-200px] left-[-100px] w-[600px] h-[600px] rounded-full blur-[120px] opacity-60"
          style={{ background: 'radial-gradient(circle, #dbeafe, transparent)' }} />
        <div className="absolute top-[100px] right-[-100px] w-[500px] h-[500px] rounded-full blur-[120px] opacity-50"
          style={{ background: 'radial-gradient(circle, #ede9fe, transparent)' }} />
        <div className="absolute bottom-[-100px] left-[30%] w-[500px] h-[400px] rounded-full blur-[120px] opacity-40"
          style={{ background: 'radial-gradient(circle, #dcfce7, transparent)' }} />
      </div>
      {/* Dark mode mesh */}
      <div className="fixed inset-0 hidden dark:block pointer-events-none">
        <div className="absolute inset-0 bg-[#0d0d0f]" />
        <div className="absolute top-[-200px] left-[-100px] w-[700px] h-[700px] rounded-full blur-[160px] opacity-30"
          style={{ background: 'radial-gradient(circle, #312e81, transparent)' }} />
        <div className="absolute top-[200px] right-[-100px] w-[500px] h-[500px] rounded-full blur-[140px] opacity-20"
          style={{ background: 'radial-gradient(circle, #134e4a, transparent)' }} />
        <div className="absolute bottom-[-50px] left-[40%] w-[600px] h-[400px] rounded-full blur-[140px] opacity-25"
          style={{ background: 'radial-gradient(circle, #1e1b4b, transparent)' }} />
      </div>

      {/* ── CONTENT ──────────────────────────────────── */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 pt-10 pb-16 space-y-4">

        {/* ── HEADER ── */}
        <div className="flex items-end justify-between gap-6 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-[11px] font-medium text-muted-foreground tracking-widest uppercase">Live</span>
            </div>
            <h1 className="text-[38px] font-semibold text-foreground tracking-tight leading-none">
              {getGreeting(fullName)}
            </h1>
            <p className="text-[14px] text-muted-foreground mt-2">
              {new Date().toLocaleDateString('en-KE', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <Link to="/posts"
            className="hidden sm:flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-primary transition-colors shrink-0 mb-1">
            Browse Posts <ArrowRight style={{ width: 13, height: 13 }} />
          </Link>
        </div>

        {/* ── STAT CARDS ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={Users}         value={stats.groupsJoined} label="Groups"        href="/groups"   iconBg="bg-primary/10"        iconColor="text-primary" />
          <StatCard icon={FileText}      value={stats.newPosts}     label="New Posts"     sub="last 24h"  href="/posts"    iconBg="bg-emerald-500/10"    iconColor="text-emerald-500" />
          <StatCard icon={MessageSquare} value={stats.newMessages}  label="Messages"      sub="last 24h"  href="/messages" iconBg="bg-amber-500/10"      iconColor="text-amber-500" />
          <StatCard icon={Bell}          value={unreadCount}        label="Notifications" href="/settings" iconBg="bg-rose-500/10"        iconColor="text-rose-500" />
        </div>

        {/* ── ROW 1: Quick Post + Groups ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

          {/* Quick Post */}
          <GlassCard className="lg:col-span-3 p-5 space-y-3" hover={false}>
            <div className="flex items-center gap-2">
              <Zap style={{ width: 13, height: 13 }} className="text-amber-500" />
              <h2 className="text-[13px] font-semibold text-foreground">Share a Thought</h2>
            </div>
            <Textarea
              value={quickPost}
              onChange={e => setQuickPost(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleQuickPost(); }}
              placeholder="What's on your mind?"
              rows={3}
              className="resize-none text-[13px] bg-black/[0.03] dark:bg-white/[0.04] border-black/10 dark:border-white/[0.08] rounded-xl placeholder:text-muted-foreground/40 focus:bg-background transition-colors"
            />
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground/40">Posts as General · ⌘↵</p>
              <Button size="sm" onClick={handleQuickPost} disabled={!quickPost.trim() || posting}
                className="rounded-xl h-8 px-4 text-[12px] gap-1.5">
                <Send style={{ width: 11, height: 11 }} />
                {posting ? 'Posting…' : 'Post'}
              </Button>
            </div>
          </GlassCard>

          {/* Your Groups */}
          <GlassCard className="lg:col-span-2 p-5" hover={false}>
            <SectionHeader icon={Users} title="Your Groups" action={{ label: 'All', href: '/groups' }} />
            {userGroups.length === 0 ? (
              <div className="flex flex-col items-center py-4 gap-2">
                <p className="text-[13px] text-muted-foreground">No groups yet.</p>
                <Link to="/groups" className="text-[12px] text-primary hover:underline">Explore groups →</Link>
              </div>
            ) : (
              <ul className="space-y-0.5">
                {userGroups.map(g => (
                  <li key={g.group_id}>
                    <Link to="/groups"
                      className="flex items-center gap-3 py-2 px-2 -mx-2 rounded-xl hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors group">
                      <div className="h-7 w-7 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-[11px] font-bold text-primary">{g.name[0]?.toUpperCase()}</span>
                      </div>
                      <span className="text-[13px] text-foreground truncate flex-1">{g.name}</span>
                      <ChevronRight style={{ width: 13, height: 13 }} className="text-muted-foreground/0 group-hover:text-muted-foreground/40 shrink-0 transition-colors" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </GlassCard>
        </div>

        {/* ── ROW 2: Recent Posts + Side ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

          {/* Recent Posts */}
          <GlassCard className="lg:col-span-3 p-5" hover={false}>
            <SectionHeader icon={FileText} title="Recent Posts" action={{ label: 'View all', href: '/posts' }} />
            {recentPosts.length === 0
              ? <EmptyState icon={Sparkles} title="No posts yet" description="Be the first to share!" />
              : <div>{recentPosts.map(p => <PostRow key={p.id} post={p} />)}</div>
            }
          </GlassCard>

          {/* Side column */}
          <div className="lg:col-span-2 space-y-4">

            {/* Events */}
            <GlassCard className="p-5" hover={false}>
              <SectionHeader icon={Calendar} title="Events" action={{ label: 'See all', href: '/posts' }} />
              {events.length === 0 ? (
                <p className="text-[13px] text-muted-foreground text-center py-2">No events yet.</p>
              ) : (
                <ul className="space-y-3">
                  {events.map(e => (
                    <li key={e.id}>
                      <Link to="/posts" className="group block">
                        <p className="text-[13px] font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2">{e.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Clock style={{ width: 10, height: 10 }} />
                          {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </GlassCard>

            {/* Quick Nav */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Scholarships', href: '/posts',     icon: Sparkles,       bg: 'bg-blue-500/10   dark:bg-blue-500/10',   color: 'text-blue-500' },
                { label: 'Internships',  href: '/posts',     icon: TrendingUp,     bg: 'bg-amber-500/10  dark:bg-amber-500/10',  color: 'text-amber-500' },
                { label: 'Wellness',     href: '/wellness',  icon: Heart,          bg: 'bg-emerald-500/10 dark:bg-emerald-500/10',color: 'text-emerald-500' },
                { label: 'Messages',     href: '/messages',  icon: MessageSquare,  bg: 'bg-violet-500/10 dark:bg-violet-500/10', color: 'text-violet-500' },
              ].map(item => (
                <Link key={item.label} to={item.href}>
                  <GlassCard className={`p-4 flex flex-col gap-3 ${item.bg}`}>
                    <item.icon style={{ width: 16, height: 16 }} className={item.color} />
                    <span className="text-[12px] font-semibold text-foreground">{item.label}</span>
                  </GlassCard>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* ── ROW 3: Video Chat ── */}
        <GlassCard hover={false}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.05] dark:border-white/[0.05]">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <Video style={{ width: 15, height: 15 }} className="text-primary" />
              </div>
              <div>
                <h2 className="text-[13px] font-semibold text-foreground">Random Video Chat</h2>
                <p className="text-[11px] text-muted-foreground">Get matched with a student from another university</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-[12px] font-medium text-emerald-500">Live</span>
            </div>
          </div>
          <div className="p-5">
            <RandomVideoChat />
          </div>
        </GlassCard>

      </div>
    </div>
  );
}