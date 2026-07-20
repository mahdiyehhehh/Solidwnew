// ==========================================================================
// SolidW — Dashboard Overview Logic
// ==========================================================================
// Loads the signed-in owner's profile + plan, counts their businesses and
// upcoming reservations, and renders the upgrade CTA when relevant.
// ==========================================================================

import { requireAuth, signOut } from "/assets/js/authGuard.js";
import { supabase } from "/assets/js/supabaseClient.js";
import { showToast } from "/assets/js/toast.js";

const welcomeHeading = document.getElementById("welcomeHeading");
const welcomeSubtitle = document.getElementById("welcomeSubtitle");
const planNameBadge = document.getElementById("planNameBadge");
const planStatusText = document.getElementById("planStatusText");
const suspendedBanner = document.getElementById("suspendedBanner");
const businessCount = document.getElementById("businessCount");
const businessLimitLabel = document.getElementById("businessLimitLabel");
const upcomingCount = document.getElementById("upcomingCount");
const galleryLimitValue = document.getElementById("galleryLimitValue");
const upgradeBanner = document.getElementById("upgradeBanner");
const upgradeText = document.getElementById("upgradeText");
const signOutBtn = document.getElementById("signOutBtn");

signOutBtn.addEventListener("click", async () => {
  await signOut();
});

async function init() {
  const user = await requireAuth(); // redirects if not logged in / is admin

  welcomeHeading.textContent = `Welcome back${user.email ? ", " + user.email.split("@")[0] : ""}`;

  // ---- Profile + plan ----
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("plan_id, status")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    showToast("Could not load your account. Please try again.", "error");
    return;
  }

  if (profile.status === "suspended") {
    suspendedBanner.style.display = "block";
  }

  const { data: plan, error: planError } = await supabase
    .from("plans")
    .select("id, name, max_businesses, max_gallery_images, max_bookings_per_day")
    .eq("id", profile.plan_id)
    .single();

  if (!planError && plan) {
    planNameBadge.textContent = plan.name;
    planNameBadge.className = plan.id === "pro" ? "badge badge-pro" : "badge badge-free";
    planStatusText.textContent = plan.id === "pro" ? "You're on the Pro plan" : "You're on the Free plan";

    galleryLimitValue.textContent = plan.max_gallery_images ? plan.max_gallery_images : "Unlimited";

    if (plan.id === "pro") {
      upgradeBanner.style.display = "none";
    } else {
      upgradeText.textContent = `Free includes ${plan.max_businesses} business, ${plan.max_gallery_images} gallery photos, and ${plan.max_bookings_per_day} bookings/day. Upgrade for unlimited access.`;
    }
  }

  // ---- Business count ----
  const { count: bizCount, error: bizError } = await supabase
    .from("businesses")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id);

  if (!bizError) {
    businessCount.textContent = bizCount ?? 0;
    businessLimitLabel.textContent =
      plan && plan.max_businesses
        ? `Businesses (limit ${plan.max_businesses})`
        : "Businesses";
  }

  // ---- Upcoming reservations count ----
  // Reservations are scoped by business_id, so first get this owner's business ids.
  const { data: myBusinesses } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id);

  const businessIds = (myBusinesses || []).map((b) => b.id);

  if (businessIds.length > 0) {
    const today = new Date().toISOString().slice(0, 10);
    const { count: resCount } = await supabase
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .in("business_id", businessIds)
      .gte("date", today)
      .in("status", ["pending", "confirmed"]);

    upcomingCount.textContent = resCount ?? 0;
  } else {
    upcomingCount.textContent = 0;
  }
}

init();
