// ==========================================================================
// SolidW — Admin Businesses Management Logic
// ==========================================================================
// Lists every business on the platform (RLS's is_admin() override makes
// this visible to the admin account only), with search, a published/draft
// filter, and force-delete.
// ==========================================================================

import { requireAdmin, signOut } from "/assets/js/authGuard.js";
import { supabase } from "/assets/js/supabaseClient.js";
import { showToast } from "/assets/js/toast.js";
import { buildBusinessUrl } from "/assets/js/routing.js";

const signOutBtn = document.getElementById("signOutBtn");
const searchInput = document.getElementById("searchInput");
const statusTabs = document.getElementById("statusTabs");
const businessesTableBody = document.getElementById("businessesTableBody");
const emptyBusinesses = document.getElementById("emptyBusinesses");

const deleteModalOverlay = document.getElementById("deleteModalOverlay");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");

let businesses = [];
let reservationCounts = {};
let activeStatus = "all";
let searchTerm = "";
let pendingDeleteId = null;

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
  await loadBusinesses();
}

async function loadBusinesses() {
  const { data, error } = await supabase
    .from("businesses")
    .select("id, name, slug, published, owner_id, profiles(email)")
    .order("created_at", { ascending: false });

  if (error) {
    showToast("Could not load businesses.", "error");
    return;
  }

  businesses = data || [];

  const { data: reservations } = await supabase.from("reservations").select("business_id");
  reservationCounts = {};
  for (const r of reservations || []) {
    reservationCounts[r.business_id] = (reservationCounts[r.business_id] || 0) + 1;
  }

  renderTable();
}

function renderTable() {
  let filtered = businesses;

  if (activeStatus === "published") filtered = filtered.filter((b) => b.published);
  if (activeStatus === "draft") filtered = filtered.filter((b) => !b.published);

  if (searchTerm) {
    filtered = filtered.filter(
      (b) =>
        (b.name || "").toLowerCase().includes(searchTerm) ||
        (b.slug || "").toLowerCase().includes(searchTerm)
    );
  }

  businessesTableBody.innerHTML = "";

  if (filtered.length === 0) {
    emptyBusinesses.style.display = "block";
    return;
  }
  emptyBusinesses.style.display = "none";

  for (const biz of filtered) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <a href="${buildBusinessUrl(biz.slug)}" target="_blank" rel="noopener">${escapeHtml(biz.name)}</a>
        <div class="text-muted" style="font-size: var(--fs-xs);">/business/${escapeHtml(biz.slug)}</div>
      </td>
      <td class="text-muted">${escapeHtml(biz.profiles?.email || biz.owner_id)}</td>
      <td><span class="badge ${biz.published ? "badge-success" : "badge-warning"}">${biz.published ? "Published" : "Draft"}</span></td>
      <td>${reservationCounts[biz.id] || 0}</td>
      <td>
        <button type="button" class="btn btn-danger btn-sm" data-action="delete" data-id="${biz.id}">Delete</button>
      </td>
    `;
    businessesTableBody.appendChild(tr);
  }

  businessesTableBody.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener("click", () => openDeleteModal(btn.dataset.id));
  });
}

function openDeleteModal(id) {
  pendingDeleteId = id;
  deleteModalOverlay.style.display = "flex";
}

function closeDeleteModal() {
  pendingDeleteId = null;
  deleteModalOverlay.style.display = "none";
}

cancelDeleteBtn.addEventListener("click", closeDeleteModal);
deleteModalOverlay.addEventListener("click", (e) => {
  if (e.target === deleteModalOverlay) closeDeleteModal();
});

confirmDeleteBtn.addEventListener("click", async () => {
  if (!pendingDeleteId) return;

  confirmDeleteBtn.disabled = true;
  const { error } = await supabase.from("businesses").delete().eq("id", pendingDeleteId);
  confirmDeleteBtn.disabled = false;

  if (error) {
    showToast(error.message || "Could not delete business.", "error");
    return;
  }

  showToast("Business deleted.", "success");
  closeDeleteModal();
  await loadBusinesses();
});

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

init();
