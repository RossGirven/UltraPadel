import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = globalThis.ULTRAPADEL_SUPABASE_URL || "YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = globalThis.ULTRAPADEL_SUPABASE_ANON_KEY || "YOUR_SUPABASE_ANON_KEY";

export function isSupabaseConfigured() {
  return Boolean(
    SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    SUPABASE_URL !== "YOUR_SUPABASE_URL" &&
    SUPABASE_ANON_KEY !== "YOUR_SUPABASE_ANON_KEY"
  );
}

export const supabase = isSupabaseConfigured()
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;

export { SUPABASE_URL, SUPABASE_ANON_KEY };
