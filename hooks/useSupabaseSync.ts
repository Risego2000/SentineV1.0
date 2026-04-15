import { useState, useEffect, useCallback } from 'react';
import { supabase, SUPABASE_TABLES } from '../services/supabase';
import { evidenceDB } from '../services/EvidenceDB';

const isConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
);

export interface SyncStatus {
  isEnabled: boolean;
  isConnected: boolean;
  lastSyncAt: Date | null;
  pendingItems: number;
  error: string | null;
}

export function useSupabaseSync() {
  const [status, setStatus] = useState<SyncStatus>({
    isEnabled: isConfigured,
    isConnected: false,
    lastSyncAt: null,
    pendingItems: 0,
    error: null,
  });

  const checkConnection = useCallback(async () => {
    if (!isConfigured) {
      setStatus((s) => ({ ...s, isConnected: false, error: 'Supabase not configured' }));
      return;
    }

    try {
      const { error } = await supabase.from('infractions').select('id').limit(1);
      if (error) throw error;

      setStatus((s) => ({
        ...s,
        isConnected: true,
        error: null,
      }));
    } catch (err) {
      setStatus((s) => ({
        ...s,
        isConnected: false,
        error: err instanceof Error ? err.message : 'Connection failed',
      }));
    }
  }, []);

  const triggerSync = useCallback(async () => {
    if (!isConfigured) return { synced: 0, failed: 0 };

    try {
      const result = await evidenceDB.syncToSupabase();
      setStatus((s) => ({
        ...s,
        lastSyncAt: new Date(),
        pendingItems: 0,
      }));
      return result;
    } catch (err) {
      setStatus((s) => ({
        ...s,
        error: err instanceof Error ? err.message : 'Sync failed',
      }));
      return { synced: 0, failed: 0 };
    }
  }, []);

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 60000);
    return () => clearInterval(interval);
  }, [checkConnection]);

  return {
    ...status,
    checkConnection,
    triggerSync,
  };
}

export async function fetchInfractionsFromCloud(options?: {
  status?: string;
  plate?: string;
  limit?: number;
}) {
  if (!isConfigured) return [];

  let query = supabase
    .from(SUPABASE_TABLES.INCIDENTS)
    .select('*')
    .order('created_at', { ascending: false });

  if (options?.status) {
    query = query.eq('validation_status', options.status);
  }
  if (options?.plate) {
    query = query.ilike('plate', `%${options.plate}%`);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[Supabase] Failed to fetch infractions:', error);
    return [];
  }

  return data || [];
}

export async function updateInfractionValidation(
  id: string,
  validationStatus: 'validated' | 'rejected',
  operatorId?: string
) {
  if (!isConfigured) return false;

  const { error } = await supabase
    .from(SUPABASE_TABLES.INCIDENTS)
    .update({
      validation_status: validationStatus,
      validated_at: new Date().toISOString(),
      operator_id: operatorId,
    })
    .eq('id', id);

  if (error) {
    console.error('[Supabase] Failed to update validation:', error);
    return false;
  }

  return true;
}
