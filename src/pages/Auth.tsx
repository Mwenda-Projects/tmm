import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { isUniversityEmail, DOMAIN_ERROR_MESSAGE } from '@/lib/auth-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { ErrorModal } from '@/components/ErrorModal';
import { notify } from '@/lib/notify';
import {
  Eye, LogIn, UserPlus, Loader2, GraduationCap, CheckCircle2,
  Mail, Lock, User as UserIcon, ShieldAlert,
} from 'lucide-react';

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
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (!isLogin) {
        if (!isUniversityEmail(email)) {
          setError(DOMAIN_ERROR_MESSAGE);
          setLoading(false);
          return;
        }

        const { error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName.trim() },
          },
        });

        if (signUpError) throw signUpError;

        setSuccess('Account created! Check your university email to confirm.');
        toast({
          title: 'Account created',
          description: 'Check your university email to confirm your account.',
        });
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (signInError) throw signInError;
        navigate('/');
      }
    } catch (err: any) {
      const msg = err.message || 'An unexpected error occurred.';
      // Show modal for critical auth errors
      if (msg.includes('Invalid login') || msg.includes('Email not confirmed') || msg.includes('expired') || msg.includes('rate limit')) {
        const description = msg.includes('rate limit')
          ? 'Too many attempts. Please wait a few minutes before trying again.'
          : msg;
        setModalError({ title: isLogin ? 'Login Failed' : 'Signup Failed', description });
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGuestAccess = async () => {
    setError('');
    setSuccess('');
    setGuestLoading(true);

    try {
      const { data, error: anonError } = await supabase.auth.signInAnonymously();
      if (anonError) throw anonError;

      const userId = data.user?.id;
      if (!userId) throw new Error('Failed to create guest session.');

      const { error: insertError } = await supabase
        .from('guest_sessions' as any)
        .insert({ user_id: userId, display_name: 'Guest' } as any);

      if (insertError) throw insertError;

      notify({ title: 'Welcome, Guest!', description: 'You have 24 hours of view-only access.', variant: 'success' });
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Failed to start guest session.');
    } finally {
      setGuestLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    setForgotLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) throw resetError;
      setSuccess('Check your email for a password reset link.');
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email.');
    } finally {
      setForgotLoading(false);
    }
  };

  const errorModalEl = (
    <ErrorModal
      open={!!modalError}
      onClose={() => setModalError(null)}
      title={modalError?.title ?? ''}
      description={modalError?.description ?? ''}
      variant="error"
      secondaryAction={{ label: 'Try Again', onClick: () => setModalError(null) }}
    />
  );

  if (showForgot) {
    return (
      <>
        {errorModalEl}
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md space-y-6">
          <div className="flex items-center justify-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold text-foreground">TellMeMore</span>
          </div>

          <Card className="border-border shadow-sm">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-xl font-semibold">Reset Password</CardTitle>
              <CardDescription className="text-sm">
                Enter your email to receive a reset link.
              </CardDescription>
            </CardHeader>

            <form onSubmit={handleForgotPassword}>
              <CardContent className="space-y-4">
                {error && (
                  <Alert variant="destructive" className="py-2.5">
                    <ShieldAlert className="h-4 w-4" />
                    <AlertDescription className="text-sm">{error}</AlertDescription>
                  </Alert>
                )}
                {success && (
                  <Alert className="border-green-500/30 bg-green-500/10 py-2.5">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <AlertDescription className="text-sm text-green-700 dark:text-green-300">
                      {success}
                    </AlertDescription>
                  </Alert>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="resetEmail">University Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="resetEmail"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@university.ac.ke"
                      required
                      className="pl-9"
                    />
                  </div>
                </div>
              </CardContent>

              <CardFooter className="flex flex-col gap-3 pt-0">
                <Button type="submit" className="w-full h-10" disabled={forgotLoading}>
                  {forgotLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                  {forgotLoading ? 'Sending…' : 'Send Reset Link'}
                </Button>
                <button
                  type="button"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => { setShowForgot(false); setError(''); setSuccess(''); }}
                >
                  Back to Sign In
                </button>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>
      </>
    );
  }

  return (
    <>
      {errorModalEl}
    <div className="flex min-h-screen bg-background">
      {/* Left branding panel — hidden on mobile */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center bg-primary/5 p-12">
        <div className="max-w-md space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <GraduationCap className="h-6 w-6" />
            </div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">TellMeMore</h1>
          </div>
          <p className="text-lg text-muted-foreground leading-relaxed">
            A platform built exclusively for Kenyan university students to connect, collaborate, and thrive.
          </p>
          <div className="space-y-3 pt-4">
            {[
              'Real-time messaging & video calls',
              'Academic groups by major',
              'Wellness & peer support resources',
              'Scholarships, internships & events',
            ].map((feature) => (
              <div key={feature} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8">
        <div className="w-full max-w-md space-y-6">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold text-foreground">TellMeMore</span>
          </div>

          <Card className="border-border shadow-sm">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-xl font-semibold">
                {isLogin ? 'Welcome back' : 'Create your account'}
              </CardTitle>
              <CardDescription className="text-sm">
                {isLogin
                  ? 'Sign in to continue to TellMeMore.'
                  : 'Register with your university email (.ac.ke or .edu).'}
              </CardDescription>
            </CardHeader>

            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                {/* Error */}
                {error && (
                  <Alert variant="destructive" className="py-2.5">
                    <ShieldAlert className="h-4 w-4" />
                    <AlertDescription className="text-sm">{error}</AlertDescription>
                  </Alert>
                )}

                {/* Success */}
                {success && (
                  <Alert className="border-green-500/30 bg-green-500/10 py-2.5">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <AlertDescription className="text-sm text-green-700 dark:text-green-300">
                      {success}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Full Name (signup only) */}
                {!isLogin && (
                  <div className="space-y-1.5">
                    <Label htmlFor="fullName">Full Name</Label>
                    <div className="relative">
                      <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="fullName"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Jane Doe"
                        required={!isLogin}
                        className="pl-9"
                      />
                    </div>
                  </div>
                )}

                {/* Email */}
                <div className="space-y-1.5">
                  <Label htmlFor="email">University Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@university.ac.ke"
                      required
                      className="pl-9"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      className="pl-9"
                    />
                  </div>
                  {!isLogin && (
                    <p className="text-[11px] text-muted-foreground">Minimum 6 characters</p>
                  )}
                </div>
              </CardContent>

              <CardFooter className="flex flex-col gap-3 pt-0">
                <Button type="submit" className="w-full h-10" disabled={loading}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : isLogin ? (
                    <LogIn className="h-4 w-4 mr-2" />
                  ) : (
                    <UserPlus className="h-4 w-4 mr-2" />
                  )}
                  {loading ? 'Please wait…' : isLogin ? 'Sign In' : 'Create Account'}
                </Button>

                <div className="flex flex-col items-center gap-1.5">
                  <button
                    type="button"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => {
                      setIsLogin(!isLogin);
                      setError('');
                      setSuccess('');
                    }}
                  >
                    {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
                  </button>
                  {isLogin && (
                    <button
                      type="button"
                      className="text-sm text-primary hover:text-primary/80 transition-colors"
                      onClick={() => setShowForgot(true)}
                    >
                      Forgot your password?
                    </button>
                  )}
                </div>

                <div className="relative w-full py-2">
                  <Separator />
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-[11px] text-muted-foreground uppercase tracking-wider">
                    or
                  </span>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-10"
                  disabled={guestLoading}
                  onClick={handleGuestAccess}
                >
                  {guestLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Eye className="h-4 w-4 mr-2" />
                  )}
                  {guestLoading ? 'Starting…' : 'Explore as Gate Crusher (24h)'}
                </Button>
                <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
                  View-only guest access for 24 hours. No messaging, posting, or video calls.
                </p>
              </CardFooter>
            </form>
          </Card>

          <p className="text-[11px] text-muted-foreground text-center">
            By signing in you agree to our{' '}
            <a href="#" className="underline hover:text-foreground transition-colors">
              Terms of Service
            </a>
            .
          </p>
        </div>
      </div>
      </div>
    </>
  );
}
