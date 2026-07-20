// ==========================================================================
// SolidW — Dashboard Business Management Logic
// ==========================================================================
// Lists the signed-in owner's businesses, and lets them create, edit, and
// delete businesses (including logo/cover uploads) from a single modal
// form. Plan limits (plans.max_businesses) are checked client-side before
// opening the "create" modal, with the database trigger in
// sql/04_functions.sql (check_business_limit) as the defense-in-depth
// backstop.
// ==========================================================================

import { requireAuth, signOut } from "/assets/js/authGuard.js";
import { supabase } from "/assets/js/supabaseClient.js";
import { showToast } from "/assets/js/toast.js";
import { BUCKETS } from "/assets/js/config.js";
import { buildBusinessUrl, slugify } from "/assets/js/routing.js";

const planNameBadge = document.getElementById("planNameBadge");
const planLimitText = document.getElementById("planLimitText");
const suspendedBanner = document.getElementById("suspendedBanner");
const signOutBtn = document.getElementById("signOutBtn");

const businessList = document.getElementById("businessList");
const emptyState = document.getElementById("emptyState");
const addBusinessBtn = document.getElementById("addBusinessBtn");

const businessModalOverlay = document.getElementById("businessModalOverlay");
const modalTitle = document.getElementById("modalTitle");
const modalErrorBanner = document.getElementById("modalErrorBanner");
const closeModalBtn = document.getElementById("closeModalBtn");
const cancelModalBtn = document.getElementById("cancelModalBtn");
const businessForm = document.getElementById("businessForm");
const saveBusinessBtn = document.getElementById("saveBusinessBtn");
const saveBusinessLabel = document.getElementById("saveBusinessLabel");

const businessIdInput = document.getElementById("businessId");
const nameInput = document.getElementById("name");
const categoryInput = document.getElementById("category");
const timezoneInput = document.getElementById("timezone");
const descriptionInput = document.getElementById("description");
const addressInput = document.getElementById("address");
const phoneInput = document.getElementById("phone");
const whatsappInput = document.getElementById("whatsapp");
const telegramInput = document.getElementById("telegram");
const websiteInput = document.getElementById("website");
const acceptingBookingsInput = document.getElementById("acceptingBookings");
const publishedInput = document.getElementById("published");

const coverDropzone = document.getElementById("coverDropzone");
const coverInput = document.getElementById("coverInput");
const coverPreview = document.getElementById("coverPreview");
const coverDropzoneLabel = document.getElementById("coverDropzoneLabel");

const logoDropzone = document.getElementById("logoDropzone");
const logoInput = document.getElementById("logoInput");
const logoPreview = document.getElementById("logoPreview");
const logoDropzoneLabel = document.getElementById("logoDropzoneLabel");

const deleteModalOverlay = document.getElementById("deleteModalOverlay");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");

let currentUser = null;
let currentPlan = null;
let businesses = [];
let pendingDeleteId = null;
let pendingCoverFile = null;
let pendingLogoFile = null;

signOutBtn.addEventListener("click", async () => {
  await signOut();
});

// --------------------------------------------------------------------------
// Init
// --------------------------------------------------------------------------
async function init() {
  currentUser = await requireAuth(); // redirects if not logged in / is admin

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("plan_id, status")
    .eq("id", currentUser.id)
    .single();

  if (profileError || !profile) {
    showToast("Could not load your account. Please try again.", "error");
    return;
  }

  if (profile.status === "suspended") {
    suspendedBanner.style.display = "block";
  }

  const { data: plan } = await supabase
    .from("plans")
    .select("id, name, max_businesses")
    .eq("id", profile.plan_id)
    .single();

  currentPlan = plan || null;

  if (currentPlan) {
    planNameBadge.textContent = currentPlan.name;
    planNameBadge.className = currentPlan.id === "pro" ? "badge badge-pro" : "badge badge-free";
  }

  await loadBusinesses();
}

// --------------------------------------------------------------------------
// Load + render businesses
// --------------------------------------------------------------------------
async function loadBusinesses() {
  const { data, error } = await supabase
    .from("businesses")
    .select("id, slug, name, category, logo_url, cover_url, accepting_bookings, published")
    .eq("owner_id", currentUser.id)
    .order("created_at", { ascending: true });

  if (error) {
    showToast("Could not load your businesses.", "error");
    return;
  }

  businesses = data || [];
  renderBusinesses();
  renderPlanLimit();
}

