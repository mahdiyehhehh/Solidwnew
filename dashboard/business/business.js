// ==========================================================================
// SolidW — Business List (Create / Edit / Delete)
// ==========================================================================

import { requireAuth, signOut } from "/assets/js/authGuard.js";
import { supabase } from "/assets/js/supabaseClient.js";
import { showToast } from "/assets/js/toast.js";
import { BUCKETS } from "/assets/js/config.js";

document.title = "JS LOADED - " + document.title;

const businessList = document.getElementById("businessList");
const emptyState = document.getElementById("emptyState");
const addBusinessBtn = document.getElementById("addBusinessBtn");
const planNameBadge = document.getElementById("planNameBadge");
const planLimitText = document.getElementById("planLimitText");
const suspendedBanner = document.getElementById("suspendedBanner");

const businessModalOverlay = document.getElementById("businessModalOverlay");
const modalTitle = document.getElementById("modalTitle");
const closeModalBtn = document.getElementById("closeModalBtn");
const modalErrorBanner = document.getElementById("modalErrorBanner");
const cancelModalBtn = document.getElementById("cancelModalBtn");

const businessForm = document.getElementById("businessForm");
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

const coverInput = document.getElementById("coverInput");
const coverPreview = document.getElementById("coverPreview");
const coverDropzoneLabel = document.getElementById("coverDropzoneLabel");
const logoInput = document.getElementById("logoInput");
const logoPreview = document.getElementById("logoPreview");
const logoDropzoneLabel = document.getElementById("logoDropzoneLabel");

const saveBusinessBtn = document.getElementById("saveBusinessBtn");
const saveBusinessLabel = document.getElementById("saveBusinessLabel");

const deleteModalOverlay = document.getElementById("deleteModalOverlay");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");

const signOutBtn = document.getElementById("signOutBtn");

let currentUser = null;
let businesses = [];
let currentPlan = null;
let pendingDeleteId = null;
let pendingCoverFile = null;
let pendingLogoFile = null;

signOutBtn.addEventListener("click", async () => {
  await signOut();
});

// ---- File previews ----
coverInput.addEventListener("change", () => {
  const file = coverInput.files[0];
  if (!file) return;
  pendingCoverFile = file;
  coverPreview.src = URL.createObjectURL(file);
  coverPreview.style.display = "block";
  coverDropzoneLabel.textContent = file.name;
});

logoInput.addEventListener("change", () => {
  const file = logoInput.files[0];
  if (!file) return;
  pendingLogoFile = file;
  logoPreview.src = URL.createObjectURL(file);
  logoPreview.style.display = "block";
  logoDropzoneLabel.textContent = file.name;
});

// ---- Helpers ----
function slugify(text) {
  return (text || "")
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function generateUniqueSlug(baseName) {
  const base = slugify(baseName) || "business";
  let candidate = base;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data } = await supabase
      .from("businesses")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (!data) return candidate;
    candidate = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return `${base}-${Date.now()}`;
}

async function uploadImage(bucket, userId, file) {
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true });
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

function showModalError(message) {
  modalErrorBanner.textContent = message;
  modalErrorBanner.style.display = "block";
}

function clearModalError() {
  modalErrorBanner.textContent = "";
  modalErrorBanner.style.display = "none";
}

function resetForm() {
  businessForm.reset();
  businessIdInput.value = "";
  pendingCoverFile = null;
  pendingLogoFile = null;
  coverPreview.style.display = "none";
  coverPreview.src = "";
  coverDropzoneLabel.textContent = "Click to upload a cover photo";
  logoPreview.style.display = "none";
  logoPreview.src = "";
  logoDropzoneLabel.textContent = "Click to upload a logo";
  acceptingBookingsInput.checked = true;
  publishedInput.checked = false;
  clearModalError();
}

function openModalForCreate() {
  resetForm();
  modalTitle.textContent = "Add Business";
  businessModalOverlay.style.display = "flex";
}

function openModalForEdit(biz) {
  resetForm();
  modalTitle.textContent = "Edit Business";
  businessIdInput.value = biz.id;
  nameInput.value = biz.name || "";
  categoryInput.value = biz.category || "";
  timezoneInput.value = biz.timezone || "";
  descriptionInput.value = biz.description || "";
  addressInput.value = biz.address || "";
  phoneInput.value = biz.phone || "";
  whatsappInput.value = biz.whatsapp || "";
  telegramInput.value = biz.telegram || "";
  websiteInput.value = biz.website || "";
  acceptingBookingsInput.checked = !!biz.accepting_bookings;
  publishedInput.checked = !!biz.published;
  if (biz.cover_url) {
    coverPreview.src = biz.cover_url;
    coverPreview.style.display = "block";
  }
  if (biz.logo_url) {
    logoPreview.src = biz.logo_url;
    logoPreview.style.display = "block";
  }
  businessModalOverlay.style.display = "flex";
}

function closeModal() {
  businessModalOverlay.style.display = "none";
}

addBusinessBtn.addEventListener("click", () => {
  const limit = currentPlan?.max_businesses;
  if (limit && businesses.length >= limit) {
    showToast(`Your ${currentPlan.name} plan allows up to ${limit} business(es). Upgrade to add more.`, "error");
    return;
  }
  openModalForCreate();
});

closeModalBtn.addEventListener("click", closeModal);
cancelModalBtn.addEventListener("click", closeModal);

