import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { isUniversityEmail, DOMAIN_ERROR_MESSAGE } from '@/lib/auth-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { ErrorModal } from '@/components/ErrorModal';
import { notify } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import {
  Eye, LogIn, UserPlus, Loader2, GraduationCap, CheckCircle2,
  Mail, Lock, User as UserIcon, ShieldAlert,
  Users, FileText, Heart, ArrowRight, BookOpen, Shield,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LiveStats {
  students: number;
  universities: number;
  posts: number;
  connections: number;
  onlineNow: number;
}

interface ActivityItem {
  id: string;
  avatar: string;
  name: string;
  uni: string;
  action: string;
  time: string;
  color: string;
  createdAt: string;
}

interface RecentUser {
  initials: string;
  color: string;
}

// ─── Gradient colors pool ─────────────────────────────────────────────────────

const GRAD_COLORS = [
  'from-blue-500 to-blue-600',
  'from-violet-500 to-violet-600',
  'from-rose-500 to-rose-600',
  'from-emerald-500 to-emerald-600',
  'from-amber-500 to-amber-600',
  'from-cyan-500 to-cyan-600',
  'from-pink-500 to-pink-600',
  'from-indigo-500 to-indigo-600',
];

const BG_COLORS = [
  'bg-blue-500', 'bg-violet-500', 'bg-rose-500',
  'bg-emerald-500', 'bg-amber-500', 'bg-cyan-500',
];

function colorFor(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return GRAD_COLORS[Math.abs(hash) % GRAD_COLORS.length];
}

function bgColorFor(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return BG_COLORS[Math.abs(hash) % BG_COLORS.length];
}

function getInitials(name: string) {
  return (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function shortUni(institution: string | null) {
  if (!institution) return '';
  const map: Record<string, string> = {
    'university of nairobi': 'UoN',
    'kenyatta university': 'KU',
    'jkuat': 'JKUAT',
    'strathmore university': 'Strathmore',
    'technical university of kenya': 'TUK',
    'moi university': 'Moi',
    'egerton university': 'Egerton',
    'mount kenya university': 'MKU',
    'daystar university': 'Daystar',
    'usiu-africa': 'USIU',
    'united states international university': 'USIU',
  };
  return map[institution.toLowerCase()] || institution.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 4);
}

function describePost(category: string, title: string) {
  const cat = category?.toLowerCase();
  if (cat === 'scholarship') return `posted a scholarship: "${title?.slice(0, 30)}…"`;
  if (cat === 'internship') return `shared an internship opportunity`;
  if (cat === 'event') return `posted an upcoming event`;
  if (cat === 'wellness') return `opened a wellness discussion`;
  return `shared a post on the board`;
}

// ─── Real-time data hook ──────────────────────────────────────────────────────

function useLivePanelData() {
  const [stats, setStats] = useState<LiveStats>({ students: 0, universities: 0, posts: 0, connections: 0, onlineNow: 0 });
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [unis, setUnis] = useState<string[]>([]);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);

  const fetchStats = async () => {
    const [profilesRes, postsRes, membersRes, onlineRes] = await Promise.all([
      supabase.from('profiles').select('user_id, institution_name', { count: 'exact' }),
      supabase.from('thought_posts').select('id', { count: 'exact', head: true }),
      supabase.from('group_members').select('id', { count: 'exact', head: true }),
      supabase.from('user_presence' as any).select('user_id', { count: 'exact', head: true }).eq('is_online', true),
    ]);

    // Distinct universities from profiles
    const allInstitutions = (profilesRes.data ?? [])
      .map((p: any) => p.institution_name)
      .filter(Boolean);
    const uniqueUnis = [...new Set(allInstitutions)] as string[];

    setStats({
      students: profilesRes.count ?? 0,
      universities: uniqueUnis.length,
      posts: postsRes.count ?? 0,
      connections: membersRes.count ?? 0,
      onlineNow: (onlineRes as any).count ?? 0,
    });

    setUnis(uniqueUnis.length > 0 ? uniqueUnis : [
      'University of Nairobi', 'Kenyatta University', 'JKUAT', 'Strathmore',
      'TUK', 'Moi University', 'Egerton', 'MKU', 'Daystar', 'USIU-Africa',
    ]);
  };

  const fetchActivity = async () => {
    // Fetch recent posts with author profiles
    const { data: posts } = await supabase
      .from('thought_posts')
      .select('id, title, category, created_at, author_id')
      .order('created_at', { ascending: false })
      .limit(10);

    if (!posts || posts.length === 0) return;

    const authorIds = [...new Set(posts.map((p: any) => p.author_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, institution_name')
      .in('user_id', authorIds);

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));

    const items: ActivityItem[] = posts.map((p: any) => {
      const profile: any = profileMap.get(p.author_id);
      const name = profile?.full_name || 'A student';
      const uni = shortUni(profile?.institution_name);
      return {
        id: p.id,
        avatar: getInitials(name),
        name,
        uni,
        action: describePost(p.category, p.title),
        time: formatDistanceToNow(new Date(p.created_at), { addSuffix: true }),
        color: colorFor(name),
        createdAt: p.created_at,
      };
    });

    setActivity(items);
  };

  const fetchRecentUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('full_name')
      .order('created_at' as any, { ascending: false })
      .limit(5);

    if (data) {
      setRecentUsers(data.map((p: any) => ({
        initials: getInitials(p.full_name || '?'),
        color: bgColorFor(p.full_name || '?'),
      })));
    }
  };

  useEffect(() => {
    fetchStats();
    fetchActivity();
    fetchRecentUsers();

    // Realtime: new posts
    const postChannel = supabase.channel('auth-panel-posts')
      .on('postgres_changes' as any, { event: 'INSERT', schema: 'public', table: 'thought_posts' }, () => {
        fetchStats();
        fetchActivity();
      })
      .subscribe();

    // Realtime: presence changes
    const presenceChannel = supabase.channel('auth-panel-presence')
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'user_presence' }, () => {
        fetchStats();
      })
      .subscribe();

    // Realtime: new profiles (new students)
    const profileChannel = supabase.channel('auth-panel-profiles')
      .on('postgres_changes' as any, { event: 'INSERT', schema: 'public', table: 'profiles' }, () => {
        fetchStats();
        fetchRecentUsers();
      })
      .subscribe();

    // Refresh timestamps every minute
    const tick = setInterval(() => fetchActivity(), 60_000);

    return () => {
      supabase.removeChannel(postChannel);
      supabase.removeChannel(presenceChannel);
      supabase.removeChannel(profileChannel);
      clearInterval(tick);
    };
  }, []);

  return { stats, activity, unis, recentUsers };
}

