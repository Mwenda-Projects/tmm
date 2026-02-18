import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface GuestContextType {
  isGuest: boolean;
  expiresAt: Date | null;
  loading: boolean;
}

const GuestContext = createContext<GuestContextType>({
  isGuest: false,
  expiresAt: null,
  loading: true,
});

export function GuestProvider({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const [isGuest, setIsGuest] = useState(false);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsGuest(false);
      setExpiresAt(null);
      setLoading(false);
      return;
    }

    supabase
      .from('guest_sessions' as any)
      .select('expires_at')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data) {
          const exp = new Date(data.expires_at);
          if (exp > new Date()) {
            setIsGuest(true);
            setExpiresAt(exp);
          } else {
            // Expired — cleanup and sign out
            supabase.rpc('cleanup_expired_guests' as any).then(() => signOut());
          }
        }
        setLoading(false);
      });
  }, [user, signOut]);

  // Auto-expire check every minute
  useEffect(() => {
    if (!isGuest || !expiresAt) return;
    const interval = setInterval(() => {
      if (new Date() >= expiresAt) {
        supabase.rpc('cleanup_expired_guests' as any).then(() => signOut());
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, [isGuest, expiresAt, signOut]);

  return (
    <GuestContext.Provider value={{ isGuest, expiresAt, loading }}>
      {children}
    </GuestContext.Provider>
  );
}

export const useGuestStatus = () => useContext(GuestContext);
