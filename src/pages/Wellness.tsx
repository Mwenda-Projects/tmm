import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useGuestStatus } from '@/contexts/GuestContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import {
  Heart, Brain, Pill, Leaf, ShieldAlert, Loader2,
  Paperclip, Send, BookOpen,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

/* ── Static wellness topic cards ── */
const wellnessTopics = [
  {
    title: 'Depression Awareness',
    description: 'Recognise warning signs, understand triggers, and learn where to seek help on campus.',
    icon: Heart,
    color: 'text-rose-500',
    bg: 'bg-rose-500/10',
  },
  {
    title: 'Academic Stress',
    description: 'Practical techniques for managing exam pressure, deadlines, and work-life balance.',
    icon: Brain,
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
  },
  {
    title: 'Substance Abuse Education',
    description: 'Facts about drug and alcohol risks, peer pressure, and recovery resources.',
    icon: Pill,
    color: 'text-purple-500',
    bg: 'bg-purple-500/10',
  },
  {
    title: 'Healthy Campus Living',
    description: 'Nutrition, exercise, sleep, and social connection tips for student well-being.',
    icon: Leaf,
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
  },
];

interface WellnessPost {
  id: string;
  title: string;
  body: string;
  attachment_url: string | null;
  created_at: string;
  user_id: string;
  author_name: string | null;
  author_institution: string | null;
}

export default function Wellness() {
  const { user } = useAuth();
  const { isGuest } = useGuestStatus();
  const { toast } = useToast();

  const [posts, setPosts] = useState<WellnessPost[]>([]);
  const [loading, setLoading] = useState(true);

  // Create form
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchPosts = async () => {
    const { data } = await supabase
      .from('thought_posts')
      .select('id, title, body, attachment_url, created_at, user_id')
      .eq('category', 'wellness')
      .order('created_at', { ascending: false })
      .limit(50);

    if (!data) { setLoading(false); return; }

    const userIds = [...new Set(data.map((p) => p.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, institution_name')
      .in('user_id', userIds);

    const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);

    setPosts(
      data.map((p) => ({
        ...p,
        author_name: profileMap.get(p.user_id)?.full_name || null,
        author_institution: profileMap.get(p.user_id)?.institution_name || null,
      })),
    );
    setLoading(false);
  };

  useEffect(() => { fetchPosts(); }, []);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel('wellness-posts')
      .on('postgres_changes' as any, { event: 'INSERT', schema: 'public', table: 'thought_posts' }, () => fetchPosts())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleSubmit = async () => {
    if (!user || !title.trim() || !body.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from('thought_posts').insert({
      user_id: user.id,
      title: title.trim(),
      body: body.trim(),
      category: 'wellness' as any,
      attachment_url: attachmentUrl.trim() || null,
    });
    if (error) {
      toast({ title: 'Error', description: 'Failed to create post.', variant: 'destructive' });
    } else {
      toast({ title: 'Post published!' });
      setTitle(''); setBody(''); setAttachmentUrl(''); setShowForm(false);
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" /> Wellness & Awareness
          </h1>
          <p className="text-sm text-muted-foreground">
            Resources and peer insights on mental health, stress, and healthy campus living.
            This section is informational and supportive — not clinical.
          </p>
        </div>

        {/* Topic Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {wellnessTopics.map((topic) => {
            const Icon = topic.icon;
            return (
              <Card key={topic.title} className="hover:shadow-md transition-shadow">
                <CardContent className="flex gap-3 py-4">
                  <div className={`shrink-0 flex items-center justify-center h-10 w-10 rounded-lg ${topic.bg}`}>
                    <Icon className={`h-5 w-5 ${topic.color}`} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-foreground">{topic.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{topic.description}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Separator />

        {/* Community Posts Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Community Posts</h2>
            {!isGuest && (
              <Button size="sm" onClick={() => setShowForm((p) => !p)}>
                {showForm ? 'Cancel' : 'Share a Resource'}
              </Button>
            )}
            {isGuest && (
              <Badge variant="secondary" className="gap-1 text-[10px]">
                <ShieldAlert className="h-3 w-3" /> Read-only
              </Badge>
            )}
          </div>

          {/* Create Post Form */}
          {showForm && !isGuest && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Share a wellness resource</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="w-title">Title</Label>
                  <Input
                    id="w-title"
                    placeholder="e.g. Coping with exam anxiety"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={120}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="w-body">Content</Label>
                  <Textarea
                    id="w-body"
                    placeholder="Share your thoughts, tips, or link to a helpful resource…"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={4}
                    maxLength={2000}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="w-attach" className="flex items-center gap-1">
                    <Paperclip className="h-3.5 w-3.5" /> Attachment URL (optional)
                  </Label>
                  <Input
                    id="w-attach"
                    placeholder="https://…"
                    type="url"
                    value={attachmentUrl}
                    onChange={(e) => setAttachmentUrl(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || !title.trim() || !body.trim()}
                  className="w-full"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                  Publish
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Posts Feed */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="py-4 space-y-2">
                    <div className="h-4 w-2/3 bg-muted rounded animate-pulse" />
                    <div className="h-3 w-full bg-muted rounded animate-pulse" />
                    <div className="h-3 w-1/2 bg-muted rounded animate-pulse" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Heart className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No wellness posts yet. Be the first to share a resource!</p>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="max-h-[600px]">
              <div className="space-y-3">
                {posts.map((post) => {
                  const initials = (post.author_name || '?')
                    .split(' ')
                    .map((w) => w[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2);

                  return (
                    <Card key={post.id} className="hover:shadow-sm transition-shadow">
                      <CardContent className="py-4 space-y-2">
                        <div className="flex items-start gap-2.5">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-foreground truncate">{post.title}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {post.author_name || 'Anonymous'}
                              {post.author_institution ? ` · ${post.author_institution}` : ''}
                              {' · '}
                              {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                            </p>
                          </div>
                          <Badge variant="secondary" className="text-[10px] shrink-0">wellness</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-4">{post.body}</p>
                        {post.attachment_url && (
                          <a
                            href={post.attachment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            <Paperclip className="h-3 w-3" /> Attachment
                          </a>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    </div>
  );
}
