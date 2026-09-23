import { ref, computed } from 'vue';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

const user = ref<User | null>(null);
const session = ref<Session | null>(null);
const loading = ref<boolean>(true);
const error = ref<string | null>(null);
let initialized = false;

export function useAuth() {
  const isAuthenticated = computed(() => !!session.value && !!user.value);
  const userDisplayName = computed(() => {
    return (
      user.value?.user_metadata?.display_name ||
      user.value?.email?.split('@')[0] ||
      'Candidate'
    );
  });

  async function initAuth() {
    if (initialized) return;
    initialized = true;
    loading.value = true;
    error.value = null;

    try {
      const { data } = await supabase.auth.getSession();
      session.value = data.session;
      user.value = data.session?.user ?? null;

      supabase.auth.onAuthStateChange((_event, currentSession) => {
        session.value = currentSession;
        user.value = currentSession?.user ?? null;
      });
    } catch (e: any) {
      error.value = e?.message || 'Failed to initialize session';
    } finally {
      loading.value = false;
    }
  }

  async function signInWithPassword(email: string, pass: string) {
    loading.value = true;
    error.value = null;
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password: pass,
      });
      if (authError) throw authError;
      session.value = data.session;
      user.value = data.user;
      return data;
    } catch (e: any) {
      error.value = e?.message || 'Sign in failed';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function signOut() {
    loading.value = true;
    try {
      await supabase.auth.signOut();
      session.value = null;
      user.value = null;
    } catch (e: any) {
      error.value = e?.message || 'Sign out failed';
    } finally {
      loading.value = false;
    }
  }

  return {
    user,
    session,
    loading,
    error,
    isAuthenticated,
    userDisplayName,
    initAuth,
    signInWithPassword,
    signOut,
  };
}
