// ==========================================================================
// SolidW — Supabase Client
// ==========================================================================
// Single shared Supabase client instance, imported by every page that needs
// auth, database, or storage access. Using one shared instance (rather than
// creating a new client per page) ensures session persistence works
// correctly across the whole app.
//
// Loaded via Supabase's official CDN build — no npm/build step required.
// ==========================================================================

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Convenience helper: returns the current logged-in user (or null).
// Used by authGuard.js and pages that need to know "who am I" quickly.
export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    console.error("getCurrentUser error:", error.message);
    return null;
  }
  return data?.user ?? null;
}

// Convenience helper: returns the current session (or null).
export async function getCurrentSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error("getCurrentSession error:", error.message);
    return null;
  }
  return data?.session ?? null;
}