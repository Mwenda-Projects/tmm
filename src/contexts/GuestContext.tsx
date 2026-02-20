/**
 * GuestContext — detects Gate Crusher (anonymous) sessions.
 *
 * Source of truth: Supabase's `user.is_anonymous` flag, set automatically
 * when `supabase.auth.signInAnonymously()` is called. No admin approval needed.
 *
 * Gate crushers get 24h view-only access enforced client-side via `isGuest`.
 * The 24h window is calculated from the user's `created_at` timestamp.
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GuestStatus {
  isGuest: boolean;
  expiresAt: Date | null;
  isExpired: boolean;
  timeRemaining: string;   // Human-readable countdown e.g. "23h 14m"
}

// ─── Context ──────────────────────────────────────────────────────────────────

const GuestContext = createContext<GuestStatus>({
  isGuest: false,
  expiresAt: null,
  isExpired: false,
  timeRemaining: '',
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GUEST_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

function computeExpiresAt(user: User): Date {
  const createdAt = new Date(user.created_at).getTime();
  return new Date(createdAt + GUEST_DURATION_MS);
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'Expired';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  const s = Math.floor((ms % 60_000) / 1_000);
  return `${m}m ${s}s`;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function GuestProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<GuestStatus>({
    isGuest: false,
    expiresAt: null,
    isExpired: false,
    timeRemaining: '',
  });

  useEffect(() => {
    // Initialize from current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleUser(session?.user ?? null);
    });

    // React to auth state changes (sign in / sign out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  function handleUser(user: User | null) {
    // `user.is_anonymous` is set to true automatically by Supabase when
    // signInAnonymously() is called. No manual check or DB lookup needed.
    if (!user || !user.is_anonymous) {
      setStatus({ isGuest: false, expiresAt: null, isExpired: false, timeRemaining: '' });
      return;
    }

    const expiresAt = computeExpiresAt(user);
    const now = Date.now();
    const remaining = expiresAt.getTime() - now;

    setStatus({
      isGuest: true,
      expiresAt,
      isExpired: remaining <= 0,
      timeRemaining: formatRemaining(remaining),
    });
  }

  // Live countdown ticker (updates every 30s to save resources)
  useEffect(() => {
    if (!status.isGuest || !status.expiresAt) return;
    const id = setInterval(() => {
      const remaining = status.expiresAt!.getTime() - Date.now();
      setStatus(prev => ({
        ...prev,
        isExpired: remaining <= 0,
        timeRemaining: formatRemaining(remaining),
      }));
      // Auto sign out when session expires
      if (remaining <= 0) {
        supabase.auth.signOut();
      }
    }, 30_000);
    return () => clearInterval(id);
  }, [status.isGuest, status.expiresAt]);

  return (
    <GuestContext.Provider value={status}>
      {children}
    </GuestContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGuestStatus(): GuestStatus {
  return useContext(GuestContext);
}