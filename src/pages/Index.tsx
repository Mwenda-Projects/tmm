import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNotifications } from '@/hooks/useNotifications';
import { Users, FileText, MessageSquare, Bell, ArrowRight, Sparkles, Heart } from 'lucide-react';
import { RandomVideoChat } from '@/components/video/RandomVideoChat';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { EmptyState } from '@/components/EmptyState';

interface DashboardStats {
  groupsJoined: number;
  newPosts: number;
  newMessages: number;
}

function StatCard({
  icon: Icon,
  label,
  value,
  href,
  accent,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  href: string;
  accent: string;
}) {
  return (
    <Link to={href}>
      <Card className="group hover:shadow-md transition-shadow cursor-pointer border-border">
        <CardContent className="flex items-center gap-4 p-5">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${accent}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </CardContent>
      </Card>
    </Link>
  );
}

// EmptyState is now imported from @/components/EmptyState

export default function Index() {
  const { user } = useAuth();
  const { unreadCount } = useNotifications(user?.id);
  const [stats, setStats] = useState<DashboardStats>({ groupsJoined: 0, newPosts: 0, newMessages: 0 });
  const [loading, setLoading] = useState(true);
  const [recentPosts, setRecentPosts] = useState<{ id: string; title: string; category: string; created_at: string }[]>([]);

  useEffect(() => {
    if (!user) return;

    const fetchStats = async () => {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const [groupsRes, postsRes, msgsRes, recentPostsRes] = await Promise.all([
        supabase.from('group_members').select('group_id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('thought_posts').select('id', { count: 'exact', head: true }).gte('created_at', twentyFourHoursAgo),
        supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('receiver_id', user.id)
          .gte('created_at', twentyFourHoursAgo),
        supabase
          .from('thought_posts')
          .select('id, title, category, created_at')
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      setStats({
        groupsJoined: groupsRes.count ?? 0,
        newPosts: postsRes.count ?? 0,
        newMessages: msgsRes.count ?? 0,
      });
      setRecentPosts(recentPostsRes.data ?? []);
      setLoading(false);
    };

    fetchStats();
  }, [user]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="border-border animate-pulse">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="h-11 w-11 rounded-lg bg-muted shrink-0" />
                <div className="space-y-2 flex-1">
                  <div className="h-6 w-12 bg-muted rounded" />
                  <div className="h-3 w-20 bg-muted rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <LoadingSkeleton count={3} variant="card" />
      </div>
    );
  }

  const hasActivity = stats.groupsJoined > 0 || stats.newPosts > 0 || stats.newMessages > 0 || unreadCount > 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Your TellMeMore overview</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={Users}
          label="Groups Joined"
          value={stats.groupsJoined}
          href="/groups"
          accent="bg-primary/10 text-primary"
        />
        <StatCard
          icon={FileText}
          label="New Posts (24h)"
          value={stats.newPosts}
          href="/posts"
          accent="bg-green-500/10 text-green-600 dark:text-green-400"
        />
        <StatCard
          icon={MessageSquare}
          label="New Messages (24h)"
          value={stats.newMessages}
          href="/messages"
          accent="bg-amber-500/10 text-amber-600 dark:text-amber-400"
        />
        <StatCard
          icon={Bell}
          label="Unread Notifications"
          value={unreadCount}
          href="/settings"
          accent="bg-destructive/10 text-destructive"
        />
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to="/groups">
            <Users className="h-4 w-4 mr-1.5" />
            Explore Groups
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/posts">
            <FileText className="h-4 w-4 mr-1.5" />
            Browse Posts
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/messages">
            <MessageSquare className="h-4 w-4 mr-1.5" />
            Open Messages
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/wellness">
            <Heart className="h-4 w-4 mr-1.5" />
            Wellness
          </Link>
        </Button>
      </div>

      {/* Random Video Chat */}
      <RandomVideoChat />

      {/* Recent Posts */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-foreground">Recent Posts</CardTitle>
        </CardHeader>
        <CardContent>
          {recentPosts.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="No posts yet"
              description="Be the first to share something!"
            />
          ) : (
            <ul className="divide-y divide-border">
              {recentPosts.map((post) => (
                <li key={post.id} className="py-3 first:pt-0 last:pb-0">
                  <Link to="/posts" className="flex items-center justify-between gap-2 group">
                    <span className="text-sm font-medium text-foreground truncate group-hover:underline">
                      {post.title}
                    </span>
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                      {post.category}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Empty state fallback */}
      {!hasActivity && (
        <Card className="border-dashed border-border">
          <CardContent className="py-2">
            <EmptyState
              icon={Sparkles}
              title="Nothing here yet"
              description="Join a group or create a post to get started!"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