// ─── Animated Counter ─────────────────────────────────────────────────────────

function AnimatedCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const from = prev.current;
    prev.current = target;
    if (from === target) return;
    const steps = 40;
    const delta = target - from;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      setCount(Math.round(from + (delta * step) / steps));
      if (step >= steps) clearInterval(timer);
    }, 1200 / steps);
    return () => clearInterval(timer);
  }, [target]);
  return <>{count.toLocaleString()}{suffix}</>;
}

// ─── Floating Orbs ────────────────────────────────────────────────────────────

function Orbs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute rounded-full blur-[130px] opacity-25 animate-[drift1_12s_ease-in-out_infinite]"
        style={{ width: 500, height: 500, top: -100, left: -100, background: 'radial-gradient(circle, #6366f1, transparent)' }} />
      <div className="absolute rounded-full blur-[100px] opacity-20 animate-[drift2_16s_ease-in-out_infinite]"
        style={{ width: 400, height: 400, bottom: -50, right: -80, background: 'radial-gradient(circle, #8b5cf6, transparent)' }} />
      <div className="absolute rounded-full blur-[80px] opacity-15 animate-[drift3_10s_ease-in-out_infinite]"
        style={{ width: 300, height: 300, top: '40%', right: '10%', background: 'radial-gradient(circle, #06b6d4, transparent)' }} />
      <style>{`
        @keyframes drift1 { 0%,100%{transform:translate(0,0)} 33%{transform:translate(60px,40px)} 66%{transform:translate(-30px,80px)} }
        @keyframes drift2 { 0%,100%{transform:translate(0,0)} 33%{transform:translate(-50px,-30px)} 66%{transform:translate(40px,-60px)} }
        @keyframes drift3 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-40px,50px)} }
        @keyframes scroll { from{transform:translateX(0)} to{transform:translateX(-50%)} }
      `}</style>
    </div>
  );
}

