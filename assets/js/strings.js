// ==========================================================================
// SolidW — Strings / i18n
// ==========================================================================
// All user-facing text lives here instead of being hardcoded into pages.
// Today there is only one dictionary (English). Adding a new language later
// means adding a new key to `dictionaries` below and calling setLocale() —
// no page markup or logic needs to change, since pages only ever call t().
//
// Usage in any page:
//
//   import { t } from "/assets/js/strings.js";
//   el.textContent = t("nav.dashboard");
//
// For strings with variables:
//
//   t("greeting.hello", { name: "Sam" })  →  "Hello, Sam"
// ==========================================================================

import { DEFAULT_LOCALE } from "./config.js";

const dictionaries = {
  en: {
    // Navigation
    "nav.dashboard": "Dashboard",
    "nav.business": "Business",
    "nav.gallery": "Gallery",
    "nav.services": "Services",
    "nav.hours": "Opening Hours",
    "nav.reservations": "Reservations",
    "nav.qrcode": "QR Code",
    "nav.settings": "Settings",
    "nav.signout": "Sign Out",

    // Auth
    "auth.login": "Log In",
    "auth.register": "Create Account",
    "auth.email": "Email",
    "auth.password": "Password",
    "auth.forgotPassword": "Forgot password?",
    "auth.noAccount": "Don't have an account?",
    "auth.haveAccount": "Already have an account?",

    // Plans
    "plan.free": "Free",
    "plan.pro": "Pro",
    "plan.upgrade": "Upgrade to Pro",

    // Business fields
    "business.name": "Business Name",
    "business.category": "Category",
    "business.description": "Description",
    "business.address": "Address",
    "business.phone": "Phone",
    "business.whatsapp": "WhatsApp",
    "business.telegram": "Telegram",
    "business.website": "Website",
    "business.timezone": "Time Zone",
    "business.acceptingBookings": "Accepting Bookings",

    // Reservation form
    "reservation.name": "Your Name",
    "reservation.phone": "Phone Number",
    "reservation.date": "Date",
    "reservation.time": "Time",
    "reservation.notes": "Notes",
    "reservation.submit": "Book Now",
    "reservation.success": "Your reservation request has been sent!",

    // Generic
    "action.save": "Save",
    "action.cancel": "Cancel",
    "action.delete": "Delete",
    "action.upload": "Upload",
    "error.generic": "Something went wrong. Please try again.",
  },
};

let currentLocale = DEFAULT_LOCALE;

// Switch active language. Falls back to "en" if the locale isn't defined.
export function setLocale(locale) {
  currentLocale = dictionaries[locale] ? locale : "en";
}

export function getLocale() {
  return currentLocale;
}

// Translate a key, optionally interpolating {placeholders}.
export function t(key, vars) {
  const dict = dictionaries[currentLocale] || dictionaries.en;
  let str = dict[key] ?? dictionaries.en[key] ?? key;

  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replaceAll(`{${k}}`, v);
    }
  }

  return str;
}