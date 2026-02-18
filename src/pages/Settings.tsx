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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import {
  User, Building2, LogOut, Sun, Moon, Monitor,
  ShieldCheck, ShieldAlert, GraduationCap, Clock,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// ─── Logo Detection + Caching ─────────────────────────────────────────────────

/** Gets university domain from Hipolabs API */
async function getUniversityDomain(name: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://universities.hipolabs.com/search?name=${encodeURIComponent(name.trim())}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data: { name: string; domains: string[] }[] = await res.json();
    if (!data?.length) return null;

    const lower = name.toLowerCase();
    const match =
      data.find(u => u.name.toLowerCase() === lower) ||
      data.find(u => u.name.toLowerCase().includes(lower.split(' ')[0].toLowerCase())) ||
      data[0];

    return match?.domains?.[0] || null;
  } catch {
    return null;
  }
}

/** Probes common logo paths on a domain to find an actual image */
async function tryLogoPathsOnDomain(domain: string): Promise<string | null> {
  const paths = [
    `https://${domain}/images/logo.png`,
    `https://${domain}/images/logo.svg`,
    `https://${domain}/assets/logo.png`,
    `https://${domain}/assets/images/logo.png`,
    `https://${domain}/logo.png`,
    `https://www.${domain}/images/logo.png`,
    `https://www.${domain}/assets/logo.png`,
    `https://www.${domain}/logo.png`,
  ];

  for (const url of paths) {
    try {
      const res = await fetch(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(2500),
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && (ct.includes('image') || ct.includes('svg'))) {
        return url;
      }
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Full logo resolution with Supabase caching.
 *
 * Flow:
 *   1. Check Supabase cache → return instantly if found
 *   2. Get real domain from Hipolabs API
 *   3. Probe logo paths on the university website
 *   4. Fall back to Google favicon (always works)
 *   5. Save result to Supabase cache for all future users
 */
async function fetchInstitutionLogoUrl(name: string): Promise<string | null> {
  if (!name.trim()) return null;
  const cacheKey = name.trim().toLowerCase();

  // ── Step 1: Check cache ──
  try {
    const { data: cached } = await (supabase as any)
      .from('institution_logos')
      .select('logo_url')
      .eq('institution_name', cacheKey)
      .maybeSingle();

    if (cached?.logo_url) {
      console.log(`[Logo] Cache hit for "${name}"`);
      return cached.logo_url;
    }
  } catch {
    // Cache table may not exist yet — continue
  }

  console.log(`[Logo] Cache miss for "${name}" — detecting...`);

  // ── Step 2: Get real domain ──
  const domain = await getUniversityDomain(name);
  let logoUrl: string | null = null;

  if (domain) {
    // ── Step 3: Try logo paths on university website ──
    logoUrl = await tryLogoPathsOnDomain(domain);

    // ── Step 4: Fall back to Google favicon ──
    if (!logoUrl) {
      logoUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
    }
  } else {
    // No domain found — guess from name
    const firstWord = name
      .toLowerCase()
      .split(/\s+/)
      .find(w => !['university', 'college', 'institute', 'school', 'of', 'the', 'and', '&'].includes(w))
      ?.replace(/[^a-z0-9]/g, '');

    if (firstWord) {
      logoUrl = `https://www.google.com/s2/favicons?domain=${firstWord}.ac.ke&sz=128`;
    }
  }

  // ── Step 5: Save to cache so every future user gets it instantly ──
  if (logoUrl) {
    try {
      await (supabase as any)
        .from('institution_logos')
        .upsert({ institution_name: cacheKey, logo_url: logoUrl })
        .select();
      console.log(`[Logo] Cached "${name}" → ${logoUrl}`);
    } catch {
      // Cache write failed — not critical, logo still shows
    }
  }

  return logoUrl;
}

// ─── InstitutionLogo Component ────────────────────────────────────────────────

function InstitutionLogo({
  institutionName,
  manualLogoUrl,
  fallbackInitials,
  className = 'h-16 w-16',
}: {
  institutionName: string;
  manualLogoUrl?: string;
  fallbackInitials: string;
  className?: string;
}) {
  const [logoUrl, setLogoUrl] = useState<string | null>(manualLogoUrl || null);
  const [imgFailed, setImgFailed] = useState(false);
  const [fetching, setFetching] = useState(false);

  const resolve = useCallback(async () => {
    setImgFailed(false);

    if (manualLogoUrl) {
      setLogoUrl(manualLogoUrl);
      return;
    }

    if (!institutionName.trim()) {
      setLogoUrl(null);
      return;
    }

    setFetching(true);
    const url = await fetchInstitutionLogoUrl(institutionName);
    setLogoUrl(url);
    setFetching(false);
  }, [institutionName, manualLogoUrl]);

  useEffect(() => { resolve(); }, [resolve]);

  if (fetching) {
    return (
      <div className={`${className} rounded-full bg-muted animate-pulse border-2 border-border shrink-0`} />
    );
  }

  if (!logoUrl || imgFailed) {
    return (
      <Avatar className={`${className} border-2 border-border shrink-0`}>
        <AvatarFallback className="text-lg font-bold bg-primary/10 text-primary">
          {fallbackInitials}
        </AvatarFallback>
      </Avatar>
    );
  }

  return (
    <img
      src={logoUrl}
      alt={institutionName}
      className={`${className} rounded-full object-contain bg-white border-2 border-border shrink-0`}
      onError={() => setImgFailed(true)}
    />
  );
}

// ─── Guest Countdown ──────────────────────────────────────────────────────────

function GuestCountdown({ expiresAt }: { expiresAt: Date }) {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    const tick = () => {
      const diff = expiresAt.getTime() - Date.now();
      if (diff <= 0) { setRemaining('Expired'); return; }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      setRemaining(
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      );
    };
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return (
    <Card className="border-destructive/40 bg-destructive/5">
      <CardContent className="flex items-center gap-3 py-4">
        <ShieldAlert className="h-5 w-5 text-destructive shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-destructive">Gate Crusher — Guest Session</p>
          <p className="text-xs text-muted-foreground">
            Read-only access. Register with a university email (.ac.ke / .edu) to unlock all features.
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Clock className="h-4 w-4 text-destructive" />
          <span className="font-mono text-sm font-bold text-destructive">{remaining}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Settings Page ───────────────────────────────────────────────────────

export default function Settings() {
  const { user, signOut } = useAuth();
  const { isGuest, expiresAt } = useGuestStatus();
  const { theme, setTheme } = useThemePreference();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [institutionName, setInstitutionName] = useState('');
  const [institutionLogoUrl, setInstitutionLogoUrl] = useState('');
  const [majorName, setMajorName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Debounced — waits 900ms after user stops typing before fetching logo
  const [previewInstitution, setPreviewInstitution] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setPreviewInstitution(institutionName), 900);
    return () => clearTimeout(t);
  }, [institutionName]);

  useEffect(() => {
    if (!user) return;
    const loadProfile = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, institution_name, institution_logo_url')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        setFullName(profile.full_name || '');
        setInstitutionName(profile.institution_name || '');
        setInstitutionLogoUrl(profile.institution_logo_url || '');
        setPreviewInstitution(profile.institution_name || '');
      }

      const { data: majorMap } = await supabase
        .from('user_major_map')
        .select('major_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (majorMap?.major_id) {
        const { data: major } = await supabase
          .from('majors')
          .select('name')
          .eq('id', majorMap.major_id)
          .single();
        if (major) setMajorName(major.name);
      }

      setLoading(false);
    };
    loadProfile();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim() || null,
        institution_name: institutionName.trim() || null,
        institution_logo_url: institutionLogoUrl.trim() || null,
      })
      .eq('user_id', user.id);

    if (error) {
      toast({ title: 'Error', description: 'Failed to save profile.', variant: 'destructive' });
    } else {
      toast({ title: 'Profile updated!' });
      setPreviewInstitution(institutionName);
    }
    setSaving(false);
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  if (!user || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const initials = (fullName || user.email || '?')
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const isVerified = !isGuest;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Profile & Settings</h1>

        {isGuest && expiresAt && <GuestCountdown expiresAt={expiresAt} />}

        {/* Profile Card */}
        <Card>
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
                  <h2 className="text-lg font-semibold text-foreground truncate">
                    {fullName || 'Anonymous'}
                  </h2>
                  {isVerified ? (
                    <Badge variant="default" className="gap-1 text-[10px]">
                      <ShieldCheck className="h-3 w-3" /> Verified
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="gap-1 text-[10px]">
                      <ShieldAlert className="h-3 w-3" /> Guest
                    </Badge>
                  )}
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
            </div>
          </CardContent>
        </Card>

        {/* Edit Profile */}
        {isVerified && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" /> Edit Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={user.email || ''} disabled />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Your name"
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="instName">Institution Name</Label>
                <Input
                  id="instName"
                  value={institutionName}
                  onChange={e => setInstitutionName(e.target.value)}
                  placeholder="Technical University of Kenya"
                />
                <p className="text-[11px] text-muted-foreground">
                  Logo auto-detected and cached — first lookup may take a few seconds.
                </p>
              </div>

              {/* Live logo preview */}
              {previewInstitution && (
                <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
                  <InstitutionLogo
                    institutionName={previewInstitution}
                    manualLogoUrl={institutionLogoUrl || undefined}
                    fallbackInitials={initials}
                    className="h-10 w-10"
                  />
                  <div>
                    <p className="text-xs font-medium text-foreground">{previewInstitution}</p>
                    <p className="text-[10px] text-muted-foreground">Logo preview · auto-detected</p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="instLogo">
                  Logo URL{' '}
                  <span className="text-[10px] text-muted-foreground font-normal">(optional override)</span>
                </Label>
                <Input
                  id="instLogo"
                  value={institutionLogoUrl}
                  onChange={e => setInstitutionLogoUrl(e.target.value)}
                  placeholder="https://… (leave blank for auto-detect)"
                  type="url"
                />
              </div>

              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? 'Saving…' : 'Save Profile'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Appearance</CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={theme}
              onValueChange={v => setTheme(v as 'light' | 'dark' | 'system')}
              className="flex gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="light" id="theme-light" />
                <Label htmlFor="theme-light" className="flex items-center gap-1 cursor-pointer">
                  <Sun className="h-4 w-4" /> Light
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="dark" id="theme-dark" />
                <Label htmlFor="theme-dark" className="flex items-center gap-1 cursor-pointer">
                  <Moon className="h-4 w-4" /> Dark
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="system" id="theme-system" />
                <Label htmlFor="theme-system" className="flex items-center gap-1 cursor-pointer">
                  <Monitor className="h-4 w-4" /> System
                </Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        <Separator />

        <Button variant="destructive" onClick={handleLogout} className="w-full">
          <LogOut className="h-4 w-4 mr-2" /> Sign Out
        </Button>

        <Separator />

        <Card>
          <CardContent className="pt-5">
            <Disclaimer />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}