function renderPlanLimit() {
  const max = currentPlan?.max_businesses;
  if (max) {
    planLimitText.textContent = `${businesses.length} of ${max} businesses used`;
  } else {
    planLimitText.textContent = `${businesses.length} businesses (unlimited)`;
  }

  const atLimit = !!max && businesses.length >= max;
  addBusinessBtn.disabled = atLimit;
  addBusinessBtn.title = atLimit ? "Upgrade to Pro to add more businesses" : "";
}

function renderBusinesses() {
  businessList.innerHTML = "";

  if (businesses.length === 0) {
    emptyState.style.display = "block";
    return;
  }
  emptyState.style.display = "none";

  for (const biz of businesses) {
    const card = document.createElement("div");
    card.className = "card feature-card";

    const statusBadge = biz.published
      ? '<span class="badge badge-success">Published</span>'
      : '<span class="badge badge-warning">Draft</span>';

    const bookingBadge = biz.accepting_bookings
      ? '<span class="badge badge-success">Accepting bookings</span>'
      : '<span class="badge badge-danger">Bookings paused</span>';

    card.innerHTML = `
      ${biz.logo_url ? `<img src="${biz.logo_url}" alt="" class="logo-preview" style="margin-bottom: var(--space-3);" />` : ""}
      <h3>${escapeHtml(biz.name)}</h3>
      <p class="text-muted">${escapeHtml(biz.category || "No category set")}</p>
      <div style="display:flex; gap: var(--space-2); flex-wrap:wrap; margin: var(--space-2) 0 var(--space-4);">
        ${statusBadge}
        ${bookingBadge}
      </div>
      <div style="display:flex; gap: var(--space-2); flex-wrap:wrap;">
        <button type="button" class="btn btn-outline btn-sm" data-action="edit" data-id="${biz.id}">Edit</button>
        <a href="${buildBusinessUrl(biz.slug)}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm">View Page</a>
        <button type="button" class="btn btn-danger btn-sm" data-action="delete" data-id="${biz.id}">Delete</button>
      </div>
    `;

    businessList.appendChild(card);
  }

  businessList.querySelectorAll('[data-action="edit"]').forEach((btn) => {
    btn.addEventListener("click", () => openEditModal(btn.dataset.id));
  });
  businessList.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener("click", () => openDeleteModal(btn.dataset.id));
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

// --------------------------------------------------------------------------
// Create / Edit modal
// --------------------------------------------------------------------------
addBusinessBtn.addEventListener("click", () => {
  const max = currentPlan?.max_businesses;
  if (max && businesses.length >= max) {
    showToast(`Your plan allows up to ${max} business(es). Upgrade to Pro for unlimited businesses.`, "warning");
    return;
  }
  openCreateModal();
});

function openCreateModal() {
  modalTitle.textContent = "Add Business";
  businessForm.reset();
  businessIdInput.value = "";
  pendingCoverFile = null;
  pendingLogoFile = null;
  hidePreview(coverPreview, coverDropzoneLabel, "Click to upload a cover photo");
  hidePreview(logoPreview, logoDropzoneLabel, "Click to upload a logo");
  timezoneInput.value = "UTC";
  acceptingBookingsInput.checked = true;
  publishedInput.checked = false;
  modalErrorBanner.style.display = "none";
  businessModalOverlay.style.display = "flex";
}

function openEditModal(id) {
  const biz = businesses.find((b) => b.id === id);
  if (!biz) return;

  modalTitle.textContent = "Edit Business";
  businessForm.reset();
  modalErrorBanner.style.display = "none";
  pendingCoverFile = null;
  pendingLogoFile = null;

  businessIdInput.value = biz.id;
  nameInput.value = biz.name || "";
  categoryInput.value = biz.category || "";
  descriptionInput.value = biz.description || "";
  addressInput.value = biz.address || "";
  phoneInput.value = biz.phone || "";
  whatsappInput.value = biz.whatsapp || "";
  telegramInput.value = biz.telegram || "";
  websiteInput.value = biz.website || "";
  timezoneInput.value = biz.timezone || "UTC";
  acceptingBookingsInput.checked = !!biz.accepting_bookings;
  publishedInput.checked = !!biz.published;

  if (biz.cover_url) {
    showPreview(coverPreview, coverDropzoneLabel, biz.cover_url, "Change cover photo");
  } else {
    hidePreview(coverPreview, coverDropzoneLabel, "Click to upload a cover photo");
  }

  if (biz.logo_url) {
    showPreview(logoPreview, logoDropzoneLabel, biz.logo_url, "Change logo");
  } else {
    hidePreview(logoPreview, logoDropzoneLabel, "Click to upload a logo");
  }

  // Full record (description not selected in list query) — fetch fresh
  // values in case another tab changed something since the list loaded.
  supabase
    .from("businesses")
    .select("*")
    .eq("id", id)
    .single()
    .then(({ data }) => {
      if (!data) return;
      descriptionInput.value = data.description || "";
      addressInput.value = data.address || "";
      phoneInput.value = data.phone || "";
      whatsappInput.value = data.whatsapp || "";
      telegramInput.value = data.telegram || "";
      websiteInput.value = data.website || "";
      timezoneInput.value = data.timezone || "UTC";
    });

  businessModalOverlay.style.display = "flex";
}

function closeModal() {
  businessModalOverlay.style.display = "none";
}

closeModalBtn.addEventListener("click", closeModal);
cancelModalBtn.addEventListener("click", closeModal);
businessModalOverlay.addEventListener("click", (e) => {
  if (e.target === businessModalOverlay) closeModal();
});

function showPreview(imgEl, labelEl, url, label) {
  imgEl.src = url;
  imgEl.style.display = "block";
  labelEl.textContent = label;
}

function hidePreview(imgEl, labelEl, label) {
  imgEl.src = "";
  imgEl.style.display = "none";
  labelEl.textContent = label;
}

// ---- Upload dropzones ----
coverDropzone.addEventListener("click", () => coverInput.click());
coverInput.addEventListener("change", () => {
  const file = coverInput.files?.[0];
  if (!file) return;
  pendingCoverFile = file;
  showPreview(coverPreview, coverDropzoneLabel, URL.createObjectURL(file), "Change cover photo");
});

logoDropzone.addEventListener("click", () => logoInput.click());
logoInput.addEventListener("change", () => {
  const file = logoInput.files?.[0];
  if (!file) return;
  pendingLogoFile = file;
  showPreview(logoPreview, logoDropzoneLabel, URL.createObjectURL(file), "Change logo");
});

async function uploadImage(bucket, file) {
  const path = `${currentUser.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (uploadError) {
    throw new Error(uploadError.message || "Image upload failed.");
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl || null;
}

// --------------------------------------------------------------------------
// Save (create or update)
// --------------------------------------------------------------------------
businessForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  modalErrorBanner.style.display = "none";

  const name = nameInput.value.trim();
  if (!name) {
    showModalError("Business name is required.");
    return;
  }

  setSaving(true);

  try {
    let logoUrl;
    let coverUrl;

    if (pendingLogoFile) {
      logoUrl = await uploadImage(BUCKETS.LOGOS, pendingLogoFile);
    }
    if (pendingCoverFile) {
      coverUrl = await uploadImage(BUCKETS.COVERS, pendingCoverFile);
    }

    const payload = {
      name,
      category: categoryInput.value.trim() || null,
      description: descriptionInput.value.trim() || null,
      address: addressInput.value.trim() || null,
      phone: phoneInput.value.trim() || null,
      whatsapp: whatsappInput.value.trim() || null,
      telegram: telegramInput.value.trim() || null,
      website: websiteInput.value.trim() || null,
      timezone: timezoneInput.value.trim() || "UTC",
      accepting_bookings: acceptingBookingsInput.checked,
      published: publishedInput.checked,
    };

    if (logoUrl) payload.logo_url = logoUrl;
    if (coverUrl) payload.cover_url = coverUrl;

    const editingId = businessIdInput.value;

    if (editingId) {
      const { error } = await supabase.from("businesses").update(payload).eq("id", editingId);
      if (error) throw new Error(error.message);
      showToast("Business updated.", "success");
    } else {
      const { data: slugData, error: slugError } = await supabase.rpc("generate_unique_slug", {
        base_name: name,
      });
      const slug = !slugError && slugData ? slugData : slugify(name);

      const { error } = await supabase.from("businesses").insert({
        owner_id: currentUser.id,
        slug,
        ...payload,
      });
      if (error) throw new Error(error.message);
      showToast("Business created.", "success");
    }

    closeModal();
    await loadBusinesses();
  } catch (err) {
    showModalError(err.message || "Something went wrong. Please try again.");
  } finally {
    setSaving(false);
  }
});

function showModalError(message) {
  modalErrorBanner.textContent = message;
  modalErrorBanner.style.display = "block";
}

function setSaving(isSaving) {
  saveBusinessBtn.disabled = isSaving;
  saveBusinessLabel.innerHTML = isSaving ? '<span class="spinner"></span> Saving…' : "Save";
}

// --------------------------------------------------------------------------
// Delete
// --------------------------------------------------------------------------
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
    showToast(error.message || "Could not delete this business.", "error");
    return;
  }

  showToast("Business deleted.", "success");
  closeDeleteModal();
  await loadBusinesses();
});

init();
