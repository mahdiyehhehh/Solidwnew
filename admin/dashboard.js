// ==========================================================================
// SolidW — Admin Dashboard Overview Logic
// ==========================================================================
// Platform-wide counts plus a quick-action list of pending USDT upgrade
// requests, approved/rejected via the approve_subscription/reject_subscription
// security-definer RPCs (sql/04_functions.sql).
// ==========================================================================

import { requireAdmin, signOut } from "/assets/js/authGuard.js";
import { supabase } from "/assets/js/supabaseClient.js";
import { showToast } from "/assets/js/toast.js";

const signOutBtn = document.getElementById("signOutBtn");
const totalUsers = document.getElementById("totalUsers");
const totalBusinesses = document.getElementById("totalBusinesses");
const totalReservations = document.getElementById("totalReservations");
const pendingCount = document.getElementById("pendingCount");
const pendingList = document.getElementById("pendingList");
const pendingEmpty = document.getElementById("pendingEmpty");

signOutBtn.addEventListener("click", async () => {
  await signOut();
});

async function init() {
  await requireAdmin(); // redirects if not logged in / not admin

  const [{ count: userCount }, { count: bizCount }, { count: resCount }] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("businesses").select("id", { count: "exact", head: true }),
    supabase.from("reservations").select("id", { count: "exact", head: true }),
  ]);

  totalUsers.textContent = userCount ?? 0;
  totalBusinesses.textContent = bizCount ?? 0;
  totalReservations.textContent = resCount ?? 0;

  await loadPending();
}

async function loadPending() {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("id, user_id, plan_id, proof_note, created_at, profiles(email)")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    showToast("Could not load pending requests.", "error");
    return;
  }

  const pending = data || [];
  pendingCount.textContent = pending.length;

  pendingList.innerHTML = "";

  if (pending.length === 0) {
    pendingEmpty.style.display = "block";
    return;
  }
  pendingEmpty.style.display = "none";

  for (const req of pending) {
    const row = document.createElement("div");
    row.className = "subscription-request-card";
    row.style.padding = "var(--space-4) 0";
    row.style.borderBottom = "1px solid var(--color-border)";
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(req.profiles?.email || req.user_id)}</strong>
        <div class="text-muted" style="font-size: var(--fs-sm);">
          Requesting <strong>${escapeHtml(req.plan_id)}</strong> · ${escapeHtml(req.proof_note || "no reference provided")}
        </div>
      </div>
      <div style="display:flex; gap: var(--space-2);">
        <button type="button" class="btn btn-primary btn-sm" data-action="approve" data-id="${req.id}">Approve</button>
        <button type="button" class="btn btn-outline btn-sm" data-action="reject" data-id="${req.id}">Reject</button>
      </div>
    `;
    pendingList.appendChild(row);
  }

  pendingList.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => handleReview(btn.dataset.action, btn.dataset.id));
  });
}

async function handleReview(action, subscriptionId) {
  const rpcName = action === "approve" ? "approve_subscription" : "reject_subscription";
  const args = action === "approve" ? { p_subscription_id: subscriptionId } : { p_subscription_id: subscriptionId };

  const { error } = await supabase.rpc(rpcName, args);

  if (error) {
    showToast(error.message || "Could not process request.", "error");
    return;
  }

  showToast(action === "approve" ? "Subscription approved." : "Subscription rejected.", "success");
  await loadPending();
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

init();
