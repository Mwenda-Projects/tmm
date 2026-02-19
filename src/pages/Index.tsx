import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNotifications } from '@/hooks/useNotifications';
import {
  Users, FileText, MessageSquare, Bell, ArrowRight,
  Sparkles, Heart, Calendar, TrendingUp, Send, Clock, Zap,
} from 'lucide-react';
import { RandomVideoChat } from '@/components/video/RandomVideoChat';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

// ─── Kenyan Universities ──────────────────────────────────────────────────────

const KENYAN_UNIVERSITIES = [
  { name: 'University of Nairobi', domain: 'uonbi.ac.ke', short: 'UoN' },
  { name: 'Kenyatta University', domain: 'ku.ac.ke', short: 'KU' },
  { name: 'Strathmore University', domain: 'strathmore.edu', short: 'SU' },
  { name: 'JKUAT', domain: 'jkuat.ac.ke', short: 'JKUAT' },
  { name: 'Moi University', domain: 'mu.ac.ke', short: 'MU' },
  { name: 'Technical Univ. Kenya', domain: 'tukenya.ac.ke', short: 'TUK' },
  { name: 'Egerton University', domain: 'egerton.ac.ke', short: 'EU' },
  { name: 'Maseno University', domain: 'maseno.ac.ke', short: 'MU' },
  { name: 'Kisii University', domain: 'kisii.ac.ke', short: 'KSU' },
  { name: 'Dedan Kimathi Univ.', domain: 'dkut.ac.ke', short: 'DeKUT' },
  { name: 'Multimedia University', domain: 'mmu.ac.ke', short: 'MMU' },
  { name: 'Daystar University', domain: 'daystar.ac.ke', short: 'DU' },
  { name: 'USIU Africa', domain: 'usiu.ac.ke', short: 'USIU' },
  { name: 'Mt. Kenya University', domain: 'mku.ac.ke', short: 'MKU' },
  { name: 'Catholic Univ. E.Africa', domain: 'cuea.edu', short: 'CUEA' },
  { name: 'Pwani University', domain: 'pu.ac.ke', short: 'PU' },
  { name: 'Laikipia University', domain: 'laikipia.ac.ke', short: 'LU' },
  { name: 'Chuka University', domain: 'chuka.ac.ke', short: 'CU' },
  { name: 'South Eastern Kenya Univ.', domain: 'seku.ac.ke', short: 'SEKU' },
  { name: 'Kirinyaga University', domain: 'kyu.ac.ke', short: 'KYU' },
];

// ─── University Logo Item ─────────────────────────────────────────────────────

function UniversityLogoItem({ uni }: { uni: typeof KENYAN_UNIVERSITIES[0] }) {
  const [imgFailed, setImgFailed] = useState(false);
  const logoUrl = `https://www.google.com/s2/favicons?domain=${uni.domain}&sz=64`;

  return (
    <div className="flex flex-col items-center gap-2 py-3 px-2 group">
      <div className="h-12 w-12 rounded-xl bg-muted/40 border border-border flex items-center justify-center overflow-hidden group-hover:border-primary/30 group-hover:bg-primary/5 transition-all duration-300">
        {!imgFailed ? (
          <img
            src={logoUrl}
            alt={uni.name}
            className="h-8 w-8 object-contain"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <span className="text-[10px] font-bold text-muted-foreground text-center leading-tight px-1">
            {uni.short}
          </span>
        )}
      </div>
      <span className="text-[9px] text-muted-foreground/60 text-center leading-tight max-w-[72px] truncate">
        {uni.short}
      </span>
    </div>
  );
}

// ─── Vertical Marquee Column ──────────────────────────────────────────────────

