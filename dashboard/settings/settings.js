// ==========================================================================
// SolidW — Dashboard Settings Logic
// ==========================================================================

import { requireAuth, signOut } from "/assets/js/authGuard.js";
import { supabase } from "/assets/js/supabaseClient.js";
import { showToast } from "/assets/js/toast.js";
import { UPGRADE_TELEGRAM_USERNAME, USDT_WALLET_ADDRESS, PRO_PLANS } from "/assets/js/config.js";

const signOutBtn = document.getElementById("signOutBtn");
const accountEmail = document.getElementById("accountEmail");
const planBadge = document.getElementById("planBadge");
const planDetails = document.getElementById("planDetails");
const upgradeSection = document.getElementById("upgradeSection");
const subscriptionHistory = document.getElementById("subscriptionHistory");

const planPicker = document.getElementById("planPicker");
const paymentStep = document.getElementById("paymentStep");
const payAmount = document.getElementById("payAmount");
const walletAddress = document.getElementById("walletAddress");
const copyWalletBtn = document.getElementById("copyWalletBtn");
const confirmTelegramBtn = document.getElementById("confirmTelegramBtn");

const passwordForm = document.getElementById("passwordForm");
const passwordError = document.getElementById("passwordError");
const passwordSuccess = document.getElementById("passwordSuccess");
const newPasswordInput = document.getElementById("newPassword");
const confirmNewPasswordInput = document.getElementById("confirmNewPassword");
const updatePasswordBtn = document.getElementById("updatePasswordBtn");
const updatePasswordLabel = document.getElementById("updatePasswordLabel");

let currentUser = null;
let selectedPlan = null;

signOutBtn.addEventListener("click", async () => {
  await signOut();
});

async function init() {
  currentUser = await requireAuth();
  accountEmail.value = currentUser.email || "";

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_id")
    .eq("id", currentUser.id)
    .single();

  const { data: plan } = await supabase
    .from("plans")
    .select("id, name, max_businesses, max_gallery_images, max_bookings_per_day")
    .eq("id", profile?.plan_id || "free")
    .single();

  if (plan) {
    planBadge.textContent = plan.name;
    planBadge.className = plan.id === "pro" ? "badge badge-pro" : "badge badge-free";

    if (plan.id === "pro") {
      planDetails.textContent = "You're on the Pro plan — unlimited businesses, gallery photos, and bookings.";
      upgradeSection.style.display = "none";
    } else {
      planDetails.textContent = `Free plan: ${plan.max_businesses} business, ${plan.max_gallery_images} gallery photos, ${plan.max_bookings_per_day} bookings/day.`;
      renderPlanPicker();
    }
  }

  await loadSubscriptionHistory();
}

function renderPlanPicker() {
  planPicker.innerHTML = `
    <div class="pricing-selector">
      ${PRO_PLANS.map((p, i) => `
        <button type="button" class="pricing-option ${i === PRO_PLANS.length - 1 ? "pricing-option--default" : ""}" data-id="${p.id}">
          <span class="pricing-option-radio"></span>
          <span class="pricing-option-info">
            <span class="pricing-option-label">${p.label}${p.savings ? ` <span class="badge badge-pro">${p.savings.replace("Save ", "")} off</span>` : ""}</span>
            <span class="pricing-option-price">$${p.price}</span>
          </span>
        </button>
      `).join("")}
    </div>
    <div class="pricing-summary glass-dark" id="pricingSummary"></div>
  `;

  planPicker.querySelectorAll(".pricing-option").forEach(btn => {
    btn.addEventListener("click", () => selectPlan(btn.dataset.id));
  });

  selectPlan(PRO_PLANS[PRO_PLANS.length - 1].id);
}

function selectPlan(planId) {
  selectedPlan = PRO_PLANS.find(p => p.id === planId);

  planPicker.querySelectorAll(".pricing-option").forEach(btn => {
    btn.classList.toggle("pricing-option--selected", btn.dataset.id === planId);
  });

  const summary = document.getElementById("pricingSummary");
  summary.innerHTML = `
    <h4>${selectedPlan.label} Plan</h4>
    <ul class="pricing-features">
      <li>Unlimited businesses</li>
      <li>Unlimited bookings</li>
      <li>Unlimited gallery photos</li>
      <li>Unlimited services</li>
      <li>Priority support</li>
    </ul>
    <div class="pricing-summary-price">$${selectedPlan.price}<span>/${selectedPlan.label.toLowerCase()}</span></div>
    <button type="button" class="btn btn-accent btn-block" id="proceedUpgradeBtn">Upgrade to Pro</button>
  `;

  document.getElementById("proceedUpgradeBtn").addEventListener("click", () => {
    payAmount.textContent = `$${selectedPlan.price}`;
    walletAddress.textContent = USDT_WALLET_ADDRESS;
    const message = `Hi! I'd like to upgrade to Pro (${selectedPlan.label} — $${selectedPlan.price}). My account email is ${currentUser.email}.`;
    confirmTelegramBtn.href = `https://t.me/${UPGRADE_TELEGRAM_USERNAME}?text=${encodeURIComponent(message)}`;
    paymentStep.style.display = "block";
    paymentStep.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

copyWalletBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(USDT_WALLET_ADDRESS);
  showToast("Wallet address copied.", "success");
});

async function loadSubscriptionHistory() {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("id, plan_id, method, status, created_at")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false });

  if (error || !data || data.length === 0) {
    subscriptionHistory.innerHTML = "";
    return;
  }

  const badgeClass = { pending: "badge-warning", approved: "badge-success", rejected: "badge-danger" };

  subscriptionHistory.innerHTML = `
    <h4 style="margin-bottom: var(--space-3);">Upgrade Requests</h4>
    ${data
      .map(
        (s) => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding: var(--space-3) 0; border-bottom: 1px solid var(--color-border);">
        <span class="text-muted">${new Date(s.created_at).toLocaleDateString()} · ${s.plan_id}</span>
        <span class="badge ${badgeClass[s.status] || "badge-free"}">${s.status}</span>
      </div>
    `
      )
      .join("")}
  `;
}

passwordForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  passwordError.style.display = "none";
  passwordSuccess.style.display = "none";

  const newPassword = newPasswordInput.value;
  const confirmNewPassword = confirmNewPasswordInput.value;

  if (newPassword.length < 8) {
    passwordError.textContent = "Password must be at least 8 characters.";
    passwordError.style.display = "block";
    return;
  }

  if (newPassword !== confirmNewPassword) {
    passwordError.textContent = "Passwords do not match.";
    passwordError.style.display = "block";
    return;
  }

  updatePasswordBtn.disabled = true;
  updatePasswordLabel.innerHTML = '<span class="spinner"></span> Updating…';

  const { error } = await supabase.auth.updateUser({ password: newPassword });

  updatePasswordBtn.disabled = false;
  updatePasswordLabel.textContent = "Update Password";

  if (error) {
    passwordError.textContent = error.message || "Could not update password.";
    passwordError.style.display = "block";
    return;
  }

  passwordSuccess.textContent = "Password updated successfully.";
  passwordSuccess.style.display = "block";
  passwordForm.reset();
});

init();
