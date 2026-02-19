import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useGuestStatus } from '@/contexts/GuestContext';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import {
  Heart, Brain, Pill, Leaf, ShieldAlert, Loader2,
  Paperclip, Send, BookOpen,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

// ─── Glass Card ───────────────────────────────────────────────────────────────

function GlassCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(
      'relative rounded-[20px] border overflow-hidden',
      'bg-white/70 dark:bg-white/[0.04]',
      'border-white/60 dark:border-white/[0.08]',
      'shadow-[0_4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_32px_rgba(0,0,0,0.4)]',
      'backdrop-blur-xl',
      className,
    )}>
      {children}
    </div>
  );
}

// ─── Wellness Topics ──────────────────────────────────────────────────────────

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

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Wellness() {
  const { user } = useAuth();
  const { isGuest } = useGuestStatus();
  const { toast } = useToast();

  const [posts, setPosts] = useState<WellnessPost[]>([]);
  const [loading, setLoading] = useState(true);
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

    const userIds = [...new Set(data.map(p => p.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, institution_name')
      .in('user_id', userIds);

    const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
    setPosts(data.map(p => ({
      ...p,
      author_name: profileMap.get(p.user_id)?.full_name || null,
      author_institution: profileMap.get(p.user_id)?.institution_name || null,
    })));
    setLoading(false);
  };

  useEffect(() => { fetchPosts(); }, []);

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
      toast({ title: 'Post published.' });
      setTitle(''); setBody(''); setAttachmentUrl(''); setShowForm(false);
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen relative overflow-hidden">

      {/* ── GRADIENT MESH BACKGROUND ── */}
      <div className="fixed inset-0 dark:hidden pointer-events-none">
        <div className="absolute inset-0 bg-[#f0f2f5]" />
        <div className="absolute top-[-200px] left-[-100px] w-[600px] h-[600px] rounded-full blur-[120px] opacity-60"
          style={{ background: 'radial-gradient(circle, #dbeafe, transparent)' }} />
        <div className="absolute top-[100px] right-[-100px] w-[500px] h-[500px] rounded-full blur-[120px] opacity-50"
          style={{ background: 'radial-gradient(circle, #ede9fe, transparent)' }} />
        <div className="absolute bottom-[-100px] left-[30%] w-[500px] h-[400px] rounded-full blur-[120px] opacity-40"
          style={{ background: 'radial-gradient(circle, #dcfce7, transparent)' }} />
      </div>
      <div className="fixed inset-0 hidden dark:block pointer-events-none">
        <div className="absolute inset-0 bg-[#0d0d0f]" />
        <div className="absolute top-[-200px] left-[-100px] w-[700px] h-[700px] rounded-full blur-[160px] opacity-30"
          style={{ background: 'radial-gradient(circle, #312e81, transparent)' }} />
        <div className="absolute top-[200px] right-[-100px] w-[500px] h-[500px] rounded-full blur-[140px] opacity-20"
          style={{ background: 'radial-gradient(circle, #134e4a, transparent)' }} />
        <div className="absolute bottom-[-50px] left-[40%] w-[600px] h-[400px] rounded-full blur-[140px] opacity-25"
          style={{ background: 'radial-gradient(circle, #1e1b4b, transparent)' }} />
      </div>

      {/* ── CONTENT ── */}
      <div className="relative z-10 max-w-3xl mx-auto px-6 pt-10 pb-16 space-y-5">

        {/* ── Header ── */}
        <div className="space-y-1 pb-2">
          <h1 className="text-[32px] font-semibold text-foreground tracking-tight flex items-center gap-3">
            <BookOpen style={{ width: 28, height: 28 }} className="text-primary" />
            Wellness & Awareness
          </h1>
          <p className="text-[14px] text-muted-foreground leading-relaxed max-w-xl">
            Resources and peer insights on mental health, stress, and healthy campus living.
            This section is informational and supportive — not clinical.
          </p>
        </div>

        {/* ── Topic Cards Grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {wellnessTopics.map(topic => {
            const Icon = topic.icon;
            return (
              <GlassCard key={topic.title} className="flex gap-4 p-4 hover:shadow-[0_8px_32px_rgba(0,0,0,0.10)] dark:hover:shadow-[0_8px_40px_rgba(0,0,0,0.5)] transition-all duration-200 cursor-default">
                <div className={`shrink-0 h-10 w-10 rounded-2xl flex items-center justify-center ${topic.bg}`}>
                  <Icon style={{ width: 18, height: 18 }} className={topic.color} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-[13px] font-semibold text-foreground">{topic.title}</h3>
                  <p className="text-[12px] text-muted-foreground leading-relaxed mt-0.5">{topic.description}</p>
                </div>
              </GlassCard>
            );
          })}
        </div>

        {/* ── Community Posts ── */}
        <div className="space-y-4 pt-2">

          {/* Section header */}
          <div className="flex items-center justify-between">
            <h2 className="text-[17px] font-semibold text-foreground tracking-tight">Community Posts</h2>
            {!isGuest ? (
              <Button
                size="sm"
                variant={showForm ? 'outline' : 'default'}
                onClick={() => setShowForm(p => !p)}
                className="rounded-xl text-[12px] h-8 px-4"
              >
                {showForm ? 'Cancel' : 'Share a Resource'}
              </Button>
            ) : (
              <span className="flex items-center gap-1 text-[11px] font-medium text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-full">
                <ShieldAlert style={{ width: 11, height: 11 }} /> Read-only
              </span>
            )}
          </div>

          {/* Create Form */}
          {showForm && !isGuest && (
            <GlassCard className="p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-7 w-7 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <Heart style={{ width: 13, height: 13 }} className="text-emerald-500" />
                </div>
                <h3 className="text-[13px] font-semibold text-foreground">Share a wellness resource</h3>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[12px] text-muted-foreground">Title</Label>
                <Input
                  placeholder="e.g. Coping with exam anxiety"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  maxLength={120}
                  className="bg-black/[0.03] dark:bg-white/[0.03] border-black/[0.08] dark:border-white/[0.08] rounded-xl text-[13px]"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[12px] text-muted-foreground">Content</Label>
                <Textarea
                  placeholder="Share your thoughts, tips, or link to a helpful resource…"
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  rows={4}
                  maxLength={2000}
                  className="bg-black/[0.03] dark:bg-white/[0.03] border-black/[0.08] dark:border-white/[0.08] rounded-xl text-[13px] resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[12px] text-muted-foreground flex items-center gap-1">
                  <Paperclip style={{ width: 11, height: 11 }} /> Attachment URL
                  <span className="text-muted-foreground/40 font-normal">(optional)</span>
                </Label>
                <Input
                  placeholder="https://…"
                  type="url"
                  value={attachmentUrl}
                  onChange={e => setAttachmentUrl(e.target.value)}
                  className="bg-black/[0.03] dark:bg-white/[0.03] border-black/[0.08] dark:border-white/[0.08] rounded-xl text-[13px]"
                />
              </div>

              <Button
                onClick={handleSubmit}
                disabled={submitting || !title.trim() || !body.trim()}
                className="w-full rounded-xl h-10 text-[13px] gap-1.5"
              >
                {submitting
                  ? <Loader2 style={{ width: 13, height: 13 }} className="animate-spin" />
                  : <Send style={{ width: 13, height: 13 }} />}
                {submitting ? 'Publishing…' : 'Publish'}
              </Button>
            </GlassCard>
          )}

          {/* Posts Feed */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <GlassCard key={i} className="p-5 space-y-2 animate-pulse">
                  <div className="h-3.5 w-2/3 bg-black/[0.06] dark:bg-white/[0.06] rounded-full" />
                  <div className="h-3 w-full bg-black/[0.04] dark:bg-white/[0.04] rounded-full" />
                  <div className="h-3 w-1/2 bg-black/[0.04] dark:bg-white/[0.04] rounded-full" />
                </GlassCard>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <GlassCard className="py-10 text-center">
              <Heart style={{ width: 32, height: 32 }} className="text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-[13px] text-muted-foreground">No wellness posts yet.</p>
              <p className="text-[12px] text-muted-foreground/60 mt-0.5">Be the first to share a resource!</p>
            </GlassCard>
          ) : (
            <div className="space-y-3">
              {posts.map(post => {
                const initials = (post.author_name || '?')
                  .split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

                return (
                  <GlassCard key={post.id} className="p-5 space-y-3 hover:shadow-[0_8px_32px_rgba(0,0,0,0.10)] dark:hover:shadow-[0_8px_40px_rgba(0,0,0,0.5)] transition-all duration-200">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarFallback className="text-[11px] font-bold bg-primary/10 text-primary">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-semibold text-foreground truncate">{post.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {post.author_name || 'Anonymous'}
                          {post.author_institution ? ` · ${post.author_institution}` : ''}
                          {' · '}
                          {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      <span className="shrink-0 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500">
                        wellness
                      </span>
                    </div>

                    <p className="text-[13px] text-muted-foreground leading-relaxed line-clamp-4 pl-12">
                      {post.body}
                    </p>

                    {post.attachment_url && (
                      <a
                        href={post.attachment_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-[12px] text-primary hover:underline pl-12"
                      >
                        <Paperclip style={{ width: 11, height: 11 }} /> Attachment
                      </a>
                    )}
                  </GlassCard>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}