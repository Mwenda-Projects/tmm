import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useGuestStatus } from '@/contexts/GuestContext';
import { useThemePreference } from '@/contexts/ThemeContext';
import { Disclaimer } from '@/components/Disclaimer';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
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

// ─── Kenyan Universities Marquee ──────────────────────────────────────────────

const KENYAN_UNIVERSITIES = [
  { name: 'University of Nairobi', domain: 'uonbi.ac.ke', short: 'UoN' },
  { name: 'Kenyatta University', domain: 'ku.ac.ke', short: 'KU' },
  { name: 'Strathmore University', domain: 'strathmore.edu', short: 'SU' },
  { name: 'JKUAT', domain: 'jkuat.ac.ke', short: 'JKUAT' },
  { name: 'Moi University', domain: 'mu.ac.ke', short: 'MU' },
  { name: 'Technical Univ. Kenya', domain: 'tukenya.ac.ke', short: 'TUK' },
  { name: 'Egerton University', domain: 'egerton.ac.ke', short: 'EU' },
  { name: 'Maseno University', domain: 'maseno.ac.ke', short: 'MSU' },
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

function UniversityLogoItem({ uni }: { uni: typeof KENYAN_UNIVERSITIES[0] }) {
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <div className="flex flex-col items-center gap-2 py-3 px-2 group">
      <div className="h-12 w-12 rounded-xl bg-muted/40 border border-border flex items-center justify-center overflow-hidden group-hover:border-primary/30 group-hover:bg-primary/5 transition-all duration-300">
        {!imgFailed ? (
          <img src={`https://www.google.com/s2/favicons?domain=${uni.domain}&sz=64`} alt={uni.name}
            className="h-8 w-8 object-contain" onError={() => setImgFailed(true)} />
        ) : (
          <span className="text-[10px] font-bold text-muted-foreground text-center leading-tight px-1">{uni.short}</span>
        )}
      </div>
      <span className="text-[9px] text-muted-foreground/60 text-center leading-tight max-w-[72px] truncate">{uni.short}</span>
    </div>
  );
}

function VerticalMarquee({ direction = 'down' }: { direction?: 'up' | 'down' }) {
  const doubled = [...KENYAN_UNIVERSITIES, ...KENYAN_UNIVERSITIES];
  return (
    <div className="relative h-full overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-16 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, var(--background), transparent)' }} />
      <div className="absolute bottom-0 left-0 right-0 h-16 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to top, var(--background), transparent)' }} />
      <div className="flex flex-col"
        style={{ animation: `marquee-${direction} ${direction === 'down' ? '35s' : '40s'} linear infinite` }}>
        {doubled.map((uni, i) => <UniversityLogoItem key={`${uni.domain}-${i}`} uni={uni} />)}
      </div>
      <style>{`
        @keyframes marquee-down { 0% { transform: translateY(0); } 100% { transform: translateY(-50%); } }
        @keyframes marquee-up { 0% { transform: translateY(-50%); } 100% { transform: translateY(0); } }
      `}</style>
    </div>
  );
}

// ─── Logo Detection + Caching ─────────────────────────────────────────────────

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

