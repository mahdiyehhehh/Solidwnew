// ==========================================================================
// SolidW — Create / Edit Business
// ==========================================================================
// On load: checks whether the signed-in owner already has a business.
//   - No business  → shows the create form directly.
//   - Has business → shows a read-only view with an "Edit Business" button
//                    that reveals the same form, pre-filled.
// On save: uploads an optional logo to Supabase Storage, generates a unique
// slug from the business name (the businesses table requires a unique slug
// but the form doesn't collect one from the user), and inserts or updates
// the row in the existing `businesses` table.
// ==========================================================================

import { requireAuth, signOut } from "/assets/js/authGuard.js";
import { supabase } from "/assets/js/supabaseClient.js";
import { showToast } from "/assets/js/toast.js";
import { BUCKETS } from "/assets/js/config.js";

const loadingState = document.getElementById("loadingState");
const viewMode = document.getElementById("viewMode");
const formMode = document.getElementById("formMode");

const viewLogo = document.getElementById("viewLogo");
const viewName = document.getElementById("viewName");
const viewCategory = document.getElementById("viewCategory");
const viewDescription = document.getElementById("viewDescription");
const viewPhone = document.getElementById("viewPhone");
const viewWhatsapp = document.getElementById("viewWhatsapp");
const viewTelegram = document.getElementById("viewTelegram");
const viewAddress = document.getElementById("viewAddress");
const editBtn = document.getElementById("editBtn");

const formTitle = document.getElementById("formTitle");
const formSubtitle = document.getElementById("formSubtitle");
const businessForm = document.getElementById("businessForm");
const bizNameInput = document.getElementById("bizNameInput");
const bizCategoryInput = document.getElementById("bizCategoryInput");
const bizDescriptionInput = document.getElementById("bizDescriptionInput");
const bizPhoneInput = document.getElementById("bizPhoneInput");
const bizWhatsappInput = document.getElementById("bizWhatsappInput");
const bizTelegramInput = document.getElementById("bizTelegramInput");
const bizAddressInput = document.getElementById("bizAddressInput");
const bizLogoInput = document.getElementById("bizLogoInput");
const logoPreview = document.getElementById("logoPreview");
const formError = document.getElementById("formError");
const saveBtn = document.getElementById("saveBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const signOutBtn = document.getElementById("signOutBtn");

signOutBtn.addEventListener("click", async () => {
  await signOut();
});

let currentUser = null;
let existingBusiness = null; // null until we know, then either a row or false

// ---- Logo preview on file select ----
bizLogoInput.addEventListener("change", () => {
  const file = bizLogoInput.files[0];
  if (!file) {
    logoPreview.style.display = "none";
    return;
  }
  logoPreview.src = URL.createObjectURL(file);
  logoPreview.style.display = "block";
});

// ---- Edit button: reveal the form pre-filled with the existing business ----
editBtn.addEventListener("click", () => {
  fillFormFromBusiness(existingBusiness);
  formTitle.textContent = "Edit Your Business";
  formSubtitle.textContent = "Update your business details below.";
  cancelEditBtn.style.display = "inline-flex";
  viewMode.style.display = "none";
  formMode.style.display = "block";
});

// ---- Cancel edit: go back to the read-only view ----
cancelEditBtn.addEventListener("click", () => {
  formMode.style.display = "none";
  viewMode.style.display = "block";
  clearFormError();
});

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

async function uploadLogo(userId, file) {
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKETS.LOGOS)
    .upload(path, file, { upsert: true });
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from(BUCKETS.LOGOS).getPublicUrl(path);
  return data.publicUrl;
}

function showFormError(message) {
  formError.textContent = message;
  formError.style.display = "block";
}

function clearFormError() {
  formError.textContent = "";
  formError.style.display = "none";
}

function fillFormFromBusiness(biz) {
  bizNameInput.value = biz?.name || "";
  bizCategoryInput.value = biz?.category || "";
  bizDescriptionInput.value = biz?.description || "";
  bizPhoneInput.value = biz?.phone || "";
  bizWhatsappInput.value = biz?.whatsapp || "";
  bizTelegramInput.value = biz?.telegram || "";
  bizAddressInput.value = biz?.address || "";
  bizLogoInput.value = "";
  if (biz?.logo_url) {
    logoPreview.src = biz.logo_url;
    logoPreview.style.display = "block";
  } else {
    logoPreview.style.display = "none";
  }
}

function renderViewMode(biz) {
  viewName.textContent = biz.name;
  viewCategory.textContent = biz.category || "Uncategorized";
  viewDescription.textContent = biz.description || "No description yet.";
  viewPhone.textContent = biz.phone || "—";
  viewWhatsapp.textContent = biz.whatsapp || "—";
  viewTelegram.textContent = biz.telegram || "—";
  viewAddress.textContent = biz.address || "—";

  if (biz.logo_url) {
    viewLogo.src = biz.logo_url;
    viewLogo.style.display = "block";
  } else {
    viewLogo.style.display = "none";
  }
}

businessForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearFormError();

  const name = bizNameInput.value.trim();
  if (!name) {
    showFormError("Business name is required.");
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = "Saving…";

  // Capture this BEFORE existingBusiness gets reassigned to the saved row
  // below — otherwise the "was this new" check always sees a truthy value
  // and the toast would always say "updated".
  const isNewBusiness = !existingBusiness;

  try {
    let logoUrl = existingBusiness ? existingBusiness.logo_url : null;
    const logoFile = bizLogoInput.files[0];
    if (logoFile) {
      logoUrl = await uploadLogo(currentUser.id, logoFile);
    }

    const payload = {
      name,
      category: bizCategoryInput.value.trim() || null,
      description: bizDescriptionInput.value.trim() || null,
      phone: bizPhoneInput.value.trim() || null,
      whatsapp: bizWhatsappInput.value.trim() || null,
      telegram: bizTelegramInput.value.trim() || null,
      address: bizAddressInput.value.trim() || null,
      logo_url: logoUrl,
    };

    let savedBusiness;

    if (existingBusiness) {
      // ---- Update existing business ----
      const { data, error } = await supabase
        .from("businesses")
        .update(payload)
        .eq("id", existingBusiness.id)
        .select()
        .single();
      if (error) throw error;
      savedBusiness = data;
    } else {
      // ---- Create new business ----
      const slug = await generateUniqueSlug(name);
      const { data, error } = await supabase
        .from("businesses")
        .insert({
          ...payload,
          owner_id: currentUser.id,
          slug,
        })
        .select()
        .single();
      if (error) throw error;
      savedBusiness = data;
    }

    existingBusiness = savedBusiness;

    showToast(
      isNewBusiness ? "Business created successfully." : "Business updated successfully.",
      "success"
    );

    // Redirect back to the dashboard, which will display the saved business.
    window.location.href = "/dashboard/index.html";
  } catch (err) {
    console.error("Save business error:", err);
    showFormError(err.message || "Something went wrong. Please try again.");
    saveBtn.disabled = false;
    saveBtn.textContent = "Save Business";
  }
});

async function init() {
  currentUser = await requireAuth(); // redirects if not logged in / is admin

  const { data: biz, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", currentUser.id)
    .maybeSingle();

  if (error) {
    showToast("Could not load your business. Please try again.", "error");
    loadingState.innerHTML = "<h3>Something went wrong loading your business.</h3>";
    return;
  }

  loadingState.style.display = "none";
  existingBusiness = biz || null;

  if (existingBusiness) {
    renderViewMode(existingBusiness);
    viewMode.style.display = "block";
    formMode.style.display = "none";
  } else {
    fillFormFromBusiness(null);
    formTitle.textContent = "Create Your Business";
    formSubtitle.textContent = "Tell us about your business so customers can find and book you.";
    cancelEditBtn.style.display = "none";
    viewMode.style.display = "none";
    formMode.style.display = "block";
  }
}

init();
