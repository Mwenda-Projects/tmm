import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useGuestStatus } from '@/contexts/GuestContext';
import { useThemePreference } from '@/contexts/ThemeContext';
import { Disclaimer } from '@/components/Disclaimer';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import {
  User, Building2, LogOut, Sun, Moon, Monitor,
  ShieldCheck, ShieldAlert, GraduationCap, Clock,
  FileText, Users, Calendar, CheckCircle2, Circle,
  Palette, Settings, AlertTriangle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { usePushNotifications } from '@/hooks/usePushNotifications';

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

// ─── Logo Detection ───────────────────────────────────────────────────────────

async function getUniversityDomain(name: string): Promise<string | null> {
  try {
    const res = await fetch(`https://universities.hipolabs.com/search?name=${encodeURIComponent(name.trim())}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data: { name: string; domains: string[] }[] = await res.json();
    if (!data?.length) return null;
    const lower = name.toLowerCase();
    const match = data.find(u => u.name.toLowerCase() === lower) || data.find(u => u.name.toLowerCase().includes(lower.split(' ')[0].toLowerCase())) || data[0];
    return match?.domains?.[0] || null;
  } catch { return null; }
}

async function tryLogoPathsOnDomain(domain: string): Promise<string | null> {
  const paths = [`https://${domain}/images/logo.png`, `https://${domain}/images/logo.svg`, `https://${domain}/assets/logo.png`, `https://www.${domain}/images/logo.png`];
  for (const url of paths) {
    try {
      const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(2500) });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && (ct.includes('image') || ct.includes('svg'))) return url;
    } catch { continue; }
  }
  return null;
}

async function fetchInstitutionLogoUrl(name: string): Promise<string | null> {
  if (!name.trim()) return null;
  const cacheKey = name.trim().toLowerCase();
  try {
    const { data: cached } = await (supabase as any).from('institution_logos').select('logo_url').eq('institution_name', cacheKey).maybeSingle();
    if (cached?.logo_url) return cached.logo_url;
  } catch { }
  const domain = await getUniversityDomain(name);
  let logoUrl: string | null = null;
  if (domain) {
    logoUrl = await tryLogoPathsOnDomain(domain) ?? `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
  } else {
    const firstWord = name.toLowerCase().split(/\s+/).find(w => !['university','college','institute','school','of','the','and','&'].includes(w))?.replace(/[^a-z0-9]/g, '');
    if (firstWord) logoUrl = `https://www.google.com/s2/favicons?domain=${firstWord}.ac.ke&sz=128`;
  }
  if (logoUrl) {
    try { await (supabase as any).from('institution_logos').upsert({ institution_name: cacheKey, logo_url: logoUrl }).select(); } catch { }
  }
  return logoUrl;
}

// ─── Institution Logo ─────────────────────────────────────────────────────────

function InstitutionLogo({ institutionName, manualLogoUrl, fallbackInitials, className = 'h-16 w-16' }: {
  institutionName: string; manualLogoUrl?: string; fallbackInitials: string; className?: string;
}) {
  const [logoUrl, setLogoUrl] = useState<string | null>(manualLogoUrl || null);
  const [imgFailed, setImgFailed] = useState(false);
  const [fetching, setFetching] = useState(false);

  const resolve = useCallback(async () => {
    setImgFailed(false);
    if (manualLogoUrl) { setLogoUrl(manualLogoUrl); return; }
    if (!institutionName.trim()) { setLogoUrl(null); return; }
    setFetching(true);
    setLogoUrl(await fetchInstitutionLogoUrl(institutionName));
    setFetching(false);
  }, [institutionName, manualLogoUrl]);

  useEffect(() => { resolve(); }, [resolve]);

  if (fetching) return <div className={`${className} rounded-full bg-white/10 animate-pulse shrink-0`} />;
  if (!logoUrl || imgFailed) return (
    <Avatar className={`${className} shrink-0`}>
      <AvatarFallback className="bg-primary/10 text-primary font-bold">{fallbackInitials}</AvatarFallback>
    </Avatar>
  );
  return <img src={logoUrl} alt={institutionName} className={`${className} rounded-full object-contain bg-white shrink-0`} onError={() => setImgFailed(true)} />;
}

