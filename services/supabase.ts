import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

type LockRunner = <T>(name: string, acquireTimeout: number, fn: () => Promise<T>) => Promise<T>;
const lockQueue = new Map<string, Promise<void>>();

const inMemoryLock: LockRunner = async <T>(
  name: string,
  _acquireTimeout: number,
  fn: () => Promise<T>
): Promise<T> => {
  const previous = lockQueue.get(name) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  lockQueue.set(
    name,
    previous.then(() => current)
  );
  await previous;
  try {
    return await fn();
  } finally {
    release();
    if (lockQueue.get(name) === current) {
      lockQueue.delete(name);
    }
  }
};

declare global {
  var __sentinelSupabaseClient: SupabaseClient | undefined;
}

const createSupabaseClient = () =>
  createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      // Reduce lock contention in Electron/HMR by keeping one auth client per renderer.
      flowType: 'pkce',
      // Electron renderer is effectively single-tab; avoid navigator.locks orphan warnings.
      lock: inMemoryLock as any,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });

export const supabase = globalThis.__sentinelSupabaseClient ?? createSupabaseClient();
globalThis.__sentinelSupabaseClient = supabase;

export const SUPABASE_TABLES = {
  EVIDENCE: 'evidence',
  INFRACTIONS: 'infractions',
  INFRACTION_CATALOG: 'infraction_catalog',
  EXPEDIENT_IMAGES: 'expedient_images',
  EXPEDIENTS: 'expedients',
  INCIDENTS: 'incidents',
  AUDIT_JOBS: 'audit_jobs',
  GEOMETRY_LINES: 'geometry_lines',
  FORENSIC_RULES: 'forensic_rules',
  REPORTS: 'reports',
  SYSTEM_LOGS: 'system_logs',
  USERS: 'users',
} as const;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

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