function VerticalMarquee({ direction = 'down' }: { direction?: 'up' | 'down' }) {
  // Duplicate list for seamless loop
  const doubled = [...KENYAN_UNIVERSITIES, ...KENYAN_UNIVERSITIES];

  return (
    <div className="relative h-full overflow-hidden">
      {/* Top fade */}
      <div className="absolute top-0 left-0 right-0 h-16 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, var(--background), transparent)' }} />
      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-16 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to top, var(--background), transparent)' }} />

      <div
        className="flex flex-col"
        style={{
          animation: `marquee-${direction} ${direction === 'down' ? '35s' : '40s'} linear infinite`,
        }}
      >
        {doubled.map((uni, i) => (
          <UniversityLogoItem key={`${uni.domain}-${i}`} uni={uni} />
        ))}
      </div>

      <style>{`
        @keyframes marquee-down {
          0% { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
        @keyframes marquee-up {
          0% { transform: translateY(-50%); }
          100% { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting(name: string) {
  const hour = new Date().getHours();
  const first = name?.split(' ')[0] || 'there';
  if (hour < 12) return `Good morning, ${first} 👋`;
  if (hour < 17) return `Good afternoon, ${first} 👋`;
  return `Good evening, ${first} 👋`;
}

function getCategoryStyle(category: string) {
  switch (category) {
    case 'scholarship': return 'bg-primary/10 text-primary';
    case 'internship': return 'bg-accent text-accent-foreground';
    case 'event': return 'bg-destructive/10 text-destructive';
    case 'wellness': return 'bg-green-500/10 text-green-600 dark:text-green-400';
    default: return 'bg-muted text-muted-foreground';
  }
}

function StatCard({ icon: Icon, label, sublabel, value, href, accent, trend }: {
  icon: typeof Users; label: string; sublabel?: string;
  value: number; href: string; accent: string; trend?: 'up';
}) {
  return (
    <Link to={href}>
      <Card className="group hover:shadow-md transition-all cursor-pointer border-border hover:border-primary/30">
        <CardContent className="flex items-center gap-3 p-4">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${accent}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <p className="text-xl font-bold text-foreground">{value}</p>
              {trend && value > 0 && <TrendingUp className="h-3 w-3 text-green-500" />}
            </div>
            <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
            {sublabel && <p className="text-[10px] text-muted-foreground/60">{sublabel}</p>}
          </div>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </CardContent>
      </Card>
    </Link>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardStats { groupsJoined: number; newPosts: number; newMessages: number; }
interface RecentPost { id: string; title: string; category: string; created_at: string; authorName?: string; likeCount?: number; }
interface UpcomingEvent { id: string; title: string; created_at: string; }

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Index() {
  const { user } = useAuth();
  const { unreadCount } = useNotifications(user?.id);
  const { toast } = useToast();

  const [stats, setStats] = useState<DashboardStats>({ groupsJoined: 0, newPosts: 0, newMessages: 0 });
  const [loading, setLoading] = useState(true);
  const [recentPosts, setRecentPosts] = useState<RecentPost[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [fullName, setFullName] = useState('');
  const [quickPost, setQuickPost] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchAll = async () => {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const [groupsRes, postsRes, msgsRes, recentPostsRes, eventsRes, profileRes] = await Promise.all([
        supabase.from('group_members').select('group_id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('thought_posts').select('id', { count: 'exact', head: true }).gte('created_at', twentyFourHoursAgo),
        supabase.from('messages').select('id', { count: 'exact', head: true }).eq('receiver_id', user.id).gte('created_at', twentyFourHoursAgo),
        supabase.from('thought_posts').select('id, title, category, created_at, user_id').order('created_at', { ascending: false }).limit(5),
        supabase.from('thought_posts').select('id, title, created_at').eq('category', 'event').order('created_at', { ascending: false }).limit(3),
        supabase.from('profiles').select('full_name').eq('user_id', user.id).single(),
      ]);

      const posts = recentPostsRes.data ?? [];
      let enrichedPosts: RecentPost[] = posts;
      if (posts.length > 0) {
        const userIds = [...new Set(posts.map(p => p.user_id))];
        const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds);
        const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);
        const likeCounts = await Promise.all(
          posts.map(p => (supabase as any).from('post_likes').select('id', { count: 'exact', head: true }).eq('post_id', p.id))
        );
        enrichedPosts = posts.map((p, i) => ({
          ...p,
          authorName: profileMap.get(p.user_id) || 'Unknown',
          likeCount: likeCounts[i]?.count ?? 0,
        }));
      }

      setStats({ groupsJoined: groupsRes.count ?? 0, newPosts: postsRes.count ?? 0, newMessages: msgsRes.count ?? 0 });
      setRecentPosts(enrichedPosts);
      setUpcomingEvents(eventsRes.data ?? []);
      setFullName(profileRes.data?.full_name || '');
      setLoading(false);
    };
    fetchAll();
  }, [user]);

  const handleQuickPost = async () => {
    if (!quickPost.trim() || !user) return;
    setPosting(true);
    const { error } = await supabase.from('thought_posts').insert({
      user_id: user.id, title: quickPost.trim().slice(0, 80), body: quickPost.trim(), category: 'general',
    });
    if (error) {
      toast({ title: 'Error', description: 'Could not post.', variant: 'destructive' });
    } else {
      toast({ title: 'Posted!', description: 'Your thought has been shared.' });
      setQuickPost('');
    }
    setPosting(false);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[80px_1fr_80px] gap-4">
          <div className="hidden lg:block" />
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[1,2,3,4].map(i => (
                <Card key={i} className="animate-pulse border-border">
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="h-10 w-10 rounded-lg bg-muted shrink-0" />
                    <div className="space-y-2 flex-1">
                      <div className="h-5 w-10 bg-muted rounded" />
                      <div className="h-3 w-16 bg-muted rounded" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <LoadingSkeleton count={3} variant="card" />
          </div>
          <div className="hidden lg:block" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-[88px_1fr_88px] gap-2 items-start">

        {/* ── Left Marquee ── */}
        <div className="hidden lg:block sticky top-8" style={{ height: 'calc(100vh - 4rem)' }}>
          <VerticalMarquee direction="down" />
        </div>

        {/* ── Main Content ── */}
        <main className="space-y-6 min-w-0 px-2">

          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{getGreeting(fullName)}</h1>
              <p className="text-sm text-muted-foreground mt-1">Here's what's happening on TellMeMore</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-green-600 dark:text-green-400 font-medium">Online</span>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard icon={Users} label="Groups Joined" value={stats.groupsJoined} href="/groups" accent="bg-primary/10 text-primary" />
            <StatCard icon={FileText} label="New Posts" sublabel="last 24h" value={stats.newPosts} href="/posts" accent="bg-green-500/10 text-green-600 dark:text-green-400" trend="up" />
            <StatCard icon={MessageSquare} label="New Messages" sublabel="last 24h" value={stats.newMessages} href="/messages" accent="bg-amber-500/10 text-amber-600 dark:text-amber-400" trend="up" />
            <StatCard icon={Bell} label="Notifications" sublabel="unread" value={unreadCount} href="/settings" accent="bg-destructive/10 text-destructive" />
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm"><Link to="/groups"><Users className="h-4 w-4 mr-1.5" />Explore Groups</Link></Button>
            <Button asChild variant="outline" size="sm"><Link to="/posts"><FileText className="h-4 w-4 mr-1.5" />Browse Posts</Link></Button>
            <Button asChild variant="outline" size="sm"><Link to="/messages"><MessageSquare className="h-4 w-4 mr-1.5" />Open Messages</Link></Button>
            <Button asChild variant="outline" size="sm"><Link to="/wellness"><Heart className="h-4 w-4 mr-1.5" />Wellness</Link></Button>
          </div>

          {/* Quick Post */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" /> Share a Thought
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={quickPost}
                onChange={e => setQuickPost(e.target.value)}
                placeholder="What's on your mind? Share with your peers..."
                rows={2}
                className="resize-none text-sm"
              />
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-muted-foreground">Posts as a General Thought</p>
                <Button size="sm" onClick={handleQuickPost} disabled={!quickPost.trim() || posting} className="gap-1.5">
                  <Send className="h-3.5 w-3.5" />
                  {posting ? 'Posting...' : 'Post'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent Posts + Events */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-border md:col-span-2">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-semibold">Recent Posts</CardTitle>
                <Button asChild variant="ghost" size="sm" className="text-xs text-muted-foreground h-7">
                  <Link to="/posts">View all <ArrowRight className="h-3 w-3 ml-1" /></Link>
                </Button>
              </CardHeader>
              <CardContent>
                {recentPosts.length === 0 ? (
                  <EmptyState icon={Sparkles} title="No posts yet" description="Be the first to share something!" />
                ) : (
                  <ul className="divide-y divide-border">
                    {recentPosts.map(post => (
                      <li key={post.id} className="py-3 first:pt-0 last:pb-0">
                        <Link to="/posts" className="group flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground truncate group-hover:underline">{post.title}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-[11px] text-muted-foreground">{post.authorName}</span>
                              <span className="text-muted-foreground/40">·</span>
                              <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                                <Clock className="h-3 w-3" />
                                {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                              </span>
                              {(post.likeCount ?? 0) > 0 && (
                                <>
                                  <span className="text-muted-foreground/40">·</span>
                                  <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                                    <Heart className="h-3 w-3" /> {post.likeCount}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <Badge variant="secondary" className={`shrink-0 text-[10px] ${getCategoryStyle(post.category)}`}>
                            {post.category}
                          </Badge>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-destructive" /> Events
                </CardTitle>
                <Button asChild variant="ghost" size="sm" className="text-xs text-muted-foreground h-7">
                  <Link to="/posts">See all</Link>
                </Button>
              </CardHeader>
              <CardContent>
                {upcomingEvents.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No events posted yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {upcomingEvents.map(event => (
                      <li key={event.id}>
                        <Link to="/posts" className="group block">
                          <p className="text-sm font-medium text-foreground group-hover:underline truncate">{event.title}</p>
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                          </p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Random Video Chat */}
          <RandomVideoChat />

          {/* Bottom horizontal marquee for mobile */}
          <div className="lg:hidden overflow-hidden rounded-xl border border-border bg-muted/20 py-3">
            <p className="text-[10px] text-muted-foreground text-center mb-2 uppercase tracking-wider">
              Kenyan Universities on TellMeMore
            </p>
            <div className="flex gap-4 overflow-hidden">
              <div className="flex gap-4 animate-[marquee-right_20s_linear_infinite] shrink-0">
                {[...KENYAN_UNIVERSITIES, ...KENYAN_UNIVERSITIES].map((uni, i) => (
                  <div key={i} className="flex flex-col items-center gap-1 shrink-0">
                    <div className="h-8 w-8 rounded-lg bg-muted border border-border flex items-center justify-center">
                      <span className="text-[8px] font-bold text-muted-foreground">{uni.short}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <style>{`
              @keyframes marquee-right {
                0% { transform: translateX(0); }
                100% { transform: translateX(-50%); }
              }
            `}</style>
          </div>

        </main>

        {/* ── Right Marquee ── */}
        <div className="hidden lg:block sticky top-8" style={{ height: 'calc(100vh - 4rem)' }}>
          <VerticalMarquee direction="up" />
        </div>

      </div>
    </div>
  );
}