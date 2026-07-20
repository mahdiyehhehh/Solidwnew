// ==========================================================================
// SolidW — Toast Notifications
// ==========================================================================
// Reusable notification component. Backs the .solidw-toast* classes defined
// in assets/css/components.css. Import and call showToast() from any page;
// the container is created lazily on first use so pages that never show a
// toast pay zero cost.
//
// Usage:
//
//   import { showToast } from "/assets/js/toast.js";
//   showToast("Saved successfully.", "success");
//   showToast("Could not save changes.", "error");
// ==========================================================================

const CONTAINER_ID = "solidwToastContainer";
const DEFAULT_DURATION = 3500;

function getContainer() {
  let container = document.getElementById(CONTAINER_ID);
  if (!container) {
    container = document.createElement("div");
    container.id = CONTAINER_ID;
    container.className = "solidw-toast-container";
    document.body.appendChild(container);
  }
  return container;
}

// type: "info" (default) | "success" | "warning" | "error"
export function showToast(message, type = "info", duration = DEFAULT_DURATION) {
  const container = getContainer();

  const toast = document.createElement("div");
  toast.className = `solidw-toast solidw-toast--${type}`;
  toast.textContent = message;
  toast.addEventListener("click", () => dismiss(toast));

  container.appendChild(toast);

  // Force a reflow so the transition fires, then reveal.
  requestAnimationFrame(() => {
    toast.classList.add("solidw-toast--visible");
  });

  const timer = setTimeout(() => dismiss(toast), duration);
  toast.dataset.timer = timer;

  return toast;
}

function dismiss(toast) {
  if (!toast || !toast.isConnected) return;
  clearTimeout(toast.dataset.timer);
  toast.classList.remove("solidw-toast--visible");
  toast.addEventListener(
    "transitionend",
    () => toast.remove(),
    { once: true }
  );
}
