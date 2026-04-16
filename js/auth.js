import { supabase, isSupabaseConfigured } from "./supabaseClient.js";

let currentSession = null;

export async function initAuth() {
  if (!isSupabaseConfigured() || !supabase) {
    currentSession = null;
    return null;
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw error;
  }

  currentSession = data.session || null;
  supabase.auth.onAuthStateChange((_event, session) => {
    currentSession = session || null;
  });

  return currentSession;
}

export async function signUp(email, password) {
  if (!isSupabaseConfigured() || !supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    throw error;
  }

  currentSession = data.session || currentSession;
  return data;
}

export async function signIn(email, password) {
  if (!isSupabaseConfigured() || !supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw error;
  }

  currentSession = data.session || null;
  return data;
}

export async function signOut() {
  if (!isSupabaseConfigured() || !supabase) {
    currentSession = null;
    return;
  }

  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }

  currentSession = null;
}

export async function getCurrentUser() {
  if (!isSupabaseConfigured() || !supabase) {
    return null;
  }

  if (currentSession?.user) {
    return currentSession.user;
  }

  const { data, error } = await supabase.auth.getUser();
  if (error) {
    throw error;
  }

  return data.user || null;
}
