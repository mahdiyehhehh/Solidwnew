// ==========================================================================
// SolidW — Dashboard Settings Logic
// ==========================================================================
// Account email display, Pro upgrade request submission (subscriptions
// table, method='usdt_manual', reviewed by an admin via approve/reject
// RPCs), subscription history, and password change.
// ==========================================================================

import { requireAuth, signOut } from "/assets/js/authGuard.js";
import { supabase } from "/assets/js/supabaseClient.js";
import { showToast } from "/assets/js/toast.js";
import { UPGRADE_TELEGRAM_USERNAME } from "/assets/js/config.js";

const signOutBtn = document.getElementById("signOutBtn");
const accountEmail = document.getElementById("accountEmail");
const planBadge = document.getElementById("planBadge");
const planDetails = document.getElementById("planDetails");
const upgradeSection = document.getElementById("upgradeSection");
const upgradeInstructions = document.getElementById("upgradeInstructions");
const upgradeForm = document.getElementById("upgradeForm");
const proofNoteInput = document.getElementById("proofNote");
const submitUpgradeBtn = document.getElementById("submitUpgradeBtn");
const submitUpgradeLabel = document.getElementById("submitUpgradeLabel");
const subscriptionHistory = document.getElementById("subscriptionHistory");

const passwordForm = document.getElementById("passwordForm");
const passwordError = document.getElementById("passwordError");
const passwordSuccess = document.getElementById("passwordSuccess");
const newPasswordInput = document.getElementById("newPassword");
const confirmNewPasswordInput = document.getElementById("confirmNewPassword");
const updatePasswordBtn = document.getElementById("updatePasswordBtn");
const updatePasswordLabel = document.getElementById("updatePasswordLabel");

let currentUser = null;

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
    .select("id, name, price_usdt, max_businesses, max_gallery_images, max_bookings_per_day")
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
      upgradeInstructions.textContent = `Send your USDT payment to upgrade, then submit your transaction reference below. Questions? Message @${UPGRADE_TELEGRAM_USERNAME} on Telegram. An admin will review and approve your request.`;
    }
  }

  await loadSubscriptionHistory();
}

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

upgradeForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const proofNote = proofNoteInput.value.trim();
  if (!proofNote) {
    showToast("Please enter your transaction reference.", "warning");
    return;
  }

  submitUpgradeBtn.disabled = true;
  submitUpgradeLabel.innerHTML = '<span class="spinner"></span> Submitting…';

  const { error } = await supabase.from("subscriptions").insert({
    user_id: currentUser.id,
    plan_id: "pro",
    method: "usdt_manual",
    status: "pending",
    proof_note: proofNote,
  });

  submitUpgradeBtn.disabled = false;
  submitUpgradeLabel.textContent = "Submit Upgrade Request";

  if (error) {
    showToast(error.message || "Could not submit upgrade request.", "error");
    return;
  }

  showToast("Upgrade request submitted. An admin will review it shortly.", "success");
  upgradeForm.reset();
  await loadSubscriptionHistory();
});

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
