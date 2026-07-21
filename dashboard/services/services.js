// ==========================================================================
// SolidW — Dashboard Services Logic
// ==========================================================================
// CRUD for the `services` table, scoped to the selected business.
// ==========================================================================

import { requireAuth, signOut } from "/assets/js/authGuard.js";
import { supabase } from "/assets/js/supabaseClient.js";
import { showToast } from "/assets/js/toast.js";

const signOutBtn = document.getElementById("signOutBtn");
const businessSelect = document.getElementById("businessSelect");
const noBusinessState = document.getElementById("noBusinessState");
const servicesContent = document.getElementById("servicesContent");
const servicesList = document.getElementById("servicesList");
const emptyServices = document.getElementById("emptyServices");
const addServiceBtn = document.getElementById("addServiceBtn");

const serviceModalOverlay = document.getElementById("serviceModalOverlay");
const serviceModalTitle = document.getElementById("serviceModalTitle");
const serviceModalError = document.getElementById("serviceModalError");
const closeServiceModalBtn = document.getElementById("closeServiceModalBtn");
const cancelServiceModalBtn = document.getElementById("cancelServiceModalBtn");
const serviceForm = document.getElementById("serviceForm");
const saveServiceBtn = document.getElementById("saveServiceBtn");
const saveServiceLabel = document.getElementById("saveServiceLabel");

const serviceIdInput = document.getElementById("serviceId");
const serviceNameInput = document.getElementById("serviceName");
const servicePriceInput = document.getElementById("servicePrice");
const serviceDescriptionInput = document.getElementById("serviceDescription");

let currentUser = null;
let myBusinesses = [];
let selectedBusinessId = null;
let services = [];

signOutBtn.addEventListener("click", async () => {
  await signOut();
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
    servicesContent.style.display = "none";
    return;
  }

  noBusinessState.style.display = "none";
  servicesContent.style.display = "block";

  businessSelect.innerHTML = myBusinesses
    .map((b) => `<option value="${b.id}">${escapeHtml(b.name)}</option>`)
    .join("");

  const stored = localStorage.getItem("solidw_selected_business");
  selectedBusinessId = myBusinesses.find((b) => b.id === stored)?.id || myBusinesses[0].id;
  businessSelect.value = selectedBusinessId;

  businessSelect.addEventListener("change", () => {
    selectedBusinessId = businessSelect.value;
    localStorage.setItem("solidw_selected_business", selectedBusinessId);
    loadServices();
  });

  await loadServices();
}

async function loadServices() {
  const { data, error } = await supabase
    .from("services")
    .select("id, name, price, description, sort_order")
    .eq("business_id", selectedBusinessId)
    .order("sort_order", { ascending: true });

  if (error) {
    showToast("Could not load services.", "error");
    return;
  }

  services = data || [];
  renderServices();
}

function renderServices() {
  servicesList.innerHTML = "";

  if (services.length === 0) {
    emptyServices.style.display = "block";
    return;
  }
  emptyServices.style.display = "none";

  for (const svc of services) {
    const row = document.createElement("div");
    row.className = "service-row";
    row.innerHTML = `
      <div class="service-row-info">
        <strong>${escapeHtml(svc.name)}</strong>
        ${svc.description ? `<span class="text-muted">${escapeHtml(svc.description)}</span>` : ""}
        <span class="service-row-price">$${Number(svc.price).toFixed(2)}</span>
      </div>
      <div class="service-row-actions">
        <button type="button" class="btn btn-outline btn-sm" data-action="edit" data-id="${svc.id}">Edit</button>
        <button type="button" class="btn btn-danger btn-sm" data-action="delete" data-id="${svc.id}">Delete</button>
      </div>
    `;
    servicesList.appendChild(row);
  }

  servicesList.querySelectorAll('[data-action="edit"]').forEach((btn) => {
    btn.addEventListener("click", () => openEditModal(btn.dataset.id));
  });
  servicesList.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener("click", () => deleteService(btn.dataset.id));
  });
}

addServiceBtn.addEventListener("click", () => openCreateModal());

function openCreateModal() {
  serviceModalTitle.textContent = "Add Service";
  serviceForm.reset();
  serviceIdInput.value = "";
  serviceModalError.style.display = "none";
  serviceModalOverlay.style.display = "flex";
}

function openEditModal(id) {
  const svc = services.find((s) => s.id === id);
  if (!svc) return;

  serviceModalTitle.textContent = "Edit Service";
  serviceModalError.style.display = "none";
  serviceIdInput.value = svc.id;
  serviceNameInput.value = svc.name;
  servicePriceInput.value = svc.price;
  serviceDescriptionInput.value = svc.description || "";
  serviceModalOverlay.style.display = "flex";
}

function closeModal() {
  serviceModalOverlay.style.display = "none";
}

closeServiceModalBtn.addEventListener("click", closeModal);
cancelServiceModalBtn.addEventListener("click", closeModal);
serviceModalOverlay.addEventListener("click", (e) => {
  if (e.target === serviceModalOverlay) closeModal();
});

serviceForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  serviceModalError.style.display = "none";

  const name = serviceNameInput.value.trim();
  const price = parseFloat(servicePriceInput.value);

  if (!name || isNaN(price) || price < 0) {
    serviceModalError.textContent = "Please enter a valid name and price.";
    serviceModalError.style.display = "block";
    return;
  }

  saveServiceBtn.disabled = true;
  saveServiceLabel.innerHTML = '<span class="spinner"></span> Saving…';

  const payload = {
    name,
    price,
    description: serviceDescriptionInput.value.trim() || null,
  };

  const editingId = serviceIdInput.value;
  let error;

  if (editingId) {
    ({ error } = await supabase.from("services").update(payload).eq("id", editingId));
  } else {
    // Base the new item's sort_order on the current max, not services.length —
    // after deletions, remaining sort_order values no longer line up with the
    // array length, so services.length can collide with an existing value and
    // leave two rows tied at the same sort_order.
    const nextSortOrder =
      services.length > 0
        ? Math.max(...services.map((s) => s.sort_order ?? 0)) + 1
        : 0;

    ({ error } = await supabase.from("services").insert({
      business_id: selectedBusinessId,
      sort_order: nextSortOrder,
      ...payload,
    }));
  }

  saveServiceBtn.disabled = false;
  saveServiceLabel.textContent = "Save";

  if (error) {
    serviceModalError.textContent = error.message || "Something went wrong.";
    serviceModalError.style.display = "block";
    return;
  }

  showToast(editingId ? "Service updated." : "Service added.", "success");
  closeModal();
  await loadServices();
});

async function deleteService(id) {
  const svc = services.find((s) => s.id === id);
  if (!svc) return;

  if (!window.confirm(`Delete "${svc.name}"? This cannot be undone.`)) {
    return;
  }

  const { error } = await supabase.from("services").delete().eq("id", id);
  if (error) {
    showToast(error.message || "Could not delete service.", "error");
    return;
  }
  showToast("Service deleted.", "success");
  await loadServices();
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

init();
