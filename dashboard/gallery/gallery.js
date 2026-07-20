// ==========================================================================
// SolidW — Dashboard Gallery Logic
// ==========================================================================
// Upload/remove photos in the `gallery` storage bucket for the selected
// business. Enforces plans.max_gallery_images client-side; the
// check_gallery_limit trigger (sql/04_functions.sql) is the DB backstop.
// ==========================================================================

import { requireAuth, signOut } from "/assets/js/authGuard.js";
import { supabase } from "/assets/js/supabaseClient.js";
import { showToast } from "/assets/js/toast.js";
import { BUCKETS } from "/assets/js/config.js";

const signOutBtn = document.getElementById("signOutBtn");
const businessSelect = document.getElementById("businessSelect");
const noBusinessState = document.getElementById("noBusinessState");
const galleryContent = document.getElementById("galleryContent");
const galleryGrid = document.getElementById("galleryGrid");
const galleryFileInput = document.getElementById("galleryFileInput");
const galleryLimitText = document.getElementById("galleryLimitText");

let currentUser = null;
let currentPlan = null;
let myBusinesses = [];
let selectedBusinessId = null;
let images = [];

signOutBtn.addEventListener("click", async () => {
  await signOut();
});

async function init() {
  currentUser = await requireAuth();

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_id")
    .eq("id", currentUser.id)
    .single();

  if (profile) {
    const { data: plan } = await supabase
      .from("plans")
      .select("id, max_gallery_images")
      .eq("id", profile.plan_id)
      .single();
    currentPlan = plan || null;
  }

  const { data: businesses } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("owner_id", currentUser.id)
    .order("created_at", { ascending: true });

  myBusinesses = businesses || [];

  if (myBusinesses.length === 0) {
    noBusinessState.style.display = "block";
    galleryContent.style.display = "none";
    return;
  }

  noBusinessState.style.display = "none";
  galleryContent.style.display = "block";

  businessSelect.innerHTML = myBusinesses
    .map((b) => `<option value="${b.id}">${escapeHtml(b.name)}</option>`)
    .join("");

  const stored = localStorage.getItem("solidw_selected_business");
  selectedBusinessId = myBusinesses.find((b) => b.id === stored)?.id || myBusinesses[0].id;
  businessSelect.value = selectedBusinessId;

  businessSelect.addEventListener("change", () => {
    selectedBusinessId = businessSelect.value;
    localStorage.setItem("solidw_selected_business", selectedBusinessId);
    loadGallery();
  });

  await loadGallery();
}

async function loadGallery() {
  const { data, error } = await supabase
    .from("gallery_images")
    .select("id, url, sort_order")
    .eq("business_id", selectedBusinessId)
    .order("sort_order", { ascending: true });

  if (error) {
    showToast("Could not load gallery images.", "error");
    return;
  }

  images = data || [];
  renderGrid();
}

function renderGrid() {
  const max = currentPlan?.max_gallery_images;
  galleryLimitText.textContent = max
    ? `${images.length} of ${max} photos used`
    : `${images.length} photos (unlimited)`;

  const atLimit = !!max && images.length >= max;

  galleryGrid.innerHTML = "";

  for (const img of images) {
    const item = document.createElement("div");
    item.className = "gallery-item";
    item.innerHTML = `
      <img src="${img.url}" alt="" />
      <button type="button" class="gallery-item-remove" data-id="${img.id}" title="Remove">✕</button>
    `;
    galleryGrid.appendChild(item);
  }

  if (!atLimit) {
    const addTile = document.createElement("div");
    addTile.className = "gallery-add-tile";
    addTile.id = "galleryAddTile";
    addTile.textContent = "+";
    addTile.title = "Add photos";
    galleryGrid.appendChild(addTile);
    addTile.addEventListener("click", () => galleryFileInput.click());
  }

  galleryGrid.querySelectorAll(".gallery-item-remove").forEach((btn) => {
    btn.addEventListener("click", () => removeImage(btn.dataset.id));
  });
}

galleryFileInput.addEventListener("change", async () => {
  const files = Array.from(galleryFileInput.files || []);
  galleryFileInput.value = "";
  if (files.length === 0) return;

  const max = currentPlan?.max_gallery_images;
  for (const file of files) {
    if (max && images.length >= max) {
      showToast(`Gallery limit reached (${max}). Upgrade to Pro for unlimited photos.`, "warning");
      break;
    }
    await uploadOne(file);
  }

  await loadGallery();
});

async function uploadOne(file) {
  const path = `${currentUser.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

  const { error: uploadError } = await supabase.storage.from(BUCKETS.GALLERY).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (uploadError) {
    showToast(uploadError.message || "Upload failed.", "error");
    return;
  }

  const { data } = supabase.storage.from(BUCKETS.GALLERY).getPublicUrl(path);
  const url = data?.publicUrl;
  if (!url) return;

  const { error: insertError } = await supabase.from("gallery_images").insert({
    business_id: selectedBusinessId,
    url,
    sort_order: images.length,
  });

  if (insertError) {
    showToast(insertError.message || "Could not save photo.", "error");
  } else {
    images.push({ url });
  }
}

async function removeImage(id) {
  const { error } = await supabase.from("gallery_images").delete().eq("id", id);
  if (error) {
    showToast(error.message || "Could not remove photo.", "error");
    return;
  }
  showToast("Photo removed.", "success");
  await loadGallery();
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

init();
