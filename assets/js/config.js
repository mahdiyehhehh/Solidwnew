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

export const SUPABASE_URL = "https://lradarnfxzgqmhwxelcm.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_tyBG6ZUYJpkljIPpaKhF2g_6-8YoIa-";

// The ONLY account that will be treated as Administrator.
// Must exactly match the email used to sign up/log in.
export const ADMIN_EMAIL = "mahdiyehheh@gmail.com";

// App-wide constants
export const APP_NAME = "SolidW";
export const DEFAULT_LOCALE = "en";

// Storage bucket names (must match /sql/03_storage.sql exactly)
export const BUCKETS = {
  LOGOS: "logos",
  COVERS: "covers",
  GALLERY: "gallery",
};

// Telegram handle used for the "Upgrade to Pro" deep link (no @ symbol).
export const UPGRADE_TELEGRAM_USERNAME = "pspspspspssp";

// USDT (TRC20) wallet address used for the "Upgrade to Pro" flow.
export const USDT_WALLET_ADDRESS = "TPchBNBrUqXgHC57LqjXiknjYcazowq9AZ";

// Pro plan pricing options shown on the Settings upgrade flow.
export const PRO_PLANS = [
  { id: "1m", months: 1, price: 19, label: "1 Month" },
  { id: "3m", months: 3, price: 49, label: "3 Months", savings: "Save 14%" },
  { id: "12m", months: 12, price: 179, label: "12 Months", savings: "Save 22%" },
];
