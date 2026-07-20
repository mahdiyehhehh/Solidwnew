// ==========================================================================
// SolidW — Auth Guard
// ==========================================================================
// Import this at the top of any protected page (dashboard/*, admin/*).
// It checks the session BEFORE the page renders sensitive content and
// redirects appropriately. Call the exported function immediately.
//
// Usage in a page's own <script type="module">:
//
//   import { requireAuth, requireAdmin } from "/assets/js/authGuard.js";
//   const user = await requireAuth();      // for /dashboard/* pages
//   const user = await requireAdmin();     // for /admin/* pages
//
// Both functions redirect and never resolve if access is denied, so any
// code placed after the call only runs for authorized users.
// ==========================================================================

import { supabase, getCurrentUser } from "./supabaseClient.js";
import { ADMIN_EMAIL } from "./config.js";

const LOGIN_PATH = "/auth/login/index.html";
const USER_DASHBOARD_PATH = "/dashboard/index.html";
const ADMIN_DASHBOARD_PATH = "/admin/index.html";

// Redirect helper — replaces history entry so the back button doesn't
// bounce the user into a page they just got kicked out of.
function redirect(path) {
  window.location.replace(path);
}

// Use on any /dashboard/* page.
// - Not logged in → send to login
// - Logged in AND is the admin → send to admin dashboard instead
//   (admin never uses the regular user dashboard)
// - Logged in as a normal user → returns the user object
export async function requireAuth() {
  const user = await getCurrentUser();

  if (!user) {
    redirect(LOGIN_PATH);
    return new Promise(() => {}); // never resolves; redirect is in flight
  }

  if (user.email === ADMIN_EMAIL) {
    redirect(ADMIN_DASHBOARD_PATH);
    return new Promise(() => {});
  }

  return user;
}

// Use on any /admin/* page.
// - Not logged in → send to login
// - Logged in but NOT the admin → send to normal user dashboard
//   (normal users must never see admin content)
// - Logged in AND is the admin → returns the user object
export async function requireAdmin() {
  const user = await getCurrentUser();

  if (!user) {
    redirect(LOGIN_PATH);
    return new Promise(() => {});
  }

  if (user.email !== ADMIN_EMAIL) {
    redirect(USER_DASHBOARD_PATH);
    return new Promise(() => {});
  }

  return user;
}

// Use on /auth/login and /auth/register pages: if a session already
// exists, skip straight to the correct dashboard instead of showing
// the login form again.
export async function redirectIfLoggedIn() {
  const user = await getCurrentUser();
  if (!user) return;

  if (user.email === ADMIN_EMAIL) {
    redirect(ADMIN_DASHBOARD_PATH);
  } else {
    redirect(USER_DASHBOARD_PATH);
  }
}

// Shared sign-out helper — used by both dashboard and admin nav bars.
export async function signOut() {
  await supabase.auth.signOut();
  redirect(LOGIN_PATH);
}