(function () {
  "use strict";

  var parameter = "aiman_theme";
  var storageKey = "aiman.auth.theme";

  function isTheme(value) {
    return value === "light" || value === "dark";
  }

  function storageUnavailable(error) {
    return error instanceof DOMException &&
      (error.name === "SecurityError" || error.name === "QuotaExceededError");
  }

  var values = new URLSearchParams(window.location.search).getAll(parameter);
  var theme = values.length === 1 && isTheme(values[0]) ? values[0] : null;
  if (values.length && !theme) {
    console.warn("[AIMAN theme] Ignoring invalid appearance preference.");
  }

  if (!theme) {
    try {
      var saved = window.sessionStorage.getItem(storageKey);
      if (isTheme(saved)) theme = saved;
    } catch (error) {
      if (!storageUnavailable(error)) throw error;
      console.warn("[AIMAN theme] Tab appearance storage is unavailable.");
    }
  }

  // This is the only DOM change. B2C retains ownership of every form control.
  document.documentElement.setAttribute("data-aiman-theme", theme || "dark");

  if (values.length === 1 && isTheme(values[0])) {
    try {
      window.sessionStorage.setItem(storageKey, values[0]);
    } catch (error) {
      if (!storageUnavailable(error)) throw error;
      console.warn("[AIMAN theme] Appearance cannot persist across pages in this tab.");
    }
  }
}());