// ---- Render the business list ----
function renderBusinessList() {
  businessList.innerHTML = "";

  if (businesses.length === 0) {
    emptyState.style.display = "block";
    return;
  }
  emptyState.style.display = "none";

  businesses.forEach((biz) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      ${biz.cover_url ? `<img src="${biz.cover_url}" alt="" style="width:100%; border-radius: var(--radius-md); margin-bottom: var(--space-3);" />` : ""}
      <h3>${biz.name}</h3>
      <p class="text-muted">${biz.category || "Uncategorized"}</p>
      <p class="text-muted">${biz.published ? "🟢 Published" : "⚪ Not published"}</p>
      <div style="display:flex; gap: var(--space-2); margin-top: var(--space-3);">
        <button type="button" class="btn btn-outline btn-sm edit-btn">Edit</button>
        <button type="button" class="btn btn-danger btn-sm delete-btn">Delete</button>
      </div>
    `;
    card.querySelector(".edit-btn").addEventListener("click", () => openModalForEdit(biz));
    card.querySelector(".delete-btn").addEventListener("click", () => {
      pendingDeleteId = biz.id;
      deleteModalOverlay.style.display = "flex";
    });
    businessList.appendChild(card);
  });
}

// ---- Delete flow ----
cancelDeleteBtn.addEventListener("click", () => {
  pendingDeleteId = null;
  deleteModalOverlay.style.display = "none";
});

confirmDeleteBtn.addEventListener("click", async () => {
  if (!pendingDeleteId) return;
  confirmDeleteBtn.disabled = true;
  const { error } = await supabase.from("businesses").delete().eq("id", pendingDeleteId);
  confirmDeleteBtn.disabled = false;
  deleteModalOverlay.style.display = "none";

  if (error) {
    showToast("Could not delete business. Please try again.", "error");
    return;
  }

  businesses = businesses.filter((b) => b.id !== pendingDeleteId);
  pendingDeleteId = null;
  renderBusinessList();
  showToast("Business deleted.", "success");
});

// ---- Save (create or update) ----
businessForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearModalError();

  const name = nameInput.value.trim();
  if (!name) {
    showModalError("Business name is required.");
    return;
  }

  const editingId = businessIdInput.value || null;
  const limit = currentPlan?.max_businesses;
  if (!editingId && limit && businesses.length >= limit) {
    showModalError(`Your ${currentPlan.name} plan allows up to ${limit} business(es).`);
    return;
  }

  saveBusinessBtn.disabled = true;
  saveBusinessLabel.textContent = "Saving…";

  try {
    const existing = editingId ? businesses.find((b) => b.id === editingId) : null;

    let coverUrl = existing?.cover_url || null;
    if (pendingCoverFile) {
      coverUrl = await uploadImage(BUCKETS.COVERS, currentUser.id, pendingCoverFile);
    }

    let logoUrl = existing?.logo_url || null;
    if (pendingLogoFile) {
      logoUrl = await uploadImage(BUCKETS.LOGOS, currentUser.id, pendingLogoFile);
    }

    const payload = {
      name,
      category: categoryInput.value.trim() || null,
      timezone: timezoneInput.value.trim() || "UTC",
      description: descriptionInput.value.trim() || null,
      address: addressInput.value.trim() || null,
      phone: phoneInput.value.trim() || null,
      whatsapp: whatsappInput.value.trim() || null,
      telegram: telegramInput.value.trim() || null,
      website: websiteInput.value.trim() || null,
      accepting_bookings: acceptingBookingsInput.checked,
      published: publishedInput.checked,
      cover_url: coverUrl,
      logo_url: logoUrl,
    };

    let savedBusiness;

    if (editingId) {
      const { data, error } = await supabase
        .from("businesses")
        .update(payload)
        .eq("id", editingId)
        .select()
        .single();
      if (error) throw error;
      savedBusiness = data;
      businesses = businesses.map((b) => (b.id === editingId ? savedBusiness : b));
    } else {
      const slug = await generateUniqueSlug(name);
      const { data, error } = await supabase
        .from("businesses")
        .insert({ ...payload, owner_id: currentUser.id, slug })
        .select()
        .single();
      if (error) throw error;
      savedBusiness = data;
      businesses = [...businesses, savedBusiness];
    }

    renderBusinessList();
    closeModal();
    showToast(editingId ? "Business updated successfully." : "Business created successfully.", "success");
  } catch (err) {
    console.error("Save business error:", err);
    showModalError(err.message || "Something went wrong. Please try again.");
  } finally {
    saveBusinessBtn.disabled = false;
    saveBusinessLabel.textContent = "Save";
  }
});

// ---- Init ----
async function init() {
  currentUser = await requireAuth();

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_id, status")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (profile?.status === "suspended") {
    suspendedBanner.style.display = "block";
  }

  if (profile?.plan_id) {
    const { data: plan } = await supabase
      .from("plans")
      .select("*")
      .eq("id", profile.plan_id)
      .maybeSingle();
    currentPlan = plan;
    planNameBadge.textContent = plan?.name || "Free";
    planLimitText.textContent = plan?.max_businesses
      ? `${plan.max_businesses} business(es) max`
      : "Unlimited businesses";
  } else {
    planLimitText.textContent = "";
  }

  const { data: bizRows, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", currentUser.id)
    .order("created_at", { ascending: true });

  if (error) {
    showToast("Could not load your businesses. Please try again.", "error");
    return;
  }

  businesses = bizRows || [];
  renderBusinessList();
}

init();
