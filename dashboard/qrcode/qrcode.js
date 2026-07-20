// ==========================================================================
// SolidW — Dashboard QR Code Logic
// ==========================================================================
// Renders a scannable QR code for the selected business's public booking
// URL (built via routing.js), with copy/open/download actions.
// ==========================================================================

import { requireAuth, signOut } from "/assets/js/authGuard.js";
import { supabase } from "/assets/js/supabaseClient.js";
import { showToast } from "/assets/js/toast.js";
import { buildBusinessUrl } from "/assets/js/routing.js";
import QRCode from "https://cdn.jsdelivr.net/npm/qrcode@1.5.3/+esm";

const signOutBtn = document.getElementById("signOutBtn");
const businessSelect = document.getElementById("businessSelect");
const noBusinessState = document.getElementById("noBusinessState");
const qrContent = document.getElementById("qrContent");
const qrCanvas = document.getElementById("qrCanvas");
const qrLinkText = document.getElementById("qrLinkText");
const copyLinkBtn = document.getElementById("copyLinkBtn");
const openLinkBtn = document.getElementById("openLinkBtn");
const downloadQrBtn = document.getElementById("downloadQrBtn");

let currentUser = null;
let myBusinesses = [];
let selectedBusinessId = null;
let currentUrl = "";
let currentSlug = "";

signOutBtn.addEventListener("click", async () => {
  await signOut();
});

async function init() {
  currentUser = await requireAuth();

  const { data: businesses } = await supabase
    .from("businesses")
    .select("id, name, slug")
    .eq("owner_id", currentUser.id)
    .order("created_at", { ascending: true });

  myBusinesses = businesses || [];

  if (myBusinesses.length === 0) {
    noBusinessState.style.display = "block";
    qrContent.style.display = "none";
    return;
  }

  noBusinessState.style.display = "none";
  qrContent.style.display = "flex";

  businessSelect.innerHTML = myBusinesses
    .map((b) => `<option value="${b.id}">${escapeHtml(b.name)}</option>`)
    .join("");

  const stored = localStorage.getItem("solidw_selected_business");
  selectedBusinessId = myBusinesses.find((b) => b.id === stored)?.id || myBusinesses[0].id;
  businessSelect.value = selectedBusinessId;

  businessSelect.addEventListener("change", () => {
    selectedBusinessId = businessSelect.value;
    localStorage.setItem("solidw_selected_business", selectedBusinessId);
    renderQr();
  });

  renderQr();
}

async function renderQr() {
  const biz = myBusinesses.find((b) => b.id === selectedBusinessId);
  if (!biz) return;

  currentSlug = biz.slug;
  currentUrl = buildBusinessUrl(biz.slug);
  qrLinkText.textContent = currentUrl;
  openLinkBtn.href = currentUrl;

  await QRCode.toCanvas(qrCanvas, currentUrl, {
    width: 240,
    margin: 2,
    color: { dark: "#241b17", light: "#ffffff" },
  });
}

copyLinkBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(currentUrl);
    showToast("Link copied to clipboard.", "success");
  } catch {
    showToast("Could not copy link.", "error");
  }
});

downloadQrBtn.addEventListener("click", () => {
  const link = document.createElement("a");
  link.download = `solidw-qr-${currentSlug || "business"}.png`;
  link.href = qrCanvas.toDataURL("image/png");
  link.click();
});

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

init();
