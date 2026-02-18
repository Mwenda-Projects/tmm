import { useState, useEffect } from 'react';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import {
  User, Building2, LogOut, Sun, Moon, Monitor,
  ShieldCheck, ShieldAlert, GraduationCap, Clock,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

function GuestCountdown({ expiresAt }: { expiresAt: Date }) {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    const tick = () => {
      const diff = expiresAt.getTime() - Date.now();
      if (diff <= 0) { setRemaining('Expired'); return; }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      setRemaining(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
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
      }

      // Fetch major
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
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const isVerified = !isGuest;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Profile & Settings</h1>

        {/* Guest countdown banner */}
        {isGuest && expiresAt && <GuestCountdown expiresAt={expiresAt} />}

        {/* Profile Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <Avatar className="h-16 w-16 border-2 border-border">
                {institutionLogoUrl ? (
                  <AvatarImage src={institutionLogoUrl} alt="Profile" />
                ) : null}
                <AvatarFallback className="text-lg font-bold bg-primary/10 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>

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

        {/* Edit Profile — only for verified */}
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
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="instName">Institution Name</Label>
                <Input
                  id="instName"
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  placeholder="University of Nairobi"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="instLogo">Logo URL</Label>
                <Input
                  id="instLogo"
                  value={institutionLogoUrl}
                  onChange={(e) => setInstitutionLogoUrl(e.target.value)}
                  placeholder="https://…"
                  type="url"
                />
              </div>
              {institutionLogoUrl && (
                <img
                  src={institutionLogoUrl}
                  alt="Institution logo"
                  className="h-12 w-12 rounded object-contain border border-border"
                />
              )}
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
              onValueChange={(v) => setTheme(v as 'light' | 'dark' | 'system')}
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
