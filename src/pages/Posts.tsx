import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useGuestStatus } from '@/contexts/GuestContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import {
  PenLine, Filter, Paperclip, Calendar, Briefcase, GraduationCap,
  MessageSquareText, Heart, MessageCircle, ArrowUpDown, FileText, Clock,
  Send, ChevronDown, ChevronUp, MoreHorizontal, Trash2, AlertTriangle, X,
  Zap, Timer, ShieldAlert,
} from 'lucide-react';
import { formatDistanceToNow, differenceInMinutes, differenceInHours } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';

type PostCategory = Database['public']['Enums']['post_category'];
type SortOption = 'newest' | 'oldest';

// ─── Delete tier types ────────────────────────────────────────────────────────

type DeleteTier = 'instant' | 'with-reason' | 'confirm' | 'old';

function getDeleteTier(createdAt: string): DeleteTier {
  const mins = differenceInMinutes(new Date(), new Date(createdAt));
  if (mins < 5) return 'instant';
  if (mins < 60) return 'with-reason';
  if (mins < 1440) return 'confirm';
  return 'old';
}

const DELETE_REASONS = [
  'Posted by mistake',
  'Contains incorrect information',
  'No longer relevant',
  'Want to repost with edits',
  'Other',
];

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

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORIES: { value: PostCategory; label: string; icon: React.ReactNode }[] = [
  { value: 'scholarship', label: 'Scholarship',     icon: <GraduationCap    style={{ width: 13, height: 13 }} /> },
  { value: 'internship',  label: 'Internship',      icon: <Briefcase        style={{ width: 13, height: 13 }} /> },
  { value: 'event',       label: 'Event',           icon: <Calendar         style={{ width: 13, height: 13 }} /> },
  { value: 'general',     label: 'General Thought', icon: <MessageSquareText style={{ width: 13, height: 13 }} /> },
];

