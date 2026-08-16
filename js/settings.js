// Gestión de ajustes: claves de API guardadas SOLO en localStorage del navegador.
// Nunca se envían a ningún sitio salvo directamente a Google (YouTube y Gemini).

const KEYS = {
  yt: "yta.ytApiKey",
  gemini: "yta.geminiApiKey",
  model: "yta.model",
  proxy: "yta.corsProxy",
};

export const DEFAULT_PROXY = "https://api.allorigins.win/raw?url=";
export const DEFAULT_MODEL = "gemini-2.5-flash";

export function getSettings() {
  return {
    ytApiKey: localStorage.getItem(KEYS.yt) || "",
    geminiApiKey: localStorage.getItem(KEYS.gemini) || "",
    model: localStorage.getItem(KEYS.model) || DEFAULT_MODEL,
    corsProxy: localStorage.getItem(KEYS.proxy) || DEFAULT_PROXY,
  };
}

export function saveSettings({ ytApiKey, geminiApiKey, model, corsProxy }) {
  localStorage.setItem(KEYS.yt, ytApiKey?.trim() || "");
  localStorage.setItem(KEYS.gemini, geminiApiKey?.trim() || "");
  localStorage.setItem(KEYS.model, model || DEFAULT_MODEL);
  localStorage.setItem(KEYS.proxy, corsProxy?.trim() || DEFAULT_PROXY);
}

export function hasYouTubeKey() {
  return !!getSettings().ytApiKey;
}

export function hasGeminiKey() {
  return !!getSettings().geminiApiKey;
}

export function initSettingsDialog({ onSaved } = {}) {
  const dialog = document.getElementById("settings-dialog");
  const form = document.getElementById("settings-form");
  const ytInput = document.getElementById("yt-key-input");
  const geminiInput = document.getElementById("gemini-key-input");
  const modelSelect = document.getElementById("model-select");
  const proxyInput = document.getElementById("proxy-input");
  const openBtn = document.getElementById("settings-btn");
  const cancelBtn = document.getElementById("settings-cancel");

  function fillFromStorage() {
    const s = getSettings();
    ytInput.value = s.ytApiKey;
    geminiInput.value = s.geminiApiKey;
    modelSelect.value = s.model;
    proxyInput.value = s.corsProxy;
  }

  openBtn.addEventListener("click", () => {
    fillFromStorage();
    dialog.showModal();
  });

  cancelBtn.addEventListener("click", () => dialog.close());

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    saveSettings({
      ytApiKey: ytInput.value,
      geminiApiKey: geminiInput.value,
      model: modelSelect.value,
      corsProxy: proxyInput.value,
    });
    dialog.close();
    onSaved?.(getSettings());
  });

  return {
    open: () => {
      fillFromStorage();
      dialog.showModal();
    },
  };
}
