// supabase/functions/send-push/index.ts
// Supabase Edge Function that sends web push notifications
//
// Deploy with:
//   supabase functions deploy send-push
//
// Set these env vars in Supabase Dashboard → Edge Functions → send-push → Secrets:
//   VAPID_PUBLIC_KEY  = your public VAPID key
//   VAPID_PRIVATE_KEY = your private VAPID key
//   VAPID_EMAIL       = mailto:your@email.com

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Configure web-push with VAPID keys
    webpush.setVapidDetails(
      Deno.env.get('VAPID_EMAIL') ?? 'mailto:admin@tellmemore.app',
      Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
      Deno.env.get('VAPID_PRIVATE_KEY') ?? '',
    );

    const { user_id, title, body, url, type, tag } = await req.json();

    if (!user_id) {
      return new Response(JSON.stringify({ error: 'user_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get all push subscriptions for this user
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', user_id);

    if (error) throw error;
    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No subscriptions found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = JSON.stringify({
      title: title || 'TellMeMore',
      body: body || 'You have a new notification',
      url: url || '/',
      type: type || 'general',
      tag: tag || 'tmm-notif',
    });

    // Send to all devices for this user
    const results = await Promise.allSettled(
      subscriptions.map(async (sub: any) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        };
        return webpush.sendNotification(pushSubscription, payload);
      })
    );

    // Remove expired/invalid subscriptions
    const expiredEndpoints: string[] = [];
    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        const err = result.reason;
        // 404 or 410 means subscription is no longer valid
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          expiredEndpoints.push(subscriptions[i].endpoint);
        }
      }
    });

    if (expiredEndpoints.length > 0) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .in('endpoint', expiredEndpoints);
    }

    const sent = results.filter((r) => r.status === 'fulfilled').length;

    return new Response(JSON.stringify({ sent, total: subscriptions.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Push send error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});