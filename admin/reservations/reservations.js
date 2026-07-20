// ==========================================================================
// SolidW — Admin Reservations Management Logic
// ==========================================================================
// Platform-wide reservation list (visible to admin via is_admin() RLS
// override), with search and status filtering, plus a delete action.
// ==========================================================================

import { requireAdmin, signOut } from "/assets/js/authGuard.js";
import { supabase } from "/assets/js/supabaseClient.js";
import { showToast } from "/assets/js/toast.js";

const signOutBtn = document.getElementById("signOutBtn");
const searchInput = document.getElementById("searchInput");
const statusTabs = document.getElementById("statusTabs");
const reservationsTableBody = document.getElementById("reservationsTableBody");
const emptyReservations = document.getElementById("emptyReservations");

const STATUS_BADGE = {
  pending: "badge-warning",
  confirmed: "badge-success",
  cancelled: "badge-danger",
  completed: "badge-free",
};

let reservations = [];
let activeStatus = "all";
let searchTerm = "";

signOutBtn.addEventListener("click", async () => {
  await signOut();
});

searchInput.addEventListener("input", () => {
  searchTerm = searchInput.value.trim().toLowerCase();
  renderTable();
});

statusTabs.addEventListener("click", (e) => {
  const btn = e.target.closest(".admin-filter-tab");
  if (!btn) return;
  statusTabs.querySelectorAll(".admin-filter-tab").forEach((t) => t.classList.remove("active"));
  btn.classList.add("active");
  activeStatus = btn.dataset.status;
  renderTable();
});

async function init() {
  await requireAdmin();
  await loadReservations();
}

async function loadReservations() {
  const { data, error } = await supabase
    .from("reservations")
    .select("id, customer_name, phone, date, time, status, businesses(name)")
    .order("date", { ascending: false })
    .order("time", { ascending: false })
    .limit(500);

  if (error) {
    showToast("Could not load reservations.", "error");
    return;
  }

  reservations = data || [];
  renderTable();
}

function renderTable() {
  let filtered = reservations;

  if (activeStatus !== "all") {
    filtered = filtered.filter((r) => r.status === activeStatus);
  }
  if (searchTerm) {
    filtered = filtered.filter(
      (r) =>
        (r.customer_name || "").toLowerCase().includes(searchTerm) ||
        (r.businesses?.name || "").toLowerCase().includes(searchTerm)
    );
  }

  reservationsTableBody.innerHTML = "";

  if (filtered.length === 0) {
    emptyReservations.style.display = "block";
    return;
  }
  emptyReservations.style.display = "none";

  for (const res of filtered) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <strong>${escapeHtml(res.customer_name)}</strong>
        <div class="text-muted" style="font-size: var(--fs-xs);">${escapeHtml(res.phone)}</div>
      </td>
      <td>${escapeHtml(res.businesses?.name || "—")}</td>
      <td class="text-muted">${res.date} ${res.time?.slice(0, 5)}</td>
      <td><span class="badge ${STATUS_BADGE[res.status] || "badge-free"}">${res.status}</span></td>
      <td>
        <button type="button" class="btn btn-danger btn-sm" data-action="delete" data-id="${res.id}">Delete</button>
      </td>
    `;
    reservationsTableBody.appendChild(tr);
  }

  reservationsTableBody.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener("click", () => deleteReservation(btn.dataset.id));
  });
}

async function deleteReservation(id) {
  const { error } = await supabase.from("reservations").delete().eq("id", id);
  if (error) {
    showToast(error.message || "Could not delete reservation.", "error");
    return;
  }
  showToast("Reservation deleted.", "success");
  await loadReservations();
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

init();
