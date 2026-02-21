/**
 * usePushNotifications.ts
 *
 * Handles:
 *  1. Registering the service worker
 *  2. Requesting push permission from the user
 *  3. Subscribing to push and saving the subscription to Supabase
 *  4. Unsubscribing when needed
 *
 * Usage:
 *   const { isSupported, permission, subscribe, unsubscribe } = usePushNotifications();
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// ─── Your VAPID public key ─────────────────────────────────────────────────────
// Generate a key pair at: https://vapidkeys.com  or run:
//   npx web-push generate-vapid-keys
// Paste the PUBLIC key here. Keep the PRIVATE key in your Edge Function env vars.
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

// ─── Helper: convert VAPID key to Uint8Array ──────────────────────────────────
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i++) {
    view[i] = rawData.charCodeAt(i);
  }
  return buffer;
}

// ─── Types ────────────────────────────────────────────────────────────────────
type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

interface UsePushNotifications {
  isSupported: boolean;
  permission: PermissionState;
  isSubscribed: boolean;
  isLoading: boolean;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function usePushNotifications(): UsePushNotifications {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<PermissionState>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  // ── Check support and register service worker ────────────────────────────────
  useEffect(() => {
    const supported =
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;

    setIsSupported(supported);

    if (!supported) {
      setPermission('unsupported');
      return;
    }

    setPermission(Notification.permission as PermissionState);

    // Register the service worker
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        setRegistration(reg);
        // Check if already subscribed
        return reg.pushManager.getSubscription();
      })
      .then((sub) => {
        setIsSubscribed(!!sub);
      })
      .catch((err) => {
        console.error('Service worker registration failed:', err);
      });
  }, []);

  // ── Subscribe ────────────────────────────────────────────────────────────────
  const subscribe = useCallback(async () => {
    if (!isSupported || !user || !registration) return;
    setIsLoading(true);

    try {
      // Request permission
      const result = await Notification.requestPermission();
      setPermission(result as PermissionState);

      if (result !== 'granted') {
        setIsLoading(false);
        return;
      }

      // Get or create push subscription
      let sub = await registration.pushManager.getSubscription();
      if (!sub) {
        sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      // Save subscription to Supabase
      const subJson = sub.toJSON();
      await supabase.from('push_subscriptions' as any).upsert({
        user_id: user.id,
        endpoint: subJson.endpoint,
        p256dh: (subJson.keys as any)?.p256dh,
        auth: (subJson.keys as any)?.auth,
        updated_at: new Date().toISOString(),
      } as any, { onConflict: 'user_id,endpoint' });

      setIsSubscribed(true);
    } catch (err) {
      console.error('Push subscription failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, user, registration]);

  // ── Unsubscribe ──────────────────────────────────────────────────────────────
  const unsubscribe = useCallback(async () => {
    if (!registration || !user) return;
    setIsLoading(true);

    try {
      const sub = await registration.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        // Remove from Supabase
        await supabase
          .from('push_subscriptions' as any)
          .delete()
          .eq('user_id', user.id)
          .eq('endpoint', sub.endpoint);
      }
      setIsSubscribed(false);
    } catch (err) {
      console.error('Unsubscribe failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [registration, user]);

  return { isSupported, permission, isSubscribed, isLoading, subscribe, unsubscribe };
}