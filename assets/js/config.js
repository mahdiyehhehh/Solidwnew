// ==========================================================================
// SolidW — Global Configuration
// ==========================================================================
// This file holds project-wide constants. It has no dependencies and is
// loaded before every other script (via <script type="module"> import).
//
// SECURITY NOTE:
// The Supabase anon key is SAFE to expose publicly — it is designed to be
// used in client-side code. Real security comes from Row Level Security
// (RLS) policies defined in /sql/02_policies.sql, not from hiding this key.
// Never put a Supabase "service_role" key anywhere in this project.
// ==========================================================================

// TODO: Replace with your actual Supabase project values.
// Find these in: Supabase Dashboard → Project Settings → API
export const SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co";
export const SUPABASE_ANON_KEY = "YOUR-ANON-PUBLIC-KEY";

// The ONLY account that will be treated as Administrator.
// Must exactly match the email used to sign up/log in.
export const ADMIN_EMAIL = "you@example.com";

// App-wide constants
export const APP_NAME = "SolidW";
export const DEFAULT_LOCALE = "en";

// Storage bucket names (must match /sql/03_storage.sql exactly)
export const BUCKETS = {
  LOGOS: "logos",
  COVERS: "covers",
  GALLERY: "gallery",
};

// Telegram handle used for the "Upgrade to Pro" deep link.
// Replace with your real support/sales Telegram username (no @ symbol).
export const UPGRADE_TELEGRAM_USERNAME = "your_telegram_username";