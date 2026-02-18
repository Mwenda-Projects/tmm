import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useGuestStatus } from '@/contexts/GuestContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import {
  PenLine, Filter, Paperclip, Calendar, Briefcase, GraduationCap,
  MessageSquareText, Heart, MessageCircle, ArrowUpDown, FileText, Clock,
} from 'lucide-react';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { format, formatDistanceToNow } from 'date-fns';
import type { Database } from '@/integrations/supabase/types';

type PostCategory = Database['public']['Enums']['post_category'];
type SortOption = 'newest' | 'oldest';

const CATEGORIES: { value: PostCategory; label: string; icon: React.ReactNode }[] = [
  { value: 'scholarship', label: 'Scholarship', icon: <GraduationCap className="h-3.5 w-3.5" /> },
  { value: 'internship', label: 'Internship', icon: <Briefcase className="h-3.5 w-3.5" /> },
  { value: 'event', label: 'Event', icon: <Calendar className="h-3.5 w-3.5" /> },
  { value: 'general', label: 'General Thought', icon: <MessageSquareText className="h-3.5 w-3.5" /> },
];

interface Post {
  id: string;
  user_id: string;
  title: string;
  body: string;
  category: PostCategory;
  attachment_url: string | null;
  created_at: string;
  authorName?: string;
  authorInstitution?: string;
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function Posts() {
  const { user } = useAuth();
  const { isGuest } = useGuestStatus();
  const { toast } = useToast();
  const [posts, setPosts] = useState<Post[]>([]);
  const [filterCategory, setFilterCategory] = useState<PostCategory | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [loading, setLoading] = useState(true);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<PostCategory>('general');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('thought_posts')
      .select('*')
      .order('created_at', { ascending: sortBy === 'oldest' });

    if (filterCategory !== 'all') {
      query = query.eq('category', filterCategory);
    }

    const { data } = await query;
    if (!data) { setLoading(false); return; }

    // Fetch author profiles
    const userIds = [...new Set(data.map((p) => p.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, institution_name')
      .in('user_id', userIds);

    const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);

    setPosts(
      data.map((p) => ({
        ...p,
        authorName: profileMap.get(p.user_id)?.full_name || 'Unknown',
        authorInstitution: profileMap.get(p.user_id)?.institution_name || undefined,
      }))
    );
    setLoading(false);
  }, [filterCategory, sortBy]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Real-time subscription for new posts
  useEffect(() => {
    const channel = supabase
      .channel('posts-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'thought_posts' },
        () => {
          // Refetch to include author info
          fetchPosts();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchPosts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title.trim() || !body.trim() || isGuest) return;
    setSubmitting(true);

    const { error } = await supabase.from('thought_posts').insert({
      user_id: user.id,
      title: title.trim(),
      body: body.trim(),
      category,
      attachment_url: attachmentUrl.trim() || null,
    });

    if (error) {
      toast({ title: 'Error', description: 'Failed to create post.', variant: 'destructive' });
    } else {
      toast({ title: 'Post created!' });
      setTitle('');
      setBody('');
      setCategory('general');
      setAttachmentUrl('');
      setShowForm(false);
    }
    setSubmitting(false);
  };

  const getCategoryStyle = (cat: PostCategory) => {
    switch (cat) {
      case 'scholarship': return 'bg-primary/10 text-primary';
      case 'internship': return 'bg-accent text-accent-foreground';
      case 'event': return 'bg-destructive/10 text-destructive';
      case 'general': return 'bg-muted text-muted-foreground';
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Posts</h1>
            <p className="text-sm text-muted-foreground">
              Scholarships, internships, events &amp; thoughts
            </p>
          </div>
          {!isGuest && (
            <Button onClick={() => setShowForm(!showForm)}>
              <PenLine className="h-4 w-4 mr-1.5" />
              {showForm ? 'Cancel' : 'New Post'}
            </Button>
          )}
        </div>

        {/* Create form */}
        {showForm && !isGuest && (
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Create Post</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="post-category">Category</Label>
                  <Select value={category} onValueChange={(v) => setCategory(v as PostCategory)}>
                    <SelectTrigger id="post-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          <span className="flex items-center gap-2">{c.icon} {c.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="post-title">Title</Label>
                  <Input
                    id="post-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Post title"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="post-body">Body</Label>
                  <Textarea
                    id="post-body"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Share details…"
                    rows={4}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="post-attachment">Attachment URL (optional)</Label>
                  <div className="flex items-center gap-2">
                    <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Input
                      id="post-attachment"
                      value={attachmentUrl}
                      onChange={(e) => setAttachmentUrl(e.target.value)}
                      placeholder="https://…"
                      type="url"
                    />
                  </div>
                </div>

                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting ? 'Posting…' : 'Publish'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Filter + Sort row */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Button
              size="sm"
              variant={filterCategory === 'all' ? 'default' : 'outline'}
              onClick={() => setFilterCategory('all')}
            >
              All
            </Button>
            {CATEGORIES.map((c) => (
              <Button
                key={c.value}
                size="sm"
                variant={filterCategory === c.value ? 'default' : 'outline'}
                onClick={() => setFilterCategory(c.value)}
              >
                {c.icon}
                <span className="ml-1 hidden sm:inline">{c.label}</span>
              </Button>
            ))}
          </div>

          {/* Sort */}
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <ArrowUpDown className="h-3 w-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Feed */}
        {loading ? (
          <LoadingSkeleton count={3} variant="card" />
        ) : posts.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No posts to show"
            description={filterCategory !== 'all' ? 'Try a different category filter.' : 'Be the first to share something!'}
            action={!isGuest ? { label: 'Write the first post', onClick: () => setShowForm(true) } : undefined}
          />
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <Card key={post.id} className="border-border hover:shadow-sm transition-shadow">
                <CardContent className="pt-5 space-y-3">
                  {/* Author row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                          {getInitials(post.authorName || 'U')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{post.authorName}</p>
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          {post.authorInstitution && (
                            <>
                              <span className="truncate max-w-[120px]">{post.authorInstitution}</span>
                              <span>·</span>
                            </>
                          )}
                          <Clock className="h-3 w-3" />
                          <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
                        </div>
                      </div>
                    </div>
                    <Badge variant="secondary" className={`shrink-0 text-[10px] ${getCategoryStyle(post.category)}`}>
                      {CATEGORIES.find((c) => c.value === post.category)?.label || post.category}
                    </Badge>
                  </div>

                  {/* Title + body */}
                  <div>
                    <h3 className="font-semibold text-foreground leading-tight">{post.title}</h3>
                    <p className="text-sm text-foreground/80 whitespace-pre-wrap mt-1 line-clamp-4">{post.body}</p>
                  </div>

                  {/* Attachment */}
                  {post.attachment_url && (
                    <a
                      href={post.attachment_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                    >
                      <Paperclip className="h-3 w-3" /> Attachment
                    </a>
                  )}

                  {/* Action buttons (placeholders) */}
                  <div className="flex items-center gap-1 pt-1 border-t border-border">
                    <Button variant="ghost" size="sm" disabled className="text-muted-foreground gap-1.5 h-8">
                      <Heart className="h-3.5 w-3.5" />
                      <span className="text-xs">Like</span>
                    </Button>
                    <Button variant="ghost" size="sm" disabled className="text-muted-foreground gap-1.5 h-8">
                      <MessageCircle className="h-3.5 w-3.5" />
                      <span className="text-xs">Comment</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
