// ==========================================================================
// SolidW — Register Page Logic
// ==========================================================================

import { supabase } from "/assets/js/supabaseClient.js";
import { redirectIfLoggedIn } from "/assets/js/authGuard.js";

console.log("REGISTER JS LOADED");
alert("REGISTER JS LOADED");

// If already logged in, bounce straight to the right dashboard.
redirectIfLoggedIn();

const form = document.getElementById("registerForm");
const errorBanner = document.getElementById("errorBanner");
const successBanner = document.getElementById("successBanner");
const submitBtn = document.getElementById("submitBtn");
const submitLabel = document.getElementById("submitLabel");

function showError(message) {
  errorBanner.textContent = message;
  errorBanner.style.display = "block";
  successBanner.style.display = "none";
}

function showSuccess(message) {
  successBanner.textContent = message;
  successBanner.style.display = "block";
  errorBanner.style.display = "none";
}

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitLabel.innerHTML = isLoading
    ? '<span class="spinner"></span> Creating account…'
    : "Create Account";
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorBanner.style.display = "none";
  successBanner.style.display = "none";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  if (!email || !password) {
    showError("Please fill in all fields.");
    return;
  }

  if (password.length < 8) {
    showError("Password must be at least 8 characters.");
    return;
  }

  if (password !== confirmPassword) {
    showError("Passwords do not match.");
    return;
  }

  setLoading(true);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/login/index.html`,
    },
  });

  setLoading(false);

  if (error) {
    showError(error.message || "Could not create account. Please try again.");
    return;
  }

  // If email confirmation is required, session will be null even on success.
  if (data?.session) {
    window.location.replace("/dashboard/index.html");
  } else {
    showSuccess("Account created! Please check your email to confirm before logging in.");
    form.reset();
  }
});
