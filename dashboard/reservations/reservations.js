// ==========================================================================
// SolidW — Dashboard Reservations Logic
// ==========================================================================
// Lists reservations for the selected business, filterable by status, with
// quick actions to confirm/complete/cancel or delete a request.
// ==========================================================================

import { requireAuth, signOut } from "/assets/js/authGuard.js";
import { supabase } from "/assets/js/supabaseClient.js";
import { showToast } from "/assets/js/toast.js";

const signOutBtn = document.getElementById("signOutBtn");
const businessSelect = document.getElementById("businessSelect");
const noBusinessState = document.getElementById("noBusinessState");
const reservationsList = document.getElementById("reservationsList");
const emptyReservations = document.getElementById("emptyReservations");
const statusTabs = document.getElementById("statusTabs");

let currentUser = null;
let myBusinesses = [];
let selectedBusinessId = null;
let reservations = [];
let activeStatus = "all";

const STATUS_BADGE = {
  pending: "badge-warning",
  confirmed: "badge-success",
  cancelled: "badge-danger",
  completed: "badge-free",
};

signOutBtn.addEventListener("click", async () => {
  await signOut();
});

statusTabs.addEventListener("click", (e) => {
  const btn = e.target.closest(".admin-filter-tab");
  if (!btn) return;
  statusTabs.querySelectorAll(".admin-filter-tab").forEach((t) => t.classList.remove("active"));
  btn.classList.add("active");
  activeStatus = btn.dataset.status;
  renderList();
});

async function init() {
  currentUser = await requireAuth();

  const { data: businesses } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("owner_id", currentUser.id)
    .order("created_at", { ascending: true });

  myBusinesses = businesses || [];

  if (myBusinesses.length === 0) {
    noBusinessState.style.display = "block";
    return;
  }

  noBusinessState.style.display = "none";

  businessSelect.innerHTML = myBusinesses
    .map((b) => `<option value="${b.id}">${escapeHtml(b.name)}</option>`)
    .join("");

  const stored = localStorage.getItem("solidw_selected_business");
  selectedBusinessId = myBusinesses.find((b) => b.id === stored)?.id || myBusinesses[0].id;
  businessSelect.value = selectedBusinessId;

  businessSelect.addEventListener("change", () => {
    selectedBusinessId = businessSelect.value;
    localStorage.setItem("solidw_selected_business", selectedBusinessId);
    loadReservations();
  });

  await loadReservations();
}

async function loadReservations() {
  const { data, error } = await supabase
    .from("reservations")
    .select("id, customer_name, phone, date, time, notes, status, created_at")
    .eq("business_id", selectedBusinessId)
    .order("date", { ascending: false })
    .order("time", { ascending: false });

  if (error) {
    showToast("Could not load reservations.", "error");
    return;
  }

  reservations = data || [];
  renderList();
}

function renderList() {
  const filtered =
    activeStatus === "all" ? reservations : reservations.filter((r) => r.status === activeStatus);

  reservationsList.innerHTML = "";

  if (filtered.length === 0) {
    emptyReservations.style.display = "block";
    return;
  }
  emptyReservations.style.display = "none";

  for (const res of filtered) {
    const card = document.createElement("div");
    card.className = "card reservation-card";
    card.innerHTML = `
      <div>
        <strong>${escapeHtml(res.customer_name)}</strong>
        <span class="badge ${STATUS_BADGE[res.status] || "badge-free"}" style="margin-left: var(--space-2);">${res.status}</span>
        <div class="reservation-meta">
          <span>📅 ${res.date} at ${res.time?.slice(0, 5)}</span>
          <span>📞 ${escapeHtml(res.phone)}</span>
          ${res.notes ? `<span>📝 ${escapeHtml(res.notes)}</span>` : ""}
        </div>
      </div>
      <div style="display:flex; gap: var(--space-2); flex-wrap:wrap;">
        ${res.status === "pending" ? `<button type="button" class="btn btn-primary btn-sm" data-action="confirmed" data-id="${res.id}">Confirm</button>` : ""}
        ${res.status !== "completed" && res.status !== "cancelled" ? `<button type="button" class="btn btn-outline btn-sm" data-action="completed" data-id="${res.id}">Complete</button>` : ""}
        ${res.status !== "cancelled" ? `<button type="button" class="btn btn-ghost btn-sm" data-action="cancelled" data-id="${res.id}">Cancel</button>` : ""}
        <button type="button" class="btn btn-danger btn-sm" data-action="delete" data-id="${res.id}">Delete</button>
      </div>
    `;
    reservationsList.appendChild(card);
  }

  reservationsList.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => handleAction(btn.dataset.action, btn.dataset.id));
  });
}

async function handleAction(action, id) {
  if (action === "delete") {
    const { error } = await supabase.from("reservations").delete().eq("id", id);
    if (error) {
      showToast(error.message || "Could not delete reservation.", "error");
      return;
    }
    showToast("Reservation deleted.", "success");
  } else {
    const { error } = await supabase.from("reservations").update({ status: action }).eq("id", id);
    if (error) {
      showToast(error.message || "Could not update reservation.", "error");
      return;
    }
    showToast("Reservation updated.", "success");
  }

  await loadReservations();
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

init();
