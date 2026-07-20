// ==========================================================================
// SolidW — Reset Password Page Logic
// ==========================================================================
// Two-phase page:
//  Phase 1 (default): user requests a reset email.
//  Phase 2 (auto-detected): user arrives via the emailed link, which
//  Supabase turns into a PASSWORD_RECOVERY auth event — we swap the UI to
//  the "set new password" form.
// ==========================================================================

import { supabase } from "/assets/js/supabaseClient.js";

const requestStep = document.getElementById("requestStep");
const updateStep = document.getElementById("updateStep");

const requestForm = document.getElementById("requestForm");
const requestError = document.getElementById("requestError");
const requestSuccess = document.getElementById("requestSuccess");
const requestBtn = document.getElementById("requestBtn");
const requestLabel = document.getElementById("requestLabel");

const updateForm = document.getElementById("updateForm");
const updateError = document.getElementById("updateError");
const updateBtn = document.getElementById("updateBtn");
const updateLabel = document.getElementById("updateLabel");

// Listen for the recovery event Supabase fires after the user clicks the
// emailed link (it lands back on this same page with a token in the URL).
supabase.auth.onAuthStateChange((event) => {
  if (event === "PASSWORD_RECOVERY") {
    requestStep.style.display = "none";
    updateStep.style.display = "block";
  }
});

requestForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  requestError.style.display = "none";
  requestSuccess.style.display = "none";

  const email = document.getElementById("email").value.trim();
  if (!email) {
    requestError.textContent = "Please enter your email.";
    requestError.style.display = "block";
    return;
  }

  requestBtn.disabled = true;
  requestLabel.innerHTML = '<span class="spinner"></span> Sending…';

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password/index.html`,
  });

  requestBtn.disabled = false;
  requestLabel.textContent = "Send Reset Link";

  if (error) {
    requestError.textContent = error.message || "Could not send reset email.";
    requestError.style.display = "block";
    return;
  }

  requestSuccess.textContent = "If an account exists for that email, a reset link has been sent.";
  requestSuccess.style.display = "block";
  requestForm.reset();
});

updateForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  updateError.style.display = "none";

  const newPassword = document.getElementById("newPassword").value;
  const confirmNewPassword = document.getElementById("confirmNewPassword").value;

  if (newPassword.length < 8) {
    updateError.textContent = "Password must be at least 8 characters.";
    updateError.style.display = "block";
    return;
  }

  if (newPassword !== confirmNewPassword) {
    updateError.textContent = "Passwords do not match.";
    updateError.style.display = "block";
    return;
  }

  updateBtn.disabled = true;
  updateLabel.innerHTML = '<span class="spinner"></span> Updating…';

  const { error } = await supabase.auth.updateUser({ password: newPassword });

  updateBtn.disabled = false;
  updateLabel.textContent = "Update Password";

  if (error) {
    updateError.textContent = error.message || "Could not update password.";
    updateError.style.display = "block";
    return;
  }

  window.location.replace("/auth/login/index.html");
});