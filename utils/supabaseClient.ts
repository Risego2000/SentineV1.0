/**
 * Supabase Client
 * Initialize Supabase connection for persistence layer
 */

import { createClient } from '@supabase/supabase-js';

// Environment variables (use .env.local for credentials)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://example.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

/**
 * Initialize Supabase client
 * Use anonymous key for client-side code
 * Use service role key only on backend
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  db: {
    schema: 'public',
  },
});

/**
 * Check if Supabase is configured
 */
export const isSupabaseConfigured = (): boolean => {
  return !!supabaseUrl && !!supabaseAnonKey && supabaseUrl !== 'https://example.supabase.co';
};

/**
 * Get Supabase session
 */
export const getSupabaseSession = async () => {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  } catch (error) {
    console.error('[SUPABASE] Failed to get session:', error);
    return null;
  }
};

/**
 * Check database connection
 */
export const checkSupabaseConnection = async (): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('expedients')
      .select('count()', { count: 'exact', head: true });

    if (error) {
      console.error('[SUPABASE] Connection check failed:', error);
      return false;
    }

    console.log('[SUPABASE] Connection successful');
    return true;
  } catch (error) {
    console.error('[SUPABASE] Connection error:', error);
    return false;
  }
};