// ─── University Ticker ────────────────────────────────────────────────────────

function UniTicker({ unis }: { unis: string[] }) {
  const doubled = [...unis, ...unis];
  return (
    <div className="relative overflow-hidden w-full">
      <div className="flex gap-2.5 animate-[scroll_28s_linear_infinite] whitespace-nowrap">
        {doubled.map((uni, i) => (
          <span key={i}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-white/[0.07] border border-white/[0.10] text-white/55 shrink-0">
            <GraduationCap style={{ width: 10, height: 10 }} className="text-primary" />
            {uni}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Activity Card ────────────────────────────────────────────────────────────

function ActivityCard({ items }: { items: ActivityItem[] }) {
  const [idx, setIdx] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (items.length <= 1) return;
    const t = setInterval(() => {
      setFading(true);
      setTimeout(() => { setIdx(v => (v + 1) % items.length); setFading(false); }, 300);
    }, 4000);
    return () => clearInterval(t);
  }, [items.length]);

  const item = items[idx];
  if (!item) return (
    <div className="rounded-2xl bg-white/[0.05] border border-white/[0.08] p-4 animate-pulse h-20" />
  );

  return (
    <div className="rounded-2xl bg-white/[0.06] border border-white/[0.10] p-4 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-[10px] text-white/40 uppercase tracking-[0.15em] font-semibold">Live on TellMeMore</span>
      </div>
      <div className={cn('flex items-center gap-3 transition-all duration-300', fading ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0')}>
        <div className={cn('h-10 w-10 rounded-full bg-gradient-to-br flex items-center justify-center shrink-0 text-white font-bold text-[13px]', item.color)}>
          {item.avatar}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-white leading-tight truncate">
            {item.name}
            {item.uni && <span className="text-white/40 font-normal"> · {item.uni}</span>}
          </p>
          <p className="text-[12px] text-white/50 truncate mt-0.5">{item.action}</p>
        </div>
        <span className="text-[10px] text-white/25 shrink-0">{item.time}</span>
      </div>
      {/* Progress dots */}
      {items.length > 1 && (
        <div className="flex gap-1 mt-3 justify-center">
          {items.slice(0, 6).map((_, i) => (
            <span key={i} className={cn('h-1 rounded-full transition-all duration-300', i === idx % 6 ? 'w-4 bg-primary' : 'w-1 bg-white/20')} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Why TellMeMore Grid ──────────────────────────────────────────────────────

const WHY = [
  { icon: Shield,   label: 'Verified .ac.ke Email',  desc: 'Real students only',       color: 'text-blue-400',   bg: 'bg-blue-500/10'   },
  { icon: Users,    label: 'Academic Groups',         desc: 'Chat by your major',       color: 'text-violet-400', bg: 'bg-violet-500/10' },
  { icon: Heart,    label: 'Peer Wellness',           desc: 'Safe support space',       color: 'text-rose-400',   bg: 'bg-rose-500/10'   },
  { icon: BookOpen, label: 'Opportunities Board',     desc: 'Jobs, scholarships, more', color: 'text-amber-400',  bg: 'bg-amber-500/10'  },
];

// ─── Glass Input ──────────────────────────────────────────────────────────────

function GlassInput({ id, type = 'text', value, onChange, placeholder, required, minLength, icon: Icon }: {
  id: string; type?: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string; required?: boolean; minLength?: number; icon: typeof Mail;
}) {
  return (
    <div className="relative">
      <Icon style={{ width: 14, height: 14 }} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground z-10" />
      <Input id={id} type={type} value={value} onChange={onChange} placeholder={placeholder}
        required={required} minLength={minLength}
        className="pl-9 h-11 text-[13px] bg-black/[0.04] dark:bg-white/[0.05] border-black/[0.08] dark:border-white/[0.08] rounded-xl" />
    </div>
  );
}

// ─── Left Branding Panel ──────────────────────────────────────────────────────

function BrandingPanel() {
  const { stats, activity, unis, recentUsers } = useLivePanelData();

  const STATS_DISPLAY = [
    { value: stats.students,     label: 'Students'     },
    { value: stats.universities, label: 'Universities' },
    { value: stats.posts,        label: 'Posts'        },
    { value: stats.connections,  label: 'Connections'  },
  ];

  return (
    <div className="hidden lg:flex lg:w-[55%] relative flex-col justify-between py-10 px-12 overflow-hidden shrink-0"
      style={{ background: 'linear-gradient(145deg, #07070f 0%, #0b0e1c 50%, #080b18 100%)' }}>

      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)',
        backgroundSize: '52px 52px',
      }} />
      <Orbs />

      <div className="relative z-10 flex flex-col gap-7 flex-1">

        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/40">
            <GraduationCap style={{ width: 20, height: 20 }} className="text-white" />
          </div>
          <span className="text-[20px] font-bold text-white tracking-tight">TellMeMore</span>
          <span className="ml-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">Kenya</span>
        </div>

        {/* Headline */}
        <div>
          <h1 className="text-[44px] font-extrabold text-white leading-[1.05] mb-3 tracking-tight">
            Your Campus.<br />Your People.<br />
            <span className="text-transparent bg-clip-text"
              style={{ backgroundImage: 'linear-gradient(90deg, #818cf8 0%, #a78bfa 50%, #67e8f9 100%)' }}>
              Your Future.
            </span>
          </h1>
          <p className="text-[14px] text-white/45 leading-relaxed max-w-sm">
            The only platform built exclusively for verified Kenyan university students.
          </p>
        </div>

        {/* University ticker — real institutions from DB */}
        <div className="space-y-2">
          <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold">Trusted at</p>
          <UniTicker unis={unis} />
        </div>

        {/* Real-time stats */}
        <div className="grid grid-cols-4 gap-2.5">
          {STATS_DISPLAY.map(s => (
            <div key={s.label} className="rounded-2xl bg-white/[0.05] border border-white/[0.08] px-3 py-3 text-center">
              <p className="text-[20px] font-bold leading-none text-white">
                <AnimatedCounter target={s.value} suffix="+" />
              </p>
              <p className="text-[10px] text-white/40 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Why grid */}
        <div className="grid grid-cols-2 gap-2.5">
          {WHY.map(w => (
            <div key={w.label} className="flex items-start gap-3 rounded-2xl bg-white/[0.04] border border-white/[0.07] p-3.5">
              <div className={cn('h-8 w-8 rounded-xl flex items-center justify-center shrink-0', w.bg)}>
                <w.icon style={{ width: 14, height: 14 }} className={w.color} />
              </div>
              <div>
                <p className="text-[12px] font-semibold text-white leading-tight">{w.label}</p>
                <p className="text-[11px] text-white/40 mt-0.5">{w.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Real-time activity feed */}
        <ActivityCard items={activity} />

        {/* Real recent users avatar stack */}
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            {recentUsers.map((u, i) => (
              <div key={i}
                className={cn('h-7 w-7 rounded-full border-2 border-[#09090f] flex items-center justify-center text-[10px] font-bold text-white', u.color)}>
                {u.initials}
              </div>
            ))}
            {stats.students > recentUsers.length && (
              <div className="h-7 w-7 rounded-full border-2 border-[#09090f] bg-white/10 flex items-center justify-center text-[9px] font-bold text-white/60">
                +{stats.students - recentUsers.length}
              </div>
            )}
          </div>
          <span className="text-[12px] text-white/50">
            {stats.students > 0 ? `${stats.students}+ students connected` : 'Be the first to join!'}
          </span>
        </div>

        {/* Online now pill — real count */}
        {stats.onlineNow > 0 && (
          <div className="inline-flex items-center gap-2 self-start px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/25">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[12px] text-emerald-400 font-semibold">{stats.onlineNow} student{stats.onlineNow !== 1 ? 's' : ''} online right now</span>
          </div>
        )}
      </div>

      <div className="relative z-10 mt-6 pt-4 border-t border-white/[0.06]">
        <p className="text-[11px] text-white/20">© 2026 TellMeMore. Built with Ofiix. · For Kenyan students, by Kenyan students.</p>
      </div>
    </div>
  );
}

// ─── Form Panel ───────────────────────────────────────────────────────────────

function FormPanel({ children, onlineNow }: { children: React.ReactNode; onlineNow: number }) {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-10 relative overflow-hidden min-h-screen">
      <div className="absolute inset-0 dark:hidden pointer-events-none">
        <div className="absolute inset-0 bg-[#f4f5f8]" />
        <div className="absolute top-[-100px] right-[-80px] w-[450px] h-[450px] rounded-full blur-[110px] opacity-50" style={{ background: 'radial-gradient(circle, #c7d2fe, transparent)' }} />
        <div className="absolute bottom-[-80px] left-[-40px] w-[380px] h-[380px] rounded-full blur-[90px] opacity-40" style={{ background: 'radial-gradient(circle, #e9d5ff, transparent)' }} />
      </div>
      <div className="absolute inset-0 hidden dark:block pointer-events-none">
        <div className="absolute inset-0 bg-[#09090f]" />
        <div className="absolute top-[-100px] right-[-80px] w-[400px] h-[400px] rounded-full blur-[120px] opacity-20" style={{ background: 'radial-gradient(circle, #3730a3, transparent)' }} />
        <div className="absolute bottom-[-80px] left-[-40px] w-[350px] h-[350px] rounded-full blur-[100px] opacity-15" style={{ background: 'radial-gradient(circle, #134e4a, transparent)' }} />
      </div>

      <div className="relative z-10 w-full max-w-[380px]">
        {/* Mobile logo */}
        <div className="flex items-center gap-2.5 lg:hidden mb-8">
          <div className="h-10 w-10 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <GraduationCap style={{ width: 18, height: 18 }} className="text-white" />
          </div>
          <div>
            <span className="text-[20px] font-bold text-foreground block leading-none">TellMeMore</span>
            <span className="text-[11px] text-muted-foreground">For Kenyan Students</span>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [onlineNow, setOnlineNow] = useState(0);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [modalError, setModalError] = useState<{ title: string; description: string } | null>(null);
  const [termsConsented, setTermsConsented] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Fetch online count for the right panel pill
  useEffect(() => {
    const fetch = async () => {
      const { count } = await supabase.from('user_presence' as any).select('user_id', { count: 'exact', head: true }).eq('is_online', true);
      setOnlineNow((count as any) ?? 0);
      const { count: students } = await supabase.from('profiles').select('user_id', { count: 'exact', head: true });
      setTotalStudents((students as any) ?? 0);
      const { data } = await supabase.from('profiles').select('full_name').order('created_at' as any, { ascending: false }).limit(5);
      if (data) setRecentUsers(data.map((p: any) => ({ initials: getInitials(p.full_name || '?'), color: bgColorFor(p.full_name || '?') })));
    };
    fetch();
    const ch = supabase.channel('auth-right-presence')
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'user_presence' }, fetch)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess(''); setLoading(true);
    try {
      if (!isLogin) {
        if (!isUniversityEmail(email)) { setError(DOMAIN_ERROR_MESSAGE); setLoading(false); return; }
        if (!termsConsented) { setError('Please accept the Terms of Service and Privacy Policy to continue.'); setLoading(false); return; }
        const { error: signUpError } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: fullName.trim() } },
        });
        if (signUpError) throw signUpError;
        setSuccess('Account created! Check your university email to confirm.');
        toast({ title: 'Account created!', description: 'Check your university email to confirm.' });
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (signInError) throw signInError;
        navigate('/');
      }
    } catch (err: any) {
      const msg = err.message || 'An unexpected error occurred.';
      if (msg.includes('Invalid login') || msg.includes('Email not confirmed') || msg.includes('expired') || msg.includes('rate limit')) {
        setModalError({ title: isLogin ? 'Login Failed' : 'Signup Failed', description: msg.includes('rate limit') ? 'Too many attempts. Please wait a few minutes.' : msg });
      } else { setError(msg); }
    } finally { setLoading(false); }
  };

  const handleGuestAccess = async () => {
    setError(''); setGuestLoading(true);
    try {
      // Sign in anonymously — Supabase marks user.is_anonymous = true automatically.
      // No approval needed. GuestContext reads user.is_anonymous to gate features.
      const { data, error: anonError } = await supabase.auth.signInAnonymously();
      if (anonError) throw anonError;
      const userId = data.user?.id;
      if (!userId) throw new Error('Failed to create guest session.');
      // Best-effort: record the session. Don't block navigation if this fails
      // (e.g. RLS may deny it, which is fine — is_anonymous flag is the source of truth).
      supabase.from('guest_sessions' as any)
        .insert({ user_id: userId, display_name: 'Gate Crusher' } as any)
        .then(() => {/* silent */});
      notify({ title: 'Welcome, Gate Crusher! 👀', description: 'You have 24 hours of view-only access.', variant: 'success' });
      navigate('/');
    } catch (err: any) { setError(err.message || 'Failed to start guest session.'); }
    finally { setGuestLoading(false); }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setSuccess('');
    if (!email.trim()) { setError('Please enter your email address.'); return; }
    setForgotLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
      if (resetError) throw resetError;
      setSuccess('Check your email for a password reset link.');
    } catch (err: any) { setError(err.message || 'Failed to send reset email.'); }
    finally { setForgotLoading(false); }
  };

  const errorModalEl = (
    <ErrorModal open={!!modalError} onClose={() => setModalError(null)}
      title={modalError?.title ?? ''} description={modalError?.description ?? ''}
      variant="error" secondaryAction={{ label: 'Try Again', onClick: () => setModalError(null) }} />
  );

  const FormContent = (
    <div className="space-y-5">
      {/* Online pill */}
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-[11px] text-primary font-semibold uppercase tracking-wider">
          {onlineNow > 0 ? `${onlineNow} Student${onlineNow !== 1 ? 's' : ''} Online Now` : 'Students Online Now'}
        </span>
      </div>

      <div>
        <h2 className="text-[28px] font-bold text-foreground tracking-tight leading-tight">
          {isLogin ? 'Welcome back 👋' : 'Join the community'}
        </h2>
        <p className="text-[13px] text-muted-foreground mt-1.5">
          {isLogin ? 'Sign in with your university credentials.' : 'Register with your .ac.ke email to get started.'}
        </p>
      </div>

      {/* Toggle */}
      <div className="flex gap-1 p-1 rounded-2xl bg-black/[0.05] dark:bg-white/[0.06]">
        {([{ id: true, label: 'Sign In', icon: LogIn }, { id: false, label: 'Sign Up', icon: UserPlus }] as const).map(t => (
          <button key={String(t.id)} type="button"
            onClick={() => { setIsLogin(t.id); setError(''); setSuccess(''); }}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[13px] font-semibold rounded-xl transition-all duration-200',
              isLogin === t.id
                ? 'bg-white dark:bg-white/[0.10] text-foreground shadow-sm shadow-black/[0.08]'
                : 'text-muted-foreground hover:text-foreground',
            )}>
            <t.icon style={{ width: 13, height: 13 }} />{t.label}
          </button>
        ))}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {error && <Alert variant="destructive" className="py-2.5 rounded-xl"><ShieldAlert className="h-4 w-4" /><AlertDescription className="text-[13px]">{error}</AlertDescription></Alert>}
        {success && <Alert className="border-emerald-500/30 bg-emerald-500/10 py-2.5 rounded-xl"><CheckCircle2 className="h-4 w-4 text-emerald-500" /><AlertDescription className="text-[13px] text-emerald-600 dark:text-emerald-400">{success}</AlertDescription></Alert>}

        {!isLogin && (
          <div className="space-y-1.5">
            <Label htmlFor="fullName" className="text-[13px] font-medium">Full Name</Label>
            <GlassInput id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jane Doe" required={!isLogin} icon={UserIcon} />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-[13px] font-medium">University Email</Label>
          <GlassInput id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@students.university.ac.ke" required icon={Mail} />
          {!isLogin && <p className="text-[11px] text-muted-foreground">Must be a valid .ac.ke university email</p>}
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-[13px] font-medium">Password</Label>
            {isLogin && <button type="button" onClick={() => setShowForgot(true)} className="text-[11px] text-primary hover:underline">Forgot password?</button>}
          </div>
          <GlassInput id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} icon={Lock} />
          {!isLogin && <p className="text-[11px] text-muted-foreground">Minimum 6 characters</p>}
        </div>
        {/* Terms consent — only shown on signup */}
        {!isLogin && (
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={termsConsented}
              onChange={e => setTermsConsented(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded accent-primary shrink-0"
            />
            <span className="text-[12px] text-muted-foreground leading-relaxed">
              I agree to the{' '}
              <a href="/terms" target="_blank" className="text-primary hover:underline font-medium">Terms of Service</a>
              {' '}and{' '}
              <a href="/privacy" target="_blank" className="text-primary hover:underline font-medium">Privacy Policy</a>
            </span>
          </label>
        )}
        <Button type="submit" disabled={loading}
          className="w-full h-12 rounded-xl text-[14px] font-semibold gap-2 mt-1 shadow-lg shadow-primary/20">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : isLogin ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
          {loading ? 'Please wait…' : isLogin ? 'Sign In' : 'Create Account'}
          {!loading && <ArrowRight className="h-4 w-4 ml-auto" />}
        </Button>
      </form>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-black/[0.07] dark:bg-white/[0.08]" />
        <span className="text-[11px] text-muted-foreground uppercase tracking-wider">or</span>
        <div className="flex-1 h-px bg-black/[0.07] dark:bg-white/[0.08]" />
      </div>

      <div className="space-y-2.5">
        <button type="button" disabled={guestLoading} onClick={handleGuestAccess}
          className={cn(
            'w-full h-11 rounded-xl text-[13px] font-medium flex items-center justify-center gap-2 transition-all',
            'bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.06] dark:hover:bg-white/[0.08]',
            'border border-dashed border-black/[0.12] dark:border-white/[0.10] text-foreground',
          )}>
          {guestLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
          {guestLoading ? 'Starting session…' : '👀 Explore as Gate Crusher (24h)'}
        </button>
        <p className="text-[11px] text-muted-foreground text-center">View-only · No messaging · No posting · No video calls</p>
      </div>

      {/* Real avatar stack */}
      <div className="flex items-center justify-center gap-2 pt-1">
        <div className="flex -space-x-1.5">
          {recentUsers.map((u, i) => (
            <div key={i} className={cn('h-6 w-6 rounded-full border-2 border-background flex items-center justify-center text-[9px] font-bold text-white', u.color)}>
              {u.initials}
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          {totalStudents > 0 ? `${totalStudents}+ students already connected` : 'Be the first to join!'}
        </p>
      </div>

      <p className="text-[11px] text-muted-foreground text-center">
        By signing in you agree to our{' '}
        <a href="#" className="underline hover:text-foreground">Terms of Service</a>{' & '}
        <a href="#" className="underline hover:text-foreground">Privacy Policy</a>.
      </p>
    </div>
  );

  if (showForgot) return (
    <>
      {errorModalEl}
      <div className="flex min-h-screen">
        <BrandingPanel />
        <FormPanel onlineNow={onlineNow}>
          <div className="space-y-6">
            <div>
              <h2 className="text-[26px] font-bold text-foreground tracking-tight">Reset Password</h2>
              <p className="text-[13px] text-muted-foreground mt-1">Enter your university email to get a reset link.</p>
            </div>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              {error && <Alert variant="destructive" className="py-2.5 rounded-xl"><ShieldAlert className="h-4 w-4" /><AlertDescription className="text-[13px]">{error}</AlertDescription></Alert>}
              {success && <Alert className="border-emerald-500/30 bg-emerald-500/10 py-2.5 rounded-xl"><CheckCircle2 className="h-4 w-4 text-emerald-500" /><AlertDescription className="text-[13px] text-emerald-600 dark:text-emerald-400">{success}</AlertDescription></Alert>}
              <div className="space-y-1.5">
                <Label htmlFor="resetEmail" className="text-[13px] font-medium">University Email</Label>
                <GlassInput id="resetEmail" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@university.ac.ke" required icon={Mail} />
              </div>
              <Button type="submit" className="w-full h-11 rounded-xl text-[13px] gap-2" disabled={forgotLoading}>
                {forgotLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                {forgotLoading ? 'Sending…' : 'Send Reset Link'}
              </Button>
              <button type="button" onClick={() => { setShowForgot(false); setError(''); setSuccess(''); }}
                className="w-full text-[13px] text-muted-foreground hover:text-foreground transition-colors text-center">
                ← Back to Sign In
              </button>
            </form>
          </div>
        </FormPanel>
      </div>
    </>
  );

  return (
    <>
      {errorModalEl}
      <div className="flex min-h-screen">
        <BrandingPanel />
        <FormPanel onlineNow={onlineNow}>{FormContent}</FormPanel>
      </div>
    </>
  );
}