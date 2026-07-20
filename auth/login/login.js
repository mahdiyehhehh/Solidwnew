// ==========================================================================
// SolidW — Login Page Logic
// ==========================================================================

import { supabase } from "/assets/js/supabaseClient.js";
import { redirectIfLoggedIn } from "/assets/js/authGuard.js";
import { ADMIN_EMAIL } from "/assets/js/config.js";

redirectIfLoggedIn();

const form = document.getElementById("loginForm");
const errorBanner = document.getElementById("errorBanner");
const submitBtn = document.getElementById("submitBtn");
const submitLabel = document.getElementById("submitLabel");

function showError(message) {
  errorBanner.textContent = message;
  errorBanner.style.display = "block";
}

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitLabel.innerHTML = isLoading
    ? '<span class="spinner"></span> Logging in…'
    : "Log In";
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorBanner.style.display = "none";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!email || !password) {
    showError("Please enter your email and password.");
    return;
  }

  setLoading(true);

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  setLoading(false);

  if (error) {
    showError(error.message || "Invalid email or password.");
    return;
  }

  const user = data?.user;
  if (user?.email === ADMIN_EMAIL) {
    window.location.replace("/admin/index.html");
  } else {
    window.location.replace("/dashboard/index.html");
  }
});