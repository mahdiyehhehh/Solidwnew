// ==========================================================================
// SolidW — Routing Helper
// ==========================================================================
// The public booking page (/site/index.html) needs to know which business
// to render. The pretty URL /business/:slug is rewritten by vercel.json to
// /site/index.html?slug=:slug, but this helper also understands the clean
// path directly. That means:
//
//   - Production (Vercel rewrites active): /business/joes-cafe  → works
//   - Local file testing / no rewrites:    /site/?slug=joes-cafe → works
//
// Every page reads the slug through getSlug() instead of touching
// location.search directly, so if the routing strategy ever changes
// (e.g. a future serverless function, a different rewrite pattern),
// only this one file needs to be updated.
// ==========================================================================

export function getSlug() {
  // 1. Check query string first (?slug=...) — this is what the
  //    vercel.json rewrite actually produces under the hood.
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("slug");
  if (fromQuery) return sanitizeSlug(fromQuery);

  // 2. Fallback: check for /business/:slug directly in the path,
  //    in case this page is ever reached without the rewrite applying
  //    (e.g. opened as a raw file path during local testing).
  const match = window.location.pathname.match(/\/business\/([^/]+)/);
  if (match && match[1]) return sanitizeSlug(match[1]);

  return null;
}

// Builds the canonical public URL for a business, used by the dashboard
// (e.g. "copy link" buttons, QR code generation).
export function buildBusinessUrl(slug) {
  return `${window.location.origin}/business/${encodeURIComponent(slug)}`;
}

// Basic slug sanitation: lowercase, strip anything that isn't
// alphanumeric/hyphen, to guard against malformed or malicious input
// before it's ever used in a Supabase query.
function sanitizeSlug(raw) {
  return decodeURIComponent(raw)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, "");
}

// Converts a business name into a URL-safe slug. Used at business-creation
// time in the dashboard.
export function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}