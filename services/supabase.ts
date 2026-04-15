import { createClient, SupabaseClient } from '@supabase/supabase-js';

const getSupabaseUrl = () => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL || '';
  }
  return (
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.SUPABASE_URL || ''
  );
};

const getSupabaseAnonKey = () => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY || '';
  }
  return (
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ''
  );
};

let _supabase: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient => {
  if (!_supabase) {
    const url = getSupabaseUrl();
    const key = getSupabaseAnonKey();
    if (!url || !key) {
      throw new Error(
        'Supabase no configurada: VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY deben estar definidas'
      );
    }
    _supabase = createClient(url, key);
  }
  return _supabase;
};

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return getSupabaseClient()[prop as keyof SupabaseClient];
  },
});

export const SUPABASE_TABLES = {
  EVIDENCE: 'evidence',
  INFRACTIONS: 'infractions',
  INCIDENTS: 'incidents',
  AUDIT_JOBS: 'audit_jobs',
  GEOMETRY_LINES: 'geometry_lines',
  FORENSIC_RULES: 'forensic_rules',
  REPORTS: 'reports',
  SYSTEM_LOGS: 'system_logs',
  USERS: 'users',
  LUGARES_INFRACCION: 'lugares_infraccion',
} as const;

export const isSupabaseConfigured = Boolean(getSupabaseUrl() && getSupabaseAnonKey());

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'operator' | 'viewer';
  avatar_url?: string;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
}

export async function signUp(email: string, password: string, name: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
      },
    },
  });
  return { data, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function getCurrentUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

export function onAuthStateChange(callback: (event: string, session: unknown) => void) {
  return supabase.auth.onAuthStateChange(callback);
}