// ─── InstitutionLogo ──────────────────────────────────────────────────────────

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

  if (fetching) return <div className={`${className} rounded-full bg-muted animate-pulse border-2 border-border shrink-0`} />;
  if (!logoUrl || imgFailed) return (
    <Avatar className={`${className} border-2 border-border shrink-0`}>
      <AvatarFallback className="text-lg font-bold bg-primary/10 text-primary">{fallbackInitials}</AvatarFallback>
    </Avatar>
  );
  return <img src={logoUrl} alt={institutionName} className={`${className} rounded-full object-contain bg-white border-2 border-border shrink-0`} onError={() => setImgFailed(true)} />;
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
    <Card className="border-destructive/40 bg-destructive/5">
      <CardContent className="flex items-center gap-3 py-4">
        <ShieldAlert className="h-5 w-5 text-destructive shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-destructive">Gate Crusher — Guest Session</p>
          <p className="text-xs text-muted-foreground">Read-only access. Register with a university email to unlock all features.</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Clock className="h-4 w-4 text-destructive" />
          <span className="font-mono text-sm font-bold text-destructive">{remaining}</span>
        </div>
      </CardContent>
    </Card>
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
  const completed = checks.filter(c => c.done).length;
  const pct = Math.round((completed / checks.length) * 100);

  return (
    <Card className="border-border">
      <CardContent className="pt-5 pb-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Profile Completion</p>
          <span className={`text-sm font-bold ${pct === 100 ? 'text-green-500' : 'text-primary'}`}>{pct}%</span>
        </div>
        <Progress value={pct} className="h-2" />
        <div className="flex gap-4 flex-wrap pt-1">
          {checks.map(c => (
            <div key={c.label} className="flex items-center gap-1.5">
              {c.done
                ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                : <Circle className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />}
              <span className={`text-[11px] ${c.done ? 'text-foreground' : 'text-muted-foreground'}`}>{c.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Theme Card ───────────────────────────────────────────────────────────────

function ThemeCard({ value, label, icon: Icon, current, onClick, preview }: {
  value: string; label: string; icon: typeof Sun; current: string; onClick: () => void;
  preview: { bg: string; card: string; accent: string };
}) {
  const active = current === value;
  return (
    <button onClick={onClick}
      className={`relative flex-1 rounded-xl border-2 p-3 text-left transition-all ${active ? 'border-primary shadow-sm shadow-primary/20' : 'border-border hover:border-primary/40'}`}>
      <div className={`rounded-lg p-2 mb-3 ${preview.bg}`}>
        <div className={`h-2 w-12 rounded-full mb-1.5 ${preview.accent}`} />
        <div className={`h-1.5 w-8 rounded-full ${preview.card}`} />
        <div className={`h-1.5 w-10 rounded-full mt-1 ${preview.card}`} />
      </div>
      <div className="flex items-center gap-1.5">
        <Icon className={`h-3.5 w-3.5 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
        <span className={`text-xs font-medium ${active ? 'text-primary' : 'text-foreground'}`}>{label}</span>
      </div>
      {active && (
        <div className="absolute top-2 right-2 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
          <CheckCircle2 className="h-3 w-3 text-primary-foreground" />
        </div>
      )}
    </button>
  );
}

// ─── Tab type ─────────────────────────────────────────────────────────────────

type Tab = 'profile' | 'appearance' | 'account';

// ─── Main Settings Page ───────────────────────────────────────────────────────

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
    else { toast({ title: 'Profile updated!' }); setPreviewInstitution(institutionName); }
    setSaving(false);
  };

  const handleLogout = async () => { await signOut(); navigate('/auth'); };

  if (!user || loading) return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-muted-foreground">Loading…</p>
    </div>
  );

  const initials = (fullName || user.email || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const isVerified = !isGuest;

  const tabs: { id: Tab; label: string; icon: typeof User }[] = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'account', label: 'Account', icon: Settings },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-[88px_1fr_88px] gap-2 items-start">

        {/* ── Left Marquee ── */}
        <div className="hidden lg:block sticky top-8" style={{ height: 'calc(100vh - 4rem)' }}>
          <VerticalMarquee direction="down" />
        </div>

        {/* ── Main Content ── */}
        <main className="px-2 max-w-2xl mx-auto w-full space-y-4">

          <h1 className="text-2xl font-bold text-foreground">Profile & Settings</h1>

          {isGuest && expiresAt && <GuestCountdown expiresAt={expiresAt} />}

          {/* ── Profile Card ── */}
          <Card className="border-border">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <InstitutionLogo
                  institutionName={previewInstitution}
                  manualLogoUrl={institutionLogoUrl || undefined}
                  fallbackInitials={initials}
                  className="h-16 w-16"
                />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-semibold text-foreground truncate">{fullName || 'Anonymous'}</h2>
                    {isVerified
                      ? <Badge variant="default" className="gap-1 text-[10px]"><ShieldCheck className="h-3 w-3" />Verified</Badge>
                      : <Badge variant="destructive" className="gap-1 text-[10px]"><ShieldAlert className="h-3 w-3" />Guest</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                  {institutionName && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5" /> {institutionName}
                    </p>
                  )}
                  {majorName && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <GraduationCap className="h-3.5 w-3.5" /> {majorName}
                    </p>
                  )}
                </div>

                {/* Account stats */}
                <div className="hidden sm:flex items-center gap-4 shrink-0 self-center">
                  <div className="text-center">
                    <p className="text-lg font-bold text-foreground">{postCount}</p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 justify-center"><FileText className="h-3 w-3" />Posts</p>
                  </div>
                  <div className="h-8 w-px bg-border" />
                  <div className="text-center">
                    <p className="text-lg font-bold text-foreground">{groupCount}</p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 justify-center"><Users className="h-3 w-3" />Groups</p>
                  </div>
                  <div className="h-8 w-px bg-border" />
                  <div className="text-center">
                    <p className="text-[11px] font-semibold text-foreground">
                      {memberSince ? formatDistanceToNow(new Date(memberSince), { addSuffix: false }) : '—'}
                    </p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 justify-center"><Calendar className="h-3 w-3" />Member</p>
                  </div>
                </div>
              </div>

              {/* University badge */}
              {previewInstitution && (
                <div className="mt-4 flex items-center gap-2.5 bg-muted/40 border border-border rounded-xl px-3 py-2 w-fit">
                  <InstitutionLogo
                    institutionName={previewInstitution}
                    manualLogoUrl={institutionLogoUrl || undefined}
                    fallbackInitials={initials}
                    className="h-7 w-7"
                  />
                  <div>
                    <p className="text-xs font-semibold text-foreground leading-tight">{previewInstitution}</p>
                    <p className="text-[10px] text-muted-foreground">Verified Institution</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Profile Completion ── */}
          {isVerified && (
            <ProfileCompletion fullName={fullName} institutionName={institutionName} majorName={majorName} />
          )}

          {/* ── Tabs ── */}
          <div className="flex gap-1 p-1 bg-muted rounded-xl">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Tab: Profile ── */}
          {activeTab === 'profile' && isVerified && (
            <Card className="border-border">
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  Edit Profile
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input value={user.email || ''} disabled className="bg-muted/50" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jane Doe" />
                </div>
                <Separator />
                <div className="space-y-1.5">
                  <Label htmlFor="instName">Institution Name</Label>
                  <Input id="instName" value={institutionName} onChange={e => setInstitutionName(e.target.value)} placeholder="Technical University of Kenya" />
                  <p className="text-[11px] text-muted-foreground">Logo auto-detected and cached — first lookup may take a few seconds.</p>
                </div>
                {previewInstitution && (
                  <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/30">
                    <InstitutionLogo institutionName={previewInstitution} manualLogoUrl={institutionLogoUrl || undefined} fallbackInitials={initials} className="h-10 w-10" />
                    <div>
                      <p className="text-xs font-semibold text-foreground">{previewInstitution}</p>
                      <p className="text-[10px] text-muted-foreground">Logo preview · auto-detected</p>
                    </div>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="instLogo">Logo URL <span className="text-[10px] text-muted-foreground font-normal">(optional override)</span></Label>
                  <Input id="instLogo" value={institutionLogoUrl} onChange={e => setInstitutionLogoUrl(e.target.value)} placeholder="https://… (leave blank for auto-detect)" type="url" />
                </div>
                <Button onClick={handleSave} disabled={saving} className="w-full h-10">
                  {saving ? 'Saving…' : 'Save Profile'}
                </Button>
              </CardContent>
            </Card>
          )}

          {activeTab === 'profile' && !isVerified && (
            <Card className="border-border">
              <CardContent className="py-8 text-center space-y-2">
                <ShieldAlert className="h-8 w-8 text-destructive mx-auto" />
                <p className="font-semibold text-foreground">Guest accounts can't edit profiles</p>
                <p className="text-sm text-muted-foreground">Register with a university email to unlock full access.</p>
                <Button className="mt-2" onClick={() => navigate('/auth')}>Create Account</Button>
              </CardContent>
            </Card>
          )}

          {/* ── Tab: Appearance ── */}
          {activeTab === 'appearance' && (
            <Card className="border-border">
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <Palette className="h-4 w-4 text-purple-500" />
                  </div>
                  Theme
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <ThemeCard value="light" label="Light" icon={Sun} current={theme} onClick={() => setTheme('light')}
                    preview={{ bg: 'bg-white border border-gray-200', card: 'bg-gray-200', accent: 'bg-blue-500' }} />
                  <ThemeCard value="dark" label="Dark" icon={Moon} current={theme} onClick={() => setTheme('dark')}
                    preview={{ bg: 'bg-gray-900 border border-gray-700', card: 'bg-gray-700', accent: 'bg-blue-400' }} />
                  <ThemeCard value="system" label="System" icon={Monitor} current={theme} onClick={() => setTheme('system')}
                    preview={{ bg: 'bg-gradient-to-r from-white to-gray-900 border border-gray-400', card: 'bg-gray-400', accent: 'bg-blue-500' }} />
                </div>
                <p className="text-[11px] text-muted-foreground mt-3">System mode follows your device preference automatically.</p>
              </CardContent>
            </Card>
          )}

          {/* ── Tab: Account ── */}
          {activeTab === 'account' && (
            <div className="space-y-4">
              <Card className="border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Settings className="h-4 w-4 text-blue-500" />
                    </div>
                    Account Info
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-0">
                  {[
                    { label: 'Email', value: user.email },
                    { label: 'Account type', value: isVerified ? 'Verified Student' : 'Guest' },
                    { label: 'Member since', value: memberSince ? new Date(memberSince).toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' }) : '—' },
                    { label: 'Posts created', value: String(postCount) },
                    { label: 'Groups joined', value: String(groupCount) },
                  ].map((row, i, arr) => (
                    <div key={row.label} className={`flex items-center justify-between py-2.5 ${i < arr.length - 1 ? 'border-b border-border' : ''}`}>
                      <span className="text-sm text-muted-foreground">{row.label}</span>
                      <span className="text-sm font-medium text-foreground">{row.value}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardContent className="pt-5"><Disclaimer /></CardContent>
              </Card>

              {/* Danger Zone */}
              <Card className="border-destructive/40 bg-destructive/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-4 w-4" /> Danger Zone
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between gap-4 p-3 rounded-lg border border-destructive/20 bg-background">
                    <div>
                      <p className="text-sm font-medium text-foreground">Sign out of TellMeMore</p>
                      <p className="text-xs text-muted-foreground">You'll need to sign back in to access your account.</p>
                    </div>
                    <Button variant="destructive" size="sm" onClick={handleLogout} className="shrink-0 gap-1.5">
                      <LogOut className="h-3.5 w-3.5" /> Sign Out
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

        </main>

        {/* ── Right Marquee ── */}
        <div className="hidden lg:block sticky top-8" style={{ height: 'calc(100vh - 4rem)' }}>
          <VerticalMarquee direction="up" />
        </div>

      </div>
    </div>
  );
}