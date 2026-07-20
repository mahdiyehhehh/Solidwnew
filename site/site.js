// ==========================================================================
// SolidW — Public Booking Page Logic
// ==========================================================================
// Reads the business slug via routing.js, loads its public data (only
// rows where businesses.published = true, per RLS), and renders the
// about/gallery/services/hours tabs plus the reservation form. Booking
// submissions and page views are logged as public inserts, matching the
// RLS policies in sql/02_policies.sql.
// ==========================================================================

import { supabase } from "/assets/js/supabaseClient.js";
import { getSlug } from "/assets/js/routing.js";

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const loadingState = document.getElementById("loadingState");
const notFoundState = document.getElementById("notFoundState");
const pageContent = document.getElementById("pageContent");

const publicHero = document.getElementById("publicHero");
const businessLogo = document.getElementById("businessLogo");
const businessName = document.getElementById("businessName");
const businessAddress = document.getElementById("businessAddress");
const businessDescription = document.getElementById("businessDescription");
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");

const whatsappLink = document.getElementById("whatsappLink");
const telegramLink = document.getElementById("telegramLink");
const phoneLink = document.getElementById("phoneLink");
const websiteLink = document.getElementById("websiteLink");

const galleryGrid = document.getElementById("galleryGrid");
const galleryEmpty = document.getElementById("galleryEmpty");
const servicesGrid = document.getElementById("servicesGrid");
const servicesEmpty = document.getElementById("servicesEmpty");
const hoursTableBody = document.getElementById("hoursTableBody");

const bookingForm = document.getElementById("bookingForm");
const bookingClosedNotice = document.getElementById("bookingClosedNotice");
const bookingSuccess = document.getElementById("bookingSuccess");
const bookingError = document.getElementById("bookingError");
const bookingSubmitBtn = document.getElementById("bookingSubmitBtn");
const bookingSubmitLabel = document.getElementById("bookingSubmitLabel");

const lightboxOverlay = document.getElementById("lightboxOverlay");
const lightboxImage = document.getElementById("lightboxImage");
const lightboxClose = document.getElementById("lightboxClose");

let business = null;

async function init() {
  const slug = getSlug();

  if (!slug) {
    showNotFound();
    return;
  }

  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("slug", slug)
    .eq("published", true)
    .single();

  if (error || !data) {
    showNotFound();
    return;
  }

  business = data;
  render();
  logEvent("page_view");

  const [{ data: gallery }, { data: services }, { data: hours }] = await Promise.all([
    supabase.from("gallery_images").select("id, url").eq("business_id", business.id).order("sort_order"),
    supabase.from("services").select("id, name, price, description").eq("business_id", business.id).order("sort_order"),
    supabase.from("opening_hours").select("day_of_week, open_time, close_time, closed").eq("business_id", business.id),
  ]);

  renderGallery(gallery || []);
  renderServices(services || []);
  renderHours(hours || []);

  loadingState.style.display = "none";
  pageContent.style.display = "block";
}

function showNotFound() {
  loadingState.style.display = "none";
  notFoundState.style.display = "block";
}

function render() {
  document.getElementById("pageTitle").textContent = `${business.name} · SolidW`;
  document.getElementById("pageDescription").content = business.description || `Book with ${business.name}.`;

  if (business.cover_url) {
    publicHero.style.backgroundImage = `url('${business.cover_url}')`;
  }

  if (business.logo_url) {
    businessLogo.src = business.logo_url;
    businessLogo.style.display = "block";
  }

  businessName.textContent = business.name;
  businessAddress.textContent = business.address || "";
  businessDescription.textContent = business.description || "No description provided yet.";

  if (business.accepting_bookings) {
    statusDot.classList.remove("closed");
    statusText.textContent = "Accepting bookings";
  } else {
    statusDot.classList.add("closed");
    statusText.textContent = "Not accepting bookings right now";
    bookingClosedNotice.style.display = "block";
    bookingForm.style.display = "none";
  }

  if (business.whatsapp) {
    whatsappLink.href = `https://wa.me/${business.whatsapp.replace(/[^0-9]/g, "")}`;
    whatsappLink.style.display = "inline-flex";
    whatsappLink.addEventListener("click", () => logEvent("whatsapp_click"));
  }
  if (business.telegram) {
    telegramLink.href = `https://t.me/${business.telegram.replace(/^@/, "")}`;
    telegramLink.style.display = "inline-flex";
    telegramLink.addEventListener("click", () => logEvent("telegram_click"));
  }
  if (business.phone) {
    phoneLink.href = `tel:${business.phone}`;
    phoneLink.style.display = "inline-flex";
  }
  if (business.website) {
    websiteLink.href = business.website;
    websiteLink.style.display = "inline-flex";
  }

  const todayInput = document.getElementById("bookingDate");
  todayInput.min = new Date().toISOString().slice(0, 10);
}