// ─── Guest Countdown ──────────────────────────────────────────────────────────

function GuestCountdown({ expiresAt }: { expiresAt: Date }) {
  const [remaining, setRemaining] = useState('');
  useEffect(() => {
    const tick = () => {
      const diff = expiresAt.getTime() - Date.now();
      if (diff <= 0) { setRemaining('Expired'); return; }
      const h = Math.floor(diff / 3_600_000), m = Math.floor((diff % 3_600_000) / 60_000), s = Math.floor((diff % 60_000) / 1_000);
      setRemaining(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
    };
    tick(); const id = setInterval(tick, 1_000); return () => clearInterval(id);
  }, [expiresAt]);
  return (
    <GlassCard className="flex items-center gap-3 p-4 border-rose-500/20 dark:border-rose-500/20">
      <ShieldAlert className="h-5 w-5 text-rose-500 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-rose-500">Gate Crusher — Guest Session</p>
        <p className="text-xs text-muted-foreground">Read-only access. Register with a university email to unlock all features.</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Clock className="h-4 w-4 text-rose-500" />
        <span className="font-mono text-sm font-bold text-rose-500">{remaining}</span>
      </div>
    </GlassCard>
  );
}

// ─── Profile Completion ───────────────────────────────────────────────────────

function ProfileCompletion({ fullName, institutionName, majorName }: {
  fullName: string; institutionName: string; majorName: string | null;
}) {
  const checks = [
    { label: 'Full name added', done: !!fullName.trim() },
    { label: 'Institution set', done: !!institutionName.trim() },
    { label: 'Major selected', done: !!majorName },
  ];
  const pct = Math.round((checks.filter(c => c.done).length / checks.length) * 100);

  return (
    <GlassCard className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold text-foreground">Profile Completion</p>
        <span className={`text-[13px] font-bold ${pct === 100 ? 'text-emerald-500' : 'text-primary'}`}>{pct}%</span>
      </div>
      <Progress value={pct} className="h-1.5" />
      <div className="flex gap-4 flex-wrap pt-0.5">
        {checks.map(c => (
          <div key={c.label} className="flex items-center gap-1.5">
            {c.done
              ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              : <Circle className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />}
            <span className={`text-[12px] ${c.done ? 'text-foreground' : 'text-muted-foreground'}`}>{c.label}</span>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

// ─── Theme Card ───────────────────────────────────────────────────────────────

function ThemeCard({ value, label, icon: Icon, current, onClick, preview }: {
  value: string; label: string; icon: typeof Sun; current: string; onClick: () => void;
  preview: { bg: string; bar: string; line: string };
}) {
  const active = current === value;
  return (
    <button onClick={onClick}
      className={cn(
        'relative flex-1 rounded-2xl p-3 text-left transition-all duration-200',
        'backdrop-blur-xl',
        active
          ? 'bg-white/90 dark:bg-white/[0.10] shadow-[0_0_0_1.5px_hsl(var(--primary))] shadow-sm'
          : 'bg-white/40 dark:bg-white/[0.04] border border-white/50 dark:border-white/[0.06] hover:bg-white/60 dark:hover:bg-white/[0.07]',
      )}>
      {/* Mini preview */}
      <div className={`rounded-xl p-2 mb-3 ${preview.bg}`}>
        <div className={`h-2 w-10 rounded-full mb-1.5 ${preview.bar}`} />
        <div className={`h-1.5 w-7 rounded-full ${preview.line}`} />
        <div className={`h-1.5 w-9 rounded-full mt-1 ${preview.line}`} />
      </div>
      <div className="flex items-center gap-1.5">
        <Icon style={{ width: 13, height: 13 }} className={active ? 'text-primary' : 'text-muted-foreground'} />
        <span className={`text-[12px] font-semibold ${active ? 'text-primary' : 'text-foreground'}`}>{label}</span>
      </div>
      {active && (
        <div className="absolute top-2 right-2 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
          <CheckCircle2 style={{ width: 10, height: 10 }} className="text-primary-foreground" />
        </div>
      )}
    </button>
  );
}

// ─── Tab type ─────────────────────────────────────────────────────────────────

type Tab = 'profile' | 'appearance' | 'account';

// ─── Main ─────────────────────────────────────────────────────────────────────

// ─── Push Notification Card ───────────────────────────────────────────────────
function PushNotificationCard() {
  const { isSupported, permission, isSubscribed, isLoading, subscribe, unsubscribe } = usePushNotifications();

  if (!isSupported) {
    return (
      <GlassCard className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🔔</span>
          <h2 className="text-[13px] font-semibold text-foreground">Push Notifications</h2>
        </div>
        <p className="text-[12px] text-muted-foreground">
          Push notifications are not supported on this browser. Try Chrome on Android or desktop.
        </p>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-7 w-7 rounded-xl bg-violet-500/10 flex items-center justify-center">
          <span className="text-[14px]">🔔</span>
        </div>
        <h2 className="text-[13px] font-semibold text-foreground">Push Notifications</h2>
      </div>

      <div className="flex items-center justify-between gap-4 p-3 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.06]">
        <div>
          <p className="text-[13px] font-medium text-foreground">
            {isSubscribed ? 'Notifications enabled' : 'Get notified instantly'}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {permission === 'denied'
              ? 'Blocked in browser settings — enable in site permissions'
              : isSubscribed
              ? 'Messages, calls and activity will notify you'
              : 'Stay updated on messages, calls and campus activity'}
          </p>
        </div>

        {permission === 'denied' ? (
          <span className="text-[11px] text-rose-400 shrink-0">Blocked</span>
        ) : (
          <Button
            size="sm"
            variant={isSubscribed ? 'outline' : 'default'}
            onClick={isSubscribed ? unsubscribe : subscribe}
            disabled={isLoading}
            className="shrink-0 rounded-xl text-[12px] h-8"
          >
            {isLoading ? '...' : isSubscribed ? 'Turn off' : 'Enable'}
          </Button>
        )}
      </div>
    </GlassCard>
  );
}

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const { isGuest, expiresAt } = useGuestStatus();
  const { theme, setTheme } = useThemePreference();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [fullName, setFullName] = useState('');
  const [institutionName, setInstitutionName] = useState('');
  const [institutionLogoUrl, setInstitutionLogoUrl] = useState('');
  const [majorName, setMajorName] = useState<string | null>(null);
  const [postCount, setPostCount] = useState(0);
  const [groupCount, setGroupCount] = useState(0);
  const [memberSince, setMemberSince] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [previewInstitution, setPreviewInstitution] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setPreviewInstitution(institutionName), 900);
    return () => clearTimeout(t);
  }, [institutionName]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [profileRes, majorMapRes, postRes, groupRes] = await Promise.all([
        supabase.from('profiles').select('full_name, institution_name, institution_logo_url').eq('user_id', user.id).single(),
        supabase.from('user_major_map').select('major_id').eq('user_id', user.id).limit(1).maybeSingle(),
        supabase.from('thought_posts').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('group_members').select('group_id', { count: 'exact', head: true }).eq('user_id', user.id),
      ]);
      if (profileRes.data) {
        setFullName(profileRes.data.full_name || '');
        setInstitutionName(profileRes.data.institution_name || '');
        setInstitutionLogoUrl(profileRes.data.institution_logo_url || '');
        setPreviewInstitution(profileRes.data.institution_name || '');
      }
      if (majorMapRes.data?.major_id) {
        const { data: major } = await supabase.from('majors').select('name').eq('id', majorMapRes.data.major_id).single();
        if (major) setMajorName(major.name);
      }
      setPostCount(postRes.count ?? 0);
      setGroupCount(groupRes.count ?? 0);
      setMemberSince(user.created_at ?? null);
      setLoading(false);
    };
    load();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      full_name: fullName.trim() || null,
      institution_name: institutionName.trim() || null,
      institution_logo_url: institutionLogoUrl.trim() || null,
    }).eq('user_id', user.id);
    if (error) toast({ title: 'Error', description: 'Failed to save.', variant: 'destructive' });
    else { toast({ title: 'Profile updated.' }); setPreviewInstitution(institutionName); }
    setSaving(false);
  };

  const handleLogout = async () => { await signOut(); navigate('/auth'); };

  if (!user || loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );

  const initials = (fullName || user.email || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const isVerified = !isGuest;
  const tabs: { id: Tab; label: string; icon: typeof User }[] = [
    { id: 'profile',    label: 'Profile',    icon: User },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'account',    label: 'Account',    icon: Settings },
  ];

  return (
    <div className="min-h-screen relative overflow-hidden">

      {/* ── GRADIENT MESH BACKGROUND (matches dashboard) ── */}
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
      <div className="relative z-10 max-w-2xl mx-auto px-6 pt-10 pb-16 space-y-4">

        <h1 className="text-[32px] font-semibold text-foreground tracking-tight">Profile & Settings</h1>

        {isGuest && expiresAt && <GuestCountdown expiresAt={expiresAt} />}

        {/* ── Profile Card ── */}
        <GlassCard className="p-5">
          <div className="flex items-start gap-4">
            <InstitutionLogo
              institutionName={previewInstitution}
              manualLogoUrl={institutionLogoUrl || undefined}
              fallbackInitials={initials}
              className="h-16 w-16"
            />
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-[17px] font-semibold text-foreground truncate">{fullName || 'Anonymous'}</h2>
                {isVerified
                  ? <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      <ShieldCheck style={{ width: 11, height: 11 }} /> Verified
                    </span>
                  : <span className="flex items-center gap-1 text-[11px] font-medium text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-full">
                      <ShieldAlert style={{ width: 11, height: 11 }} /> Guest
                    </span>
                }
              </div>
              <p className="text-[13px] text-muted-foreground truncate">{user.email}</p>
              {institutionName && (
                <p className="text-[13px] text-muted-foreground flex items-center gap-1">
                  <Building2 style={{ width: 12, height: 12 }} /> {institutionName}
                </p>
              )}
              {majorName && (
                <p className="text-[13px] text-muted-foreground flex items-center gap-1">
                  <GraduationCap style={{ width: 12, height: 12 }} /> {majorName}
                </p>
              )}
            </div>

            {/* Stats */}
            <div className="hidden sm:flex items-center gap-4 shrink-0 self-center">
              {[
                { label: 'Posts', value: postCount, icon: FileText },
                { label: 'Groups', value: groupCount, icon: Users },
                { label: memberSince ? formatDistanceToNow(new Date(memberSince), { addSuffix: false }) : '—', value: null, icon: Calendar },
              ].map((s, i, arr) => (
                <div key={s.label} className="flex items-center gap-4">
                  <div className="text-center">
                    {s.value !== null && <p className="text-[18px] font-semibold text-foreground leading-none">{s.value}</p>}
                    <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 justify-center mt-0.5">
                      <s.icon style={{ width: 10, height: 10 }} /> {s.label}
                    </p>
                  </div>
                  {i < arr.length - 1 && <div className="h-7 w-px bg-border" />}
                </div>
              ))}
            </div>
          </div>

          {/* University badge */}
          {previewInstitution && (
            <div className="mt-4 flex items-center gap-2.5 bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.07] rounded-2xl px-3 py-2.5 w-fit">
              <InstitutionLogo
                institutionName={previewInstitution}
                manualLogoUrl={institutionLogoUrl || undefined}
                fallbackInitials={initials}
                className="h-7 w-7"
              />
              <div>
                <p className="text-[12px] font-semibold text-foreground leading-tight">{previewInstitution}</p>
                <p className="text-[10px] text-muted-foreground">Verified Institution</p>
              </div>
            </div>
          )}
        </GlassCard>

        {/* ── Completion ── */}
        {isVerified && (
          <ProfileCompletion fullName={fullName} institutionName={institutionName} majorName={majorName} />
        )}

        {/* ── Tabs ── */}
        <GlassCard className="p-1 flex gap-0.5">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-[14px] text-[13px] font-medium transition-all duration-150',
                activeTab === tab.id
                  ? 'bg-white dark:bg-white/[0.09] text-foreground shadow-[0_0_0_1px_rgba(0,0,0,0.06)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08)] shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-black/[0.03] dark:hover:bg-white/[0.04]',
              )}>
              <tab.icon style={{ width: 13, height: 13 }} />
              {tab.label}
            </button>
          ))}
        </GlassCard>

        {/* ── Tab: Profile ── */}
        {activeTab === 'profile' && isVerified && (
          <GlassCard className="p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-7 w-7 rounded-xl bg-primary/10 flex items-center justify-center">
                <User style={{ width: 13, height: 13 }} className="text-primary" />
              </div>
              <h2 className="text-[13px] font-semibold text-foreground">Edit Profile</h2>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[12px] text-muted-foreground">Email</Label>
              <Input value={user.email || ''} disabled className="bg-black/[0.03] dark:bg-white/[0.03] border-black/[0.08] dark:border-white/[0.08] rounded-xl text-[13px]" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px] text-muted-foreground">Full Name</Label>
              <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jane Doe"
                className="bg-black/[0.03] dark:bg-white/[0.03] border-black/[0.08] dark:border-white/[0.08] rounded-xl text-[13px]" />
            </div>

            <Separator className="opacity-50" />

            <div className="space-y-1.5">
              <Label className="text-[12px] text-muted-foreground">Institution Name</Label>
              <Input value={institutionName} onChange={e => setInstitutionName(e.target.value)} placeholder="Technical University of Kenya"
                className="bg-black/[0.03] dark:bg-white/[0.03] border-black/[0.08] dark:border-white/[0.08] rounded-xl text-[13px]" />
              <p className="text-[11px] text-muted-foreground/60">Logo auto-detected and cached — first lookup may take a few seconds.</p>
            </div>

            {previewInstitution && (
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.06]">
                <InstitutionLogo institutionName={previewInstitution} manualLogoUrl={institutionLogoUrl || undefined} fallbackInitials={initials} className="h-9 w-9" />
                <div>
                  <p className="text-[12px] font-semibold text-foreground">{previewInstitution}</p>
                  <p className="text-[10px] text-muted-foreground">Logo preview · auto-detected</p>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-[12px] text-muted-foreground">
                Logo URL <span className="text-muted-foreground/40 font-normal">(optional override)</span>
              </Label>
              <Input value={institutionLogoUrl} onChange={e => setInstitutionLogoUrl(e.target.value)}
                placeholder="https://… (leave blank for auto-detect)" type="url"
                className="bg-black/[0.03] dark:bg-white/[0.03] border-black/[0.08] dark:border-white/[0.08] rounded-xl text-[13px]" />
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full rounded-xl h-10 text-[13px]">
              {saving ? 'Saving…' : 'Save Profile'}
            </Button>
          </GlassCard>
        )}

        {activeTab === 'profile' && !isVerified && (
          <GlassCard className="py-10 text-center space-y-2">
            <ShieldAlert className="h-8 w-8 text-rose-500 mx-auto" />
            <p className="font-semibold text-foreground">Guest accounts can't edit profiles</p>
            <p className="text-[13px] text-muted-foreground">Register with a university email to unlock full access.</p>
            <Button className="mt-2 rounded-xl" onClick={() => navigate('/auth')}>Create Account</Button>
          </GlassCard>
        )}

        {/* ── Tab: Appearance ── */}
        {activeTab === 'appearance' && (
          <GlassCard className="p-5">
            <div className="flex items-center gap-2 mb-5">
              <div className="h-7 w-7 rounded-xl bg-violet-500/10 flex items-center justify-center">
                <Palette style={{ width: 13, height: 13 }} className="text-violet-500" />
              </div>
              <h2 className="text-[13px] font-semibold text-foreground">Theme</h2>
            </div>
            <div className="flex gap-3">
              <ThemeCard value="light" label="Light" icon={Sun} current={theme} onClick={() => setTheme('light')}
                preview={{ bg: 'bg-white border border-gray-100', bar: 'bg-gray-800', line: 'bg-gray-200' }} />
              <ThemeCard value="dark" label="Dark" icon={Moon} current={theme} onClick={() => setTheme('dark')}
                preview={{ bg: 'bg-[#0d0d0f] border border-white/10', bar: 'bg-white/80', line: 'bg-white/10' }} />
              <ThemeCard value="system" label="System" icon={Monitor} current={theme} onClick={() => setTheme('system')}
                preview={{ bg: 'bg-gradient-to-r from-white to-[#0d0d0f] border border-gray-300', bar: 'bg-gray-500', line: 'bg-gray-300' }} />
            </div>
            <p className="text-[11px] text-muted-foreground/60 mt-3">System mode follows your device preference automatically.</p>
          </GlassCard>
        )}

        {/* ── Tab: Account ── */}
        {activeTab === 'account' && (
          <div className="space-y-4">
            {/* Info */}
            <GlassCard className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-7 w-7 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Settings style={{ width: 13, height: 13 }} className="text-blue-500" />
                </div>
                <h2 className="text-[13px] font-semibold text-foreground">Account Info</h2>
              </div>
              <div className="space-y-0">
                {[
                  { label: 'Email', value: user.email },
                  { label: 'Account type', value: isVerified ? 'Verified Student' : 'Guest' },
                  { label: 'Member since', value: memberSince ? new Date(memberSince).toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' }) : '—' },
                  { label: 'Posts created', value: String(postCount) },
                  { label: 'Groups joined', value: String(groupCount) },
                ].map((row, i, arr) => (
                  <div key={row.label} className={cn('flex items-center justify-between py-2.5', i < arr.length - 1 && 'border-b border-black/[0.05] dark:border-white/[0.05]')}>
                    <span className="text-[13px] text-muted-foreground">{row.label}</span>
                    <span className="text-[13px] font-medium text-foreground">{row.value}</span>
                  </div>
                ))}
              </div>
            </GlassCard>

            {/* Push Notifications */}
            <PushNotificationCard />

            {/* Disclaimer */}
            <GlassCard className="p-5">
              <Disclaimer />
            </GlassCard>

            {/* Danger Zone */}
            <GlassCard className="p-5 border-rose-500/20 dark:border-rose-500/15">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle style={{ width: 14, height: 14 }} className="text-rose-500" />
                <h2 className="text-[13px] font-semibold text-rose-500">Danger Zone</h2>
              </div>
              <div className="flex items-center justify-between gap-4 p-3 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.06]">
                <div>
                  <p className="text-[13px] font-medium text-foreground">Sign out of TellMeMore</p>
                  <p className="text-[11px] text-muted-foreground">You'll need to sign back in to access your account.</p>
                </div>
                <Button variant="destructive" size="sm" onClick={handleLogout} className="shrink-0 gap-1.5 rounded-xl text-[12px]">
                  <LogOut style={{ width: 12, height: 12 }} /> Sign Out
                </Button>
              </div>
            </GlassCard>
          </div>
        )}

      </div>
    </div>
  );
}