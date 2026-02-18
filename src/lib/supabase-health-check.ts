/**
 * Supabase Health Check
 * Tests the connection to Supabase using environment variables
 * 
 * This file verifies:
 * - Environment variables are loaded correctly
 * - Supabase client initializes successfully
 * - Connection to Supabase backend is working
 */

import { supabase } from "@/integrations/supabase/client";

export async function testSupabaseConnection(): Promise<{
  status: 'success' | 'error';
  message: string;
  details?: {
    url?: string;
    projectId?: string;
    timestamp?: string;
  };
}> {
  try {
    // Test 1: Verify environment variables are loaded
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    if (!url || !key) {
      return {
        status: 'error',
        message: 'Environment variables not loaded: VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY missing',
      };
    }

    // Test 2: Verify Supabase client exists
    if (!supabase) {
      return {
        status: 'error',
        message: 'Supabase client failed to initialize',
      };
    }

    // Test 3: Attempt a simple query to verify backend connection
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      return {
        status: 'error',
        message: `Supabase connection failed: ${error.message}`,
        details: {
          url: url.substring(0, 30) + '...',
        },
      };
    }

    return {
      status: 'success',
      message: 'Supabase connection verified successfully',
      details: {
        url: url.substring(0, 30) + '...',
        projectId: import.meta.env.VITE_SUPABASE_PROJECT_ID,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      status: 'error',
      message: `Unexpected error during health check: ${errorMessage}`,
    };
  }
}

// Auto-run health check in development
if (import.meta.env.DEV) {
  testSupabaseConnection().then((result) => {
    if (result.status === 'success') {
      console.log('✅ Supabase Connection OK:', result.message, result.details);
    } else {
      console.error('❌ Supabase Connection Failed:', result.message);
    }
  });
}