const CAT_STYLE: Record<PostCategory, { pill: string }> = {
  scholarship: { pill: 'bg-blue-500/10 text-blue-500' },
  internship:  { pill: 'bg-amber-500/10 text-amber-500' },
  event:       { pill: 'bg-rose-500/10 text-rose-500' },
  general:     { pill: 'bg-zinc-500/10 text-zinc-500 dark:text-zinc-400' },
  wellness:    { pill: 'bg-emerald-500/10 text-emerald-500' },
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface Post {
  id: string; user_id: string; title: string; body: string;
  category: PostCategory; attachment_url: string | null;
  created_at: string; authorName?: string; authorInstitution?: string;
}

interface Comment {
  id: string; content: string; created_at: string;
  user_id: string; post_id: string; authorName?: string;
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// ─── Delete Modal ─────────────────────────────────────────────────────────────

function DeleteModal({ post, onConfirm, onCancel, loading }: {
  post: Post;
  onConfirm: (reason?: string) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const tier = getDeleteTier(post.created_at);
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const mins = differenceInMinutes(new Date(), new Date(post.created_at));
  const hrs = differenceInHours(new Date(), new Date(post.created_at));

  const config = {
    instant: {
      icon: <Zap style={{ width: 20, height: 20 }} className="text-emerald-400" />,
      iconBg: 'bg-emerald-500/15',
      title: 'Delete Post',
      subtitle: 'Posted just now — this will be removed immediately.',
      badge: { label: 'Instant', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
      cta: 'Delete Now',
      ctaClass: 'bg-rose-500 hover:bg-rose-400 text-white',
    },
    'with-reason': {
      icon: <Timer style={{ width: 20, height: 20 }} className="text-amber-400" />,
      iconBg: 'bg-amber-500/15',
      title: 'Delete Post',
      subtitle: `Posted ${mins} minute${mins !== 1 ? 's' : ''} ago — please tell us why.`,
      badge: { label: 'Reason required', color: 'bg-amber-500/15 text-amber-400 border-amber-500/20' },
      cta: 'Delete with Reason',
      ctaClass: 'bg-rose-500 hover:bg-rose-400 text-white',
    },
    confirm: {
      icon: <AlertTriangle style={{ width: 20, height: 20 }} className="text-orange-400" />,
      iconBg: 'bg-orange-500/15',
      title: 'Delete Post',
      subtitle: `Posted ${hrs} hour${hrs !== 1 ? 's' : ''} ago — this post may have been seen and shared.`,
      badge: { label: 'Confirmation required', color: 'bg-orange-500/15 text-orange-400 border-orange-500/20' },
      cta: 'Yes, Delete It',
      ctaClass: 'bg-rose-500 hover:bg-rose-400 text-white',
    },
    old: {
      icon: <ShieldAlert style={{ width: 20, height: 20 }} className="text-rose-400" />,
      iconBg: 'bg-rose-500/15',
      title: 'Delete Old Post',
      subtitle: `Posted ${formatDistanceToNow(new Date(post.created_at))} ago — this is a permanent action that cannot be undone.`,
      badge: { label: 'Permanent deletion', color: 'bg-rose-500/15 text-rose-400 border-rose-500/20' },
      cta: 'Permanently Delete',
      ctaClass: 'bg-rose-600 hover:bg-rose-500 text-white',
    },
  }[tier];

  const canSubmit = tier === 'instant'
    ? true
    : tier === 'with-reason'
      ? reason.length > 0
      : confirmed;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-sm rounded-[24px] overflow-hidden border border-white/[0.10] shadow-[0_32px_80px_rgba(0,0,0,0.5)]"
        style={{ background: 'linear-gradient(145deg, #14141e 0%, #0f1018 100%)' }}>

        {/* Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-40 rounded-full blur-[60px] opacity-20 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #ef4444, transparent)' }} />

        <div className="relative z-10 p-6">
          {/* Close */}
          <button onClick={onCancel} className="absolute top-4 right-4 h-7 w-7 rounded-full bg-white/[0.06] hover:bg-white/[0.10] flex items-center justify-center transition-all">
            <X style={{ width: 13, height: 13 }} className="text-white/60" />
          </button>

          {/* Icon + title */}
          <div className="flex items-start gap-4 mb-5">
            <div className={cn('h-12 w-12 rounded-2xl flex items-center justify-center shrink-0', config.iconBg)}>
              {config.icon}
            </div>
            <div>
              <span className={cn('inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border mb-1.5', config.badge.color)}>
                {config.badge.label}
              </span>
              <h3 className="text-[17px] font-bold text-white leading-tight">{config.title}</h3>
            </div>
          </div>

          {/* Post preview */}
          <div className="bg-white/[0.04] border border-white/[0.07] rounded-2xl px-4 py-3 mb-4">
            <p className="text-[12px] font-semibold text-white/80 truncate">{post.title}</p>
            <p className="text-[11px] text-white/40 mt-0.5 line-clamp-2">{post.body}</p>
          </div>

          {/* Subtitle */}
          <p className="text-[13px] text-white/50 mb-4 leading-relaxed">{config.subtitle}</p>

          {/* Tier-specific UI */}
          {tier === 'with-reason' && (
            <div className="mb-4 space-y-2">
              <Label className="text-[12px] text-white/50">Reason for deletion</Label>
              <div className="space-y-1.5">
                {DELETE_REASONS.map(r => (
                  <button key={r} type="button" onClick={() => setReason(r)}
                    className={cn(
                      'w-full text-left px-3.5 py-2.5 rounded-xl text-[12px] font-medium transition-all border',
                      reason === r
                        ? 'bg-primary/20 border-primary/40 text-primary'
                        : 'bg-white/[0.04] border-white/[0.06] text-white/50 hover:bg-white/[0.07] hover:text-white/70',
                    )}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          {(tier === 'confirm' || tier === 'old') && (
            <button type="button" onClick={() => setConfirmed(c => !c)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-[13px] font-medium transition-all mb-4',
                confirmed
                  ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                  : 'bg-white/[0.04] border-white/[0.07] text-white/50 hover:bg-white/[0.07]',
              )}>
              <div className={cn('h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 transition-all',
                confirmed ? 'bg-rose-500 border-rose-500' : 'border-white/30')}>
                {confirmed && <X style={{ width: 10, height: 10 }} className="text-white" />}
              </div>
              I understand this action is permanent and cannot be undone
            </button>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button type="button" onClick={onCancel}
              className="flex-1 h-11 rounded-xl text-[13px] font-medium bg-white/[0.06] hover:bg-white/[0.09] text-white/60 transition-all">
              Cancel
            </button>
            <button type="button" onClick={() => onConfirm(reason)} disabled={!canSubmit || loading}
              className={cn(
                'flex-1 h-11 rounded-xl text-[13px] font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-40',
                config.ctaClass,
              )}>
              {loading ? <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <Trash2 style={{ width: 14, height: 14 }} />}
              {loading ? 'Deleting…' : config.cta}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Three-dot menu ───────────────────────────────────────────────────────────

function PostMenu({ isOwner, onDelete }: { isOwner: boolean; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!isOwner) return null;

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)}
        className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-black/[0.05] dark:hover:bg-white/[0.07] transition-all">
        <MoreHorizontal style={{ width: 15, height: 15 }} />
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-50 w-44 rounded-2xl border border-black/[0.08] dark:border-white/[0.10] bg-white/90 dark:bg-[#1a1a24]/95 backdrop-blur-xl shadow-xl overflow-hidden">
          <button
            onClick={() => { setOpen(false); onDelete(); }}
            className="w-full flex items-center gap-2.5 px-4 py-3 text-[13px] font-medium text-rose-500 hover:bg-rose-500/[0.08] transition-colors">
            <Trash2 style={{ width: 13, height: 13 }} />
            Delete Post
          </button>
        </div>
      )}
    </div>
  );
}

// ─── PostCard ─────────────────────────────────────────────────────────────────

function PostCard({ post, userId, isGuest, onDeleted }: {
  post: Post; userId: string; isGuest: boolean; onDeleted: (id: string) => void;
}) {
  const { toast } = useToast();
  const cat = CAT_STYLE[post.category];
  const isOwner = post.user_id === userId;

  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likeLoading, setLikeLoading] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentCount, setCommentCount] = useState(0);
  const [commentText, setCommentText] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentsFetched, setCommentsFetched] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleting, setDeleting] = useState(false); // fade-out animation

  useEffect(() => {
    const fetchLikeData = async () => {
      const { count } = await supabase.from('post_likes').select('*', { count: 'exact', head: true }).eq('post_id', post.id);
      setLikeCount(count ?? 0);
      if (userId) {
        const { data } = await supabase.from('post_likes').select('id').eq('post_id', post.id).eq('user_id', userId).maybeSingle();
        setLiked(!!data);
      }
    };
    const fetchCommentCount = async () => {
      const { count } = await supabase.from('post_comments').select('*', { count: 'exact', head: true }).eq('post_id', post.id);
      setCommentCount(count ?? 0);
    };
    fetchLikeData();
    fetchCommentCount();
  }, [post.id, userId]);

  const handleLike = async () => {
    if (isGuest || likeLoading) return;
    setLikeLoading(true);
    if (liked) {
      setLiked(false); setLikeCount(p => p - 1);
      const { error } = await supabase.from('post_likes').delete().match({ post_id: post.id, user_id: userId });
      if (error) { setLiked(true); setLikeCount(p => p + 1); }
    } else {
      setLiked(true); setLikeCount(p => p + 1);
      const { error } = await supabase.from('post_likes').insert({ post_id: post.id, user_id: userId });
      if (error) { setLiked(false); setLikeCount(p => p - 1); }
    }
    setLikeLoading(false);
  };

  const fetchComments = useCallback(async () => {
    const { data } = await supabase.from('post_comments').select('*').eq('post_id', post.id).order('created_at', { ascending: true });
    if (!data) return;
    const uids = [...new Set(data.map(c => c.user_id))];
    const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', uids);
    const pmap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);
    setComments(data.map(c => ({ ...c, authorName: pmap.get(c.user_id) || 'Unknown' })));
    setCommentsFetched(true);
  }, [post.id]);

  const handleToggleComments = async () => {
    if (!showComments && !commentsFetched) await fetchComments();
    setShowComments(p => !p);
  };

  const handleSubmitComment = async () => {
    if (!commentText.trim() || commentLoading || isGuest) return;
    setCommentLoading(true);
    const { data, error } = await supabase.from('post_comments')
      .insert({ post_id: post.id, user_id: userId, content: commentText.trim() }).select().single();
    if (error) { toast({ title: 'Error', variant: 'destructive' }); }
    else { setComments(p => [...p, { ...data, authorName: 'You' }]); setCommentCount(p => p + 1); setCommentText(''); }
    setCommentLoading(false);
  };

  const handleDelete = async (reason?: string) => {
    setDeleteLoading(true);
    const { error } = await supabase.from('thought_posts').delete().eq('id', post.id);
    if (error) {
      toast({ title: 'Delete failed', description: 'Could not delete post.', variant: 'destructive' });
      setDeleteLoading(false);
      return;
    }
    setShowDeleteModal(false);
    setDeleting(true); // trigger fade-out
    setTimeout(() => onDeleted(post.id), 400);
    const tier = getDeleteTier(post.created_at);
    toast({
      title: 'Post deleted',
      description: tier === 'with-reason' && reason ? `Reason: ${reason}` : 'Your post has been removed.',
    });
  };

  return (
    <>
      <GlassCard className={cn(
        'hover:shadow-[0_8px_32px_rgba(0,0,0,0.10)] dark:hover:shadow-[0_8px_40px_rgba(0,0,0,0.5)] transition-all duration-300',
        deleting && 'opacity-0 scale-[0.98] pointer-events-none',
      )}>
        <div className="p-5 space-y-3">

          {/* Author row */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarFallback className="bg-primary/10 text-primary text-[11px] font-bold">
                  {getInitials(post.authorName || 'U')}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-foreground truncate">{post.authorName}</p>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  {post.authorInstitution && (
                    <>
                      <span className="truncate max-w-[140px]">{post.authorInstitution}</span>
                      <span className="text-muted-foreground/30">·</span>
                    </>
                  )}
                  <Clock style={{ width: 10, height: 10 }} />
                  <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
                </div>
              </div>
            </div>

            {/* Right side: category pill + menu */}
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${cat.pill}`}>
                {CATEGORIES.find(c => c.value === post.category)?.label || post.category}
              </span>
              <PostMenu isOwner={isOwner} onDelete={() => setShowDeleteModal(true)} />
            </div>
          </div>

          {/* Content */}
          <div>
            <h3 className="text-[15px] font-semibold text-foreground leading-snug">{post.title}</h3>
            <p className="text-[13px] text-muted-foreground whitespace-pre-wrap mt-1 line-clamp-4 leading-relaxed">{post.body}</p>
          </div>

          {/* Attachment */}
          {post.attachment_url && (
            <a href={post.attachment_url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[12px] text-primary hover:underline">
              <Paperclip style={{ width: 11, height: 11 }} /> Attachment
            </a>
          )}

          {/* Actions */}
          <div className="flex items-center gap-1 pt-2 border-t border-black/[0.05] dark:border-white/[0.05]">
            <button onClick={handleLike} disabled={isGuest || likeLoading}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium transition-all',
                liked
                  ? 'text-rose-500 bg-rose-500/10 hover:bg-rose-500/15'
                  : 'text-muted-foreground hover:text-rose-500 hover:bg-rose-500/8',
              )}>
              <Heart style={{ width: 13, height: 13 }} className={liked ? 'fill-rose-500' : ''} />
              {likeCount > 0 ? likeCount : ''} Like{likeCount !== 1 ? 's' : ''}
            </button>

            <button onClick={handleToggleComments}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium text-muted-foreground hover:text-primary hover:bg-primary/8 transition-all">
              <MessageCircle style={{ width: 13, height: 13 }} />
              {commentCount > 0 ? commentCount : ''} Comment{commentCount !== 1 ? 's' : ''}
              {showComments
                ? <ChevronUp style={{ width: 11, height: 11 }} />
                : <ChevronDown style={{ width: 11, height: 11 }} />}
            </button>
          </div>

          {/* Comments */}
          {showComments && (
            <div className="space-y-3 pt-1">
              <div className="h-px bg-black/[0.05] dark:bg-white/[0.05]" />
              {comments.length === 0 ? (
                <p className="text-[12px] text-muted-foreground text-center py-2">No comments yet. Be the first!</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {comments.map(comment => (
                    <div key={comment.id} className="flex gap-2.5">
                      <Avatar className="h-6 w-6 shrink-0 mt-0.5">
                        <AvatarFallback className="bg-primary/10 text-primary text-[9px] font-bold">
                          {getInitials(comment.authorName || 'U')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 bg-black/[0.03] dark:bg-white/[0.04] rounded-2xl px-3 py-2">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[12px] font-semibold text-foreground">{comment.authorName}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-[12px] text-muted-foreground whitespace-pre-wrap">{comment.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {!isGuest && (
                <div className="flex gap-2 items-center">
                  <Avatar className="h-6 w-6 shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary text-[9px] font-bold">ME</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 flex gap-2">
                    <Input value={commentText} onChange={e => setCommentText(e.target.value)}
                      placeholder="Write a comment…"
                      className="h-8 text-[12px] rounded-xl bg-black/[0.03] dark:bg-white/[0.03] border-black/[0.08] dark:border-white/[0.08]"
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmitComment(); } }} />
                    <Button size="sm" onClick={handleSubmitComment} disabled={!commentText.trim() || commentLoading}
                      className="h-8 px-3 rounded-xl">
                      <Send style={{ width: 13, height: 13 }} />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </GlassCard>

      {/* Delete modal — portalled to body via z-index layering */}
      {showDeleteModal && (
        <DeleteModal
          post={post}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteModal(false)}
          loading={deleteLoading}
        />
      )}
    </>
  );
}

// ─── Main Posts Page ──────────────────────────────────────────────────────────

export default function Posts() {
  const { user } = useAuth();
  const { isGuest } = useGuestStatus();
  const { toast } = useToast();

  const [posts, setPosts] = useState<Post[]>([]);
  const [filterCategory, setFilterCategory] = useState<PostCategory | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<PostCategory>('general');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('thought_posts').select('*').order('created_at', { ascending: sortBy === 'oldest' });
    if (filterCategory !== 'all') query = query.eq('category', filterCategory);
    const { data } = await query;
    if (!data) { setLoading(false); return; }

    const userIds = [...new Set(data.map(p => p.user_id))];
    const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, institution_name').in('user_id', userIds);
    const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

    setPosts(data.map(p => ({
      ...p,
      authorName: profileMap.get(p.user_id)?.full_name || 'Unknown',
      authorInstitution: profileMap.get(p.user_id)?.institution_name || undefined,
    })));
    setLoading(false);
  }, [filterCategory, sortBy]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  useEffect(() => {
    const channel = supabase.channel('posts-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'thought_posts' }, () => fetchPosts())
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'thought_posts' }, () => fetchPosts())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchPosts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title.trim() || !body.trim() || isGuest) return;
    setSubmitting(true);
    const { error } = await supabase.from('thought_posts').insert({
      user_id: user.id, title: title.trim(), body: body.trim(), category,
      attachment_url: attachmentUrl.trim() || null,
    });
    if (error) { toast({ title: 'Error', description: 'Failed to create post.', variant: 'destructive' }); }
    else { toast({ title: 'Post published.' }); setTitle(''); setBody(''); setCategory('general'); setAttachmentUrl(''); setShowForm(false); }
    setSubmitting(false);
  };

  // Optimistic removal — removes card immediately, no refetch needed
  const handlePostDeleted = (id: string) => {
    setPosts(prev => prev.filter(p => p.id !== id));
  };

  if (!user) return null;

  return (
    <div className="min-h-screen relative overflow-hidden">

      {/* Gradient mesh */}
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

      <div className="relative z-10 max-w-3xl mx-auto px-6 pt-10 pb-16 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[32px] font-semibold text-foreground tracking-tight">Posts</h1>
            <p className="text-[14px] text-muted-foreground">Scholarships, internships, events & thoughts</p>
          </div>
          {!isGuest && (
            <Button onClick={() => setShowForm(!showForm)} variant={showForm ? 'outline' : 'default'}
              className="rounded-xl text-[13px] gap-1.5 h-9 px-4">
              <PenLine style={{ width: 14, height: 14 }} />
              {showForm ? 'Cancel' : 'New Post'}
            </Button>
          )}
        </div>

        {/* Create form */}
        {showForm && !isGuest && (
          <GlassCard className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-7 w-7 rounded-xl bg-primary/10 flex items-center justify-center">
                <PenLine style={{ width: 13, height: 13 }} className="text-primary" />
              </div>
              <h2 className="text-[13px] font-semibold text-foreground">Create Post</h2>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[12px] text-muted-foreground">Category</Label>
                <Select value={category} onValueChange={v => setCategory(v as PostCategory)}>
                  <SelectTrigger className="rounded-xl text-[13px] bg-black/[0.03] dark:bg-white/[0.03] border-black/[0.08] dark:border-white/[0.08]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>
                        <span className="flex items-center gap-2">{c.icon} {c.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px] text-muted-foreground">Title</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Post title" required
                  className="rounded-xl text-[13px] bg-black/[0.03] dark:bg-white/[0.03] border-black/[0.08] dark:border-white/[0.08]" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px] text-muted-foreground">Body</Label>
                <Textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Share details…" rows={4} required
                  className="rounded-xl text-[13px] resize-none bg-black/[0.03] dark:bg-white/[0.03] border-black/[0.08] dark:border-white/[0.08]" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px] text-muted-foreground flex items-center gap-1">
                  <Paperclip style={{ width: 11, height: 11 }} /> Attachment URL
                  <span className="text-muted-foreground/40 font-normal">(optional)</span>
                </Label>
                <Input value={attachmentUrl} onChange={e => setAttachmentUrl(e.target.value)} placeholder="https://…" type="url"
                  className="rounded-xl text-[13px] bg-black/[0.03] dark:bg-white/[0.03] border-black/[0.08] dark:border-white/[0.08]" />
              </div>
              <Button type="submit" disabled={submitting} className="w-full rounded-xl h-10 text-[13px]">
                {submitting ? 'Publishing…' : 'Publish'}
              </Button>
            </form>
          </GlassCard>
        )}

        {/* Filter + Sort */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Filter style={{ width: 13, height: 13 }} className="text-muted-foreground" />
            <button onClick={() => setFilterCategory('all')}
              className={cn(
                'px-3 py-1.5 rounded-xl text-[12px] font-medium transition-all',
                filterCategory === 'all'
                  ? 'bg-foreground text-background'
                  : 'bg-black/[0.04] dark:bg-white/[0.05] text-muted-foreground hover:text-foreground',
              )}>All</button>
            {CATEGORIES.map(c => (
              <button key={c.value} onClick={() => setFilterCategory(c.value)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium transition-all',
                  filterCategory === c.value
                    ? `${CAT_STYLE[c.value].pill} font-semibold`
                    : 'bg-black/[0.04] dark:bg-white/[0.05] text-muted-foreground hover:text-foreground',
                )}>
                {c.icon}
                <span className="hidden sm:inline">{c.label}</span>
              </button>
            ))}
          </div>
          <Select value={sortBy} onValueChange={v => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-[140px] h-8 text-[12px] rounded-xl bg-black/[0.04] dark:bg-white/[0.05] border-black/[0.06] dark:border-white/[0.06]">
              <ArrowUpDown style={{ width: 11, height: 11 }} className="mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Feed */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <GlassCard key={i} className="p-5 space-y-3 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-black/[0.06] dark:bg-white/[0.06]" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-3 w-1/3 bg-black/[0.06] dark:bg-white/[0.06] rounded-full" />
                    <div className="h-2.5 w-1/4 bg-black/[0.04] dark:bg-white/[0.04] rounded-full" />
                  </div>
                </div>
                <div className="h-4 w-2/3 bg-black/[0.06] dark:bg-white/[0.06] rounded-full" />
                <div className="h-3 w-full bg-black/[0.04] dark:bg-white/[0.04] rounded-full" />
              </GlassCard>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <GlassCard className="py-12 text-center">
            <FileText style={{ width: 36, height: 36 }} className="text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-[14px] font-medium text-foreground">No posts to show</p>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {filterCategory !== 'all' ? 'Try a different category filter.' : 'Be the first to share something!'}
            </p>
            {!isGuest && filterCategory === 'all' && (
              <Button size="sm" onClick={() => setShowForm(true)} className="mt-4 rounded-xl text-[12px]">
                Write the first post
              </Button>
            )}
          </GlassCard>
        ) : (
          <div className="space-y-3">
            {posts.map(post => (
              <PostCard key={post.id} post={post} userId={user.id} isGuest={isGuest} onDeleted={handlePostDeleted} />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}