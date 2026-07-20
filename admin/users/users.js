// ==========================================================================
// SolidW — Admin Users Management Logic
// ==========================================================================
// Lists all profiles, with search + status filter, a per-user business
// count, and a suspend/activate action via the admin_set_user_status RPC.
// ==========================================================================

import { requireAdmin, signOut } from "/assets/js/authGuard.js";
import { supabase } from "/assets/js/supabaseClient.js";
import { showToast } from "/assets/js/toast.js";

const signOutBtn = document.getElementById("signOutBtn");
const searchInput = document.getElementById("searchInput");
const statusTabs = document.getElementById("statusTabs");
const usersTableBody = document.getElementById("usersTableBody");
const emptyUsers = document.getElementById("emptyUsers");

let users = [];
let businessCounts = {};
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
  await loadUsers();
}

async function loadUsers() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, plan_id, status, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    showToast("Could not load users.", "error");
    return;
  }

  users = data || [];

  const { data: businesses } = await supabase.from("businesses").select("owner_id");
  businessCounts = {};
  for (const b of businesses || []) {
    businessCounts[b.owner_id] = (businessCounts[b.owner_id] || 0) + 1;
  }

  renderTable();
}

function renderTable() {
  let filtered = users;

  if (activeStatus !== "all") {
    filtered = filtered.filter((u) => u.status === activeStatus);
  }
  if (searchTerm) {
    filtered = filtered.filter((u) => (u.email || "").toLowerCase().includes(searchTerm));
  }

  usersTableBody.innerHTML = "";

  if (filtered.length === 0) {
    emptyUsers.style.display = "block";
    return;
  }
  emptyUsers.style.display = "none";

  for (const user of filtered) {
    const tr = document.createElement("tr");
    const initial = (user.email || "?").charAt(0).toUpperCase();
    tr.innerHTML = `
      <td>
        <div style="display:flex; align-items:center; gap: var(--space-3);">
          <span class="user-row-avatar">${initial}</span>
          <span>${escapeHtml(user.email)}</span>
        </div>
      </td>
      <td><span class="badge ${user.plan_id === "pro" ? "badge-pro" : "badge-free"}">${user.plan_id}</span></td>
      <td><span class="badge ${user.status === "active" ? "badge-success" : "badge-danger"}">${user.status}</span></td>
      <td>${businessCounts[user.id] || 0}</td>
      <td class="text-muted">${new Date(user.created_at).toLocaleDateString()}</td>
      <td>
        <button type="button" class="btn btn-outline btn-sm" data-action="toggle" data-id="${user.id}" data-status="${user.status}">
          ${user.status === "active" ? "Suspend" : "Activate"}
        </button>
      </td>
    `;
    usersTableBody.appendChild(tr);
  }

  usersTableBody.querySelectorAll('[data-action="toggle"]').forEach((btn) => {
    btn.addEventListener("click", () => toggleStatus(btn.dataset.id, btn.dataset.status));
  });
}

async function toggleStatus(userId, currentStatus) {
  const newStatus = currentStatus === "active" ? "suspended" : "active";

  const { error } = await supabase.rpc("admin_set_user_status", {
    p_user_id: userId,
    p_status: newStatus,
  });

  if (error) {
    showToast(error.message || "Could not update user status.", "error");
    return;
  }

  showToast(`User ${newStatus}.`, "success");
  await loadUsers();
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

init();