function renderGallery(images) {
  galleryGrid.innerHTML = "";
  if (images.length === 0) {
    galleryEmpty.style.display = "block";
    return;
  }
  galleryEmpty.style.display = "none";

  for (const img of images) {
    const el = document.createElement("img");
    el.src = img.url;
    el.alt = business.name;
    el.addEventListener("click", () => openLightbox(img.url));
    galleryGrid.appendChild(el);
  }
}

function openLightbox(url) {
  lightboxImage.src = url;
  lightboxOverlay.style.display = "flex";
}
lightboxClose.addEventListener("click", () => (lightboxOverlay.style.display = "none"));
lightboxOverlay.addEventListener("click", (e) => {
  if (e.target === lightboxOverlay) lightboxOverlay.style.display = "none";
});

function renderServices(services) {
  servicesGrid.innerHTML = "";
  if (services.length === 0) {
    servicesEmpty.style.display = "block";
    return;
  }
  servicesEmpty.style.display = "none";

  for (const svc of services) {
    const card = document.createElement("div");
    card.className = "card public-service-card";
    card.innerHTML = `
      <div>
        <div class="name">${escapeHtml(svc.name)}</div>
        ${svc.description ? `<div class="text-muted" style="font-size: var(--fs-sm);">${escapeHtml(svc.description)}</div>` : ""}
      </div>
      <div class="price">$${Number(svc.price).toFixed(2)}</div>
    `;
    servicesGrid.appendChild(card);
  }
}

function renderHours(hours) {
  const byDay = {};
  for (const h of hours) byDay[h.day_of_week] = h;

  const todayDow = new Date().getDay();

  hoursTableBody.innerHTML = "";
  for (let d = 0; d < 7; d++) {
    const h = byDay[d];
    const isToday = d === todayDow;
    const tr = document.createElement("tr");
    const timeText = !h || h.closed ? "Closed" : `${h.open_time?.slice(0, 5)} – ${h.close_time?.slice(0, 5)}`;
    tr.innerHTML = `
      <td class="${isToday ? "today" : ""}">${DAY_LABELS[d]}</td>
      <td class="${isToday ? "today" : ""}">${timeText}</td>
    `;
    hoursTableBody.appendChild(tr);
  }
}

// ---- Tabs ----
document.querySelectorAll(".public-tab").forEach((tab) => {
  tab.addEventListener("click", (e) => {
    e.preventDefault();
    const target = tab.dataset.tab;

    document.querySelectorAll(".public-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");

    document.querySelectorAll(".tab-panel").forEach((panel) => {
      panel.style.display = panel.id === `${target}-panel` ? "block" : "none";
    });
  });
});

// ---- Booking form ----
bookingForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  bookingError.style.display = "none";
  bookingSuccess.style.display = "none";

  const customerName = document.getElementById("customerName").value.trim();
  const customerPhone = document.getElementById("customerPhone").value.trim();
  const date = document.getElementById("bookingDate").value;
  const time = document.getElementById("bookingTime").value;
  const notes = document.getElementById("bookingNotes").value.trim();

  if (!customerName || !customerPhone || !date || !time) {
    bookingError.textContent = "Please fill in all required fields.";
    bookingError.style.display = "block";
    return;
  }

  bookingSubmitBtn.disabled = true;
  bookingSubmitLabel.innerHTML = '<span class="spinner"></span> Booking…';

  const { error } = await supabase.from("reservations").insert({
    business_id: business.id,
    customer_name: customerName,
    phone: customerPhone,
    date,
    time,
    notes: notes || null,
    status: "pending",
  });

  bookingSubmitBtn.disabled = false;
  bookingSubmitLabel.textContent = "Book Now";

  if (error) {
    bookingError.textContent = error.message || "Could not submit your booking. Please try again.";
    bookingError.style.display = "block";
    return;
  }

  bookingSuccess.textContent = "Your reservation request has been sent!";
  bookingSuccess.style.display = "block";
  bookingForm.reset();
  logEvent("reservation_submit");
});

async function logEvent(eventType) {
  if (!business) return;
  await supabase.from("events").insert({
    business_id: business.id,
    event_type: eventType,
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

init();
