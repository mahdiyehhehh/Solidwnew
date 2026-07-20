// ==========================================================================
// SolidW — Dashboard Opening Hours Logic
// ==========================================================================
// Renders one row per day_of_week (0=Sunday .. 6=Saturday) and upserts the
// whole set for the selected business on save (opening_hours has a unique
// constraint on (business_id, day_of_week)).
// ==========================================================================

import { requireAuth, signOut } from "/assets/js/authGuard.js";
import { supabase } from "/assets/js/supabaseClient.js";
import { showToast } from "/assets/js/toast.js";

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const signOutBtn = document.getElementById("signOutBtn");
const businessSelect = document.getElementById("businessSelect");
const noBusinessState = document.getElementById("noBusinessState");
const hoursContent = document.getElementById("hoursContent");
const hoursTable = document.getElementById("hoursTable");
const saveHoursBtn = document.getElementById("saveHoursBtn");
const saveHoursLabel = document.getElementById("saveHoursLabel");

let currentUser = null;
let myBusinesses = [];
let selectedBusinessId = null;
let hoursByDay = {}; // { [day_of_week]: { open_time, close_time, closed } }

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
    hoursContent.style.display = "none";
    return;
  }

  noBusinessState.style.display = "none";
  hoursContent.style.display = "block";

  businessSelect.innerHTML = myBusinesses
    .map((b) => `<option value="${b.id}">${escapeHtml(b.name)}</option>`)
    .join("");

  const stored = localStorage.getItem("solidw_selected_business");
  selectedBusinessId = myBusinesses.find((b) => b.id === stored)?.id || myBusinesses[0].id;
  businessSelect.value = selectedBusinessId;

  businessSelect.addEventListener("change", () => {
    selectedBusinessId = businessSelect.value;
    localStorage.setItem("solidw_selected_business", selectedBusinessId);
    loadHours();
  });

  await loadHours();
}

async function loadHours() {
  const { data, error } = await supabase
    .from("opening_hours")
    .select("day_of_week, open_time, close_time, closed")
    .eq("business_id", selectedBusinessId);

  if (error) {
    showToast("Could not load opening hours.", "error");
    return;
  }

  hoursByDay = {};
  for (let d = 0; d < 7; d++) {
    hoursByDay[d] = { open_time: "09:00", close_time: "17:00", closed: false };
  }
  for (const row of data || []) {
    hoursByDay[row.day_of_week] = {
      open_time: row.open_time ? row.open_time.slice(0, 5) : "09:00",
      close_time: row.close_time ? row.close_time.slice(0, 5) : "17:00",
      closed: row.closed,
    };
  }

  renderTable();
}

function renderTable() {
  hoursTable.innerHTML = "";

  for (let d = 0; d < 7; d++) {
    const day = hoursByDay[d];
    const row = document.createElement("div");
    row.className = "hours-row";
    row.dataset.day = d;
    row.innerHTML = `
      <span class="hours-day-label">${DAY_LABELS[d]}</span>
      <input type="time" class="hours-open" value="${day.open_time}" ${day.closed ? "disabled" : ""} />
      <input type="time" class="hours-close" value="${day.close_time}" ${day.closed ? "disabled" : ""} />
      <label class="hours-closed-toggle">
        <input type="checkbox" class="hours-closed" ${day.closed ? "checked" : ""} />
        Closed
      </label>
    `;
    hoursTable.appendChild(row);

    const closedCheckbox = row.querySelector(".hours-closed");
    const openInput = row.querySelector(".hours-open");
    const closeInput = row.querySelector(".hours-close");

    closedCheckbox.addEventListener("change", () => {
      openInput.disabled = closedCheckbox.checked;
      closeInput.disabled = closedCheckbox.checked;
    });
  }
}

saveHoursBtn.addEventListener("click", async () => {
  saveHoursBtn.disabled = true;
  saveHoursLabel.innerHTML = '<span class="spinner"></span> Saving…';

  const rows = [];
  hoursTable.querySelectorAll(".hours-row").forEach((rowEl) => {
    const day = parseInt(rowEl.dataset.day, 10);
    const closed = rowEl.querySelector(".hours-closed").checked;
    const openTime = rowEl.querySelector(".hours-open").value || "09:00";
    const closeTime = rowEl.querySelector(".hours-close").value || "17:00";

    rows.push({
      business_id: selectedBusinessId,
      day_of_week: day,
      open_time: closed ? null : openTime,
      close_time: closed ? null : closeTime,
      closed,
    });
  });

  const { error } = await supabase
    .from("opening_hours")
    .upsert(rows, { onConflict: "business_id,day_of_week" });

  saveHoursBtn.disabled = false;
  saveHoursLabel.textContent = "Save Hours";

  if (error) {
    showToast(error.message || "Could not save opening hours.", "error");
    return;
  }

  showToast("Opening hours saved.", "success");
});

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

init();
