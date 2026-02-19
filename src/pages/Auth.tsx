import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { isUniversityEmail, DOMAIN_ERROR_MESSAGE } from '@/lib/auth-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { ErrorModal } from '@/components/ErrorModal';
import { notify } from '@/lib/notify';
import {
  Eye, LogIn, UserPlus, Loader2, GraduationCap, CheckCircle2,
  Mail, Lock, User as UserIcon, ShieldAlert, MessageSquare,
  Users, FileText, Heart, Zap, ArrowRight,
} from 'lucide-react';

// ─── Animated Counter ─────────────────────────────────────────────────────────

function AnimatedCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const duration = 1500;
    const steps = 40;
    const increment = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) { setCount(target); clearInterval(timer); }
      else setCount(Math.floor(current));
    }, duration / steps);
    return () => clearInterval(timer);
  }, [target]);
  return <span>{count.toLocaleString()}{suffix}</span>;
}

// ─── Live Stat Pill ───────────────────────────────────────────────────────────

function StatPill({ icon: Icon, label, value, color }: {
  icon: typeof Users; label: string; value: number; color: string;
}) {
  return (
    <div className="flex items-center gap-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3">
      <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-lg font-bold text-white leading-none">
          <AnimatedCounter target={value} suffix="+" />
        </p>
        <p className="text-[11px] text-white/50 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

// ─── Floating Activity Card ───────────────────────────────────────────────────

const ACTIVITY = [
  { name: 'Wanjiru M.', uni: 'UoN', action: 'posted a scholarship', time: '2m ago', avatar: 'W' },
  { name: 'Odhiambo K.', uni: 'KU', action: 'joined Engineering group', time: '5m ago', avatar: 'O' },
  { name: 'Achieng F.', uni: 'Strathmore', action: 'liked your post', time: '8m ago', avatar: 'A' },
  { name: 'Mwangi T.', uni: 'JKUAT', action: 'found an internship', time: '12m ago', avatar: 'M' },
];

function ActivityFeed() {
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setVisible(v => (v + 1) % ACTIVITY.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const item = ACTIVITY[visible];

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 transition-all duration-500">
      <div className="flex items-center gap-1.5 mb-3">
        <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
        <span className="text-[11px] text-white/40 uppercase tracking-wider">Live Activity</span>
      </div>
      <div key={visible} className="flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shrink-0">
          <span className="text-sm font-bold text-white">{item.avatar}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white truncate">{item.name}
            <span className="text-white/40 font-normal"> · {item.uni}</span>
          </p>
          <p className="text-xs text-white/50 truncate">{item.action}</p>
        </div>
        <span className="text-[10px] text-white/30 shrink-0">{item.time}</span>
      </div>
    </div>
  );
}

// ─── Left Branding Panel ──────────────────────────────────────────────────────

function BrandingPanel() {
  const features = [
    { icon: MessageSquare, label: 'Real-time messaging & video calls', color: 'text-blue-400' },
    { icon: Users, label: 'Academic groups by major', color: 'text-purple-400' },
    { icon: Heart, label: 'Wellness & peer support resources', color: 'text-rose-400' },
    { icon: FileText, label: 'Scholarships, internships & events', color: 'text-amber-400' },
  ];

  return (
    <div className="hidden lg:flex lg:w-[55%] relative flex-col justify-between p-12 overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #0a0f1e 0%, #0d1528 40%, #0a1a2e 100%)',
      }}
    >
      {/* Background grid */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Glow orbs */}
      <div className="absolute top-[-100px] left-[-100px] h-[400px] w-[400px] rounded-full bg-primary/20 blur-[120px]" />
      <div className="absolute bottom-[-50px] right-[-50px] h-[300px] w-[300px] rounded-full bg-blue-500/10 blur-[100px]" />

      {/* Logo */}
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-12">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
            <GraduationCap className="h-6 w-6" />
          </div>
          <span className="text-2xl font-bold text-white tracking-tight">TellMeMore</span>
        </div>

        {/* Headline */}
        <h2 className="text-4xl font-bold text-white leading-tight mb-4">
          Connect with<br />
          <span className="text-transparent bg-clip-text"
            style={{ backgroundImage: 'linear-gradient(90deg, #6366f1, #818cf8)' }}>
            students who<br />get it.
          </span>
        </h2>
        <p className="text-white/50 text-sm leading-relaxed mb-10 max-w-xs">
          Built exclusively for Kenyan university students. Share opportunities, collaborate, and grow together.
        </p>

        {/* Features */}
        <div className="space-y-3 mb-10">
          {features.map(f => (
            <div key={f.label} className="flex items-center gap-3">
              <div className="h-7 w-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                <f.icon className={`h-3.5 w-3.5 ${f.color}`} />
              </div>
              <span className="text-sm text-white/60">{f.label}</span>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          <StatPill icon={Users} label="Students" value={120} color="bg-primary/20 text-primary" />
          <StatPill icon={GraduationCap} label="Universities" value={15} color="bg-blue-500/20 text-blue-400" />
          <StatPill icon={FileText} label="Posts Shared" value={48} color="bg-amber-500/20 text-amber-400" />
          <StatPill icon={Zap} label="Connections" value={230} color="bg-green-500/20 text-green-400" />
        </div>

        {/* Live Activity */}
        <ActivityFeed />
      </div>

      {/* Bottom tag */}
      <div className="relative z-10 mt-8">
        <p className="text-[11px] text-white/20">© 2026 TellMeMore. Built with Ofiix.</p>
      </div>
    </div>
  );
}

// ─── Auth Form ────────────────────────────────────────────────────────────────

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
  const [modalError, setModalError] = useState<{ title: string; description: string } | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess(''); setLoading(true);
    try {
      if (!isLogin) {
        if (!isUniversityEmail(email)) { setError(DOMAIN_ERROR_MESSAGE); setLoading(false); return; }
        const { error: signUpError } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: fullName.trim() } },
        });
        if (signUpError) throw signUpError;
        setSuccess('Account created! Check your university email to confirm.');
        toast({ title: 'Account created', description: 'Check your university email to confirm your account.' });
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (signInError) throw signInError;
        navigate('/');
      }
    } catch (err: any) {
      const msg = err.message || 'An unexpected error occurred.';
      if (msg.includes('Invalid login') || msg.includes('Email not confirmed') || msg.includes('expired') || msg.includes('rate limit')) {
        setModalError({ title: isLogin ? 'Login Failed' : 'Signup Failed', description: msg.includes('rate limit') ? 'Too many attempts. Please wait a few minutes before trying again.' : msg });
      } else { setError(msg); }
    } finally { setLoading(false); }
  };

  const handleGuestAccess = async () => {
    setError(''); setSuccess(''); setGuestLoading(true);
    try {
      const { data, error: anonError } = await supabase.auth.signInAnonymously();
      if (anonError) throw anonError;
      const userId = data.user?.id;
      if (!userId) throw new Error('Failed to create guest session.');
      const { error: insertError } = await supabase.from('guest_sessions' as any).insert({ user_id: userId, display_name: 'Guest' } as any);
      if (insertError) throw insertError;
      notify({ title: 'Welcome, Guest!', description: 'You have 24 hours of view-only access.', variant: 'success' });
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
    <ErrorModal
      open={!!modalError} onClose={() => setModalError(null)}
      title={modalError?.title ?? ''} description={modalError?.description ?? ''}
      variant="error" secondaryAction={{ label: 'Try Again', onClick: () => setModalError(null) }}
    />
  );

  // ── Forgot Password View ──
  if (showForgot) {
    return (
      <>
        {errorModalEl}
        <div className="flex min-h-screen bg-background">
          <BrandingPanel />
          <div className="flex flex-1 items-center justify-center px-6 py-8">
            <div className="w-full max-w-sm space-y-6">
              {/* Mobile logo */}
              <div className="flex items-center gap-2.5 lg:hidden">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <span className="text-xl font-bold text-foreground">TellMeMore</span>
              </div>

              <div className="space-y-1">
                <h2 className="text-2xl font-bold text-foreground">Reset Password</h2>
                <p className="text-sm text-muted-foreground">Enter your email to receive a reset link.</p>
              </div>

              <form onSubmit={handleForgotPassword} className="space-y-4">
                {error && <Alert variant="destructive" className="py-2.5"><ShieldAlert className="h-4 w-4" /><AlertDescription className="text-sm">{error}</AlertDescription></Alert>}
                {success && <Alert className="border-green-500/30 bg-green-500/10 py-2.5"><CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" /><AlertDescription className="text-sm text-green-700 dark:text-green-300">{success}</AlertDescription></Alert>}

                <div className="space-y-1.5">
                  <Label htmlFor="resetEmail">University Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="resetEmail" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@university.ac.ke" required className="pl-9 h-11" />
                  </div>
                </div>

                <Button type="submit" className="w-full h-11" disabled={forgotLoading}>
                  {forgotLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                  {forgotLoading ? 'Sending…' : 'Send Reset Link'}
                </Button>
                <button type="button" className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors text-center"
                  onClick={() => { setShowForgot(false); setError(''); setSuccess(''); }}>
                  ← Back to Sign In
                </button>
              </form>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── Main Auth View ──
  return (
    <>
      {errorModalEl}
      <div className="flex min-h-screen bg-background">

        <BrandingPanel />

        {/* Right form panel */}
        <div className="flex flex-1 items-center justify-center px-6 py-8"
          style={{ background: 'var(--background)' }}
        >
          <div className="w-full max-w-sm space-y-6">

            {/* Mobile logo */}
            <div className="flex items-center gap-2.5 lg:hidden">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <GraduationCap className="h-5 w-5" />
              </div>
              <span className="text-xl font-bold text-foreground">TellMeMore</span>
            </div>

            {/* Heading */}
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-foreground">
                {isLogin ? 'Welcome back' : 'Join TellMeMore'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isLogin ? 'Sign in to continue to TellMeMore.' : 'Register with your university email to get started.'}
              </p>
            </div>

            {/* Toggle tabs */}
            <div className="flex gap-1 p-1 bg-muted rounded-lg">
              <button
                type="button"
                onClick={() => { setIsLogin(true); setError(''); setSuccess(''); }}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${isLogin ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setIsLogin(false); setError(''); setSuccess(''); }}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${!isLogin ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Sign Up
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <Alert variant="destructive" className="py-2.5"><ShieldAlert className="h-4 w-4" /><AlertDescription className="text-sm">{error}</AlertDescription></Alert>}
              {success && <Alert className="border-green-500/30 bg-green-500/10 py-2.5"><CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" /><AlertDescription className="text-sm text-green-700 dark:text-green-300">{success}</AlertDescription></Alert>}

              {!isLogin && (
                <div className="space-y-1.5">
                  <Label htmlFor="fullName">Full Name</Label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jane Doe" required={!isLogin} className="pl-9 h-11" />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email">University Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@university.ac.ke" required className="pl-9 h-11" />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  {isLogin && (
                    <button type="button" onClick={() => setShowForgot(true)} className="text-xs text-primary hover:text-primary/80 transition-colors">
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} className="pl-9 h-11" />
                </div>
                {!isLogin && <p className="text-[11px] text-muted-foreground">Minimum 6 characters</p>}
              </div>

              <Button type="submit" className="w-full h-11 gap-2" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : isLogin ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                {loading ? 'Please wait…' : isLogin ? 'Sign In' : 'Create Account'}
                {!loading && <ArrowRight className="h-4 w-4 ml-auto" />}
              </Button>
            </form>

            {/* Guest access */}
            <div className="space-y-3">
              <div className="relative">
                <Separator />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-3 text-[11px] text-muted-foreground uppercase tracking-wider">or</span>
              </div>

              <Button type="button" variant="outline" className="w-full h-11 gap-2 border-dashed" disabled={guestLoading} onClick={handleGuestAccess}>
                {guestLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                {guestLoading ? 'Starting…' : 'Explore as Gate Crusher (24h)'}
              </Button>
              <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
                View-only guest access for 24 hours. No messaging, posting, or video calls.
              </p>
            </div>

            <p className="text-[11px] text-muted-foreground text-center">
              By signing in you agree to our{' '}
              <a href="#" className="underline hover:text-foreground transition-colors">Terms of Service</a>.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}