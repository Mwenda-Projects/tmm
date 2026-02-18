import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { GraduationCap, Lock, Loader2, CheckCircle2, ShieldAlert } from 'lucide-react';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isRecovery, setIsRecovery] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check for recovery token in URL hash
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      setIsRecovery(true);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      setSuccess('Password updated successfully! Redirecting…');
      setTimeout(() => navigate('/'), 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  if (!isRecovery) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md border-border shadow-sm">
          <CardHeader className="text-center space-y-2">
            <div className="flex justify-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <GraduationCap className="h-5 w-5" />
              </div>
            </div>
            <CardTitle className="text-xl font-semibold">Invalid Link</CardTitle>
            <CardDescription className="text-sm">
              This password reset link is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center pt-0">
            <Button variant="outline" onClick={() => navigate('/auth')}>
              Back to Sign In
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
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
            <CardTitle className="text-xl font-semibold">Set New Password</CardTitle>
            <CardDescription className="text-sm">
              Choose a new password for your account.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
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
                <Label htmlFor="password">New Password</Label>
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
                <p className="text-[11px] text-muted-foreground">Minimum 6 characters</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-3 pt-0">
              <Button type="submit" className="w-full h-10" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {loading ? 'Updating…' : 'Update Password'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
