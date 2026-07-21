// ==========================================================================
// SolidW — Dashboard Overview Logic
// ==========================================================================
// Loads the signed-in owner's profile + plan, checks whether they already
// have a business — showing an onboarding card (not a redirect) if not —
// counts their businesses and upcoming reservations, and renders the
// upgrade CTA + business summary card when relevant.
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

const onboardingCard = document.getElementById("onboardingCard");
const businessInfoCard = document.getElementById("businessInfoCard");
const bizLogo = document.getElementById("bizLogo");
const bizName = document.getElementById("bizName");
const bizCategory = document.getElementById("bizCategory");
const bizDescription = document.getElementById("bizDescription");
const bizContact = document.getElementById("bizContact");

signOutBtn.addEventListener("click", async () => {
  await signOut();
});

function renderBusinessCard(biz) {
  onboardingCard.style.display = "none";
  businessInfoCard.style.display = "block";

  bizName.textContent = biz.name;
  bizCategory.textContent = biz.category || "Uncategorized";
  bizDescription.textContent = biz.description || "No description yet.";

  const contactParts = [];
  if (biz.phone) contactParts.push(`Phone: ${biz.phone}`);
  if (biz.whatsapp) contactParts.push(`WhatsApp: ${biz.whatsapp}`);
  if (biz.telegram) contactParts.push(`Telegram: ${biz.telegram}`);
  if (biz.address) contactParts.push(`Address: ${biz.address}`);
  bizContact.textContent = contactParts.join(" · ");

  if (biz.logo_url) {
    bizLogo.src = biz.logo_url;
    bizLogo.style.display = "block";
  } else {
    bizLogo.style.display = "none";
  }
}

function renderOnboardingCard() {
  businessInfoCard.style.display = "none";
  onboardingCard.style.display = "block";
}

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

  // ---- Businesses (fetched once, used for onboarding check, count, and the summary card) ----
  const { data: myBusinesses, error: bizError } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", user.id);

  if (bizError) {
    showToast("Could not load your business. Please try again.", "error");
    return;
  }

  businessLimitLabel.textContent =
    plan && plan.max_businesses
      ? `Businesses (limit ${plan.max_businesses})`
      : "Businesses";

  // No business yet → stay on the dashboard and show the onboarding card
  // instead of redirecting away.
  if (!myBusinesses || myBusinesses.length === 0) {
    businessCount.textContent = 0;
    upcomingCount.textContent = 0;
    renderOnboardingCard();
    return;
  }

  businessCount.textContent = myBusinesses.length;
  renderBusinessCard(myBusinesses[0]);

  // ---- Upcoming reservations count ----
  const businessIds = myBusinesses.map((b) => b.id);
  const today = new Date().toISOString().slice(0, 10);
  const { count: resCount } = await supabase
    .from("reservations")
    .select("id", { count: "exact", head: true })
    .in("business_id", businessIds)
    .gte("date", today)
    .in("status", ["pending", "confirmed"]);

  upcomingCount.textContent = resCount ?? 0;
}

init();
