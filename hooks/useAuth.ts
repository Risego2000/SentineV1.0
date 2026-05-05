import { useState, useEffect, useCallback } from 'react';
import {
  supabase,
  signIn,
  signOut,
  signUp,
  getSession,
  onAuthStateChange,
  isSupabaseConfigured,
} from '../services/supabase';
import type { User } from '../services/supabase';

export interface AuthState {
  user: User | null;
  session: unknown;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    isLoading: true,
    isAuthenticated: false,
    error: null,
  });

  const updateState = useCallback((updates: Partial<AuthState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const checkSession = useCallback(async () => {
    if (!isSupabaseConfigured) {
      updateState({ isLoading: false, isAuthenticated: false, error: 'Supabase no configurado' });
      return;
    }

    try {
      let session = null;
      let retries = 3;

      // Retry logic for lock conflicts in Electron IndexedDB
      while (retries > 0) {
        try {
          session = await getSession();
          break;
        } catch (err) {
          if (
            err instanceof DOMException &&
            err.name === 'NotAllowedError' &&
            err.message.includes('steal')
          ) {
            retries--;
            if (retries > 0) {
              await new Promise((resolve) => setTimeout(resolve, 100 * (4 - retries)));
              continue;
            }
          }
          throw err;
        }
      }

      if (session) {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();
        const user: User | null = authUser
          ? {
              id: authUser.id,
              email: authUser.email || '',
              name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Usuario',
              role: (authUser.user_metadata?.role as User['role']) || 'operator',
              avatar_url: authUser.user_metadata?.avatar_url,
            }
          : null;

        updateState({
          user,
          session,
          isLoading: false,
          isAuthenticated: true,
          error: null,
        });
      } else {
        updateState({
          user: null,
          session: null,
          isLoading: false,
          isAuthenticated: false,
          error: null,
        });
      }
    } catch (err) {
      updateState({
        user: null,
        session: null,
        isLoading: false,
        isAuthenticated: false,
        error: err instanceof Error ? err.message : 'Error de autenticación',
      });
    }
  }, [updateState]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setState((prev) => ({
        ...prev,
        user: null,
        session: null,
        isLoading: false,
        isAuthenticated: false,
        error: 'Supabase no configurado',
      }));
      return;
    }

    checkSession();

    const {
      data: { subscription },
    } = onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        checkSession();
      } else if (event === 'SIGNED_OUT') {
        setState({
          user: null,
          session: null,
          isLoading: false,
          isAuthenticated: false,
          error: null,
        });
      }
    });

    return () => subscription.unsubscribe();
  }, [checkSession]);

  const login = async (email: string, password: string) => {
    updateState({ isLoading: true, error: null });
    const { error } = await signIn(email, password);
    if (error) {
      updateState({ isLoading: false, error: error.message });
      return { success: false, error: error.message };
    }
    return { success: true, error: null };
  };

  const register = async (email: string, password: string, name: string) => {
    updateState({ isLoading: true, error: null });
    const { error } = await signUp(email, password, name);
    if (error) {
      updateState({ isLoading: false, error: error.message });
      return { success: false, error: error.message };
    }
    return { success: true, error: null };
  };

  const logout = async () => {
    updateState({ isLoading: true, error: null });
    const { error } = await signOut();
    if (error) {
      updateState({ isLoading: false, error: error.message });
      return { success: false, error: error.message };
    }
    updateState({
      user: null,
      session: null,
      isLoading: false,
      isAuthenticated: false,
      error: null,
    });
    return { success: true, error: null };
  };

  const clearError = () => updateState({ error: null });

  return {
    ...state,
    login,
    register,
    logout,
    clearError,
    isConfigured: isSupabaseConfigured,
  };
}
