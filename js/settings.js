// Gestión de ajustes: claves de API guardadas SOLO en localStorage del navegador.
// Nunca se envían a ningún sitio salvo directamente a Google / Anthropic.

const KEYS = {
  yt: "yta.ytApiKey",
  anthropic: "yta.anthropicApiKey",
  model: "yta.model",
  proxy: "yta.corsProxy",
};

export const DEFAULT_PROXY = "https://api.allorigins.win/raw?url=";
export const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

export function getSettings() {
  return {
    ytApiKey: localStorage.getItem(KEYS.yt) || "",
    anthropicApiKey: localStorage.getItem(KEYS.anthropic) || "",
    model: localStorage.getItem(KEYS.model) || DEFAULT_MODEL,
    corsProxy: localStorage.getItem(KEYS.proxy) || DEFAULT_PROXY,
  };
}

export function saveSettings({ ytApiKey, anthropicApiKey, model, corsProxy }) {
  localStorage.setItem(KEYS.yt, ytApiKey?.trim() || "");
  localStorage.setItem(KEYS.anthropic, anthropicApiKey?.trim() || "");
  localStorage.setItem(KEYS.model, model || DEFAULT_MODEL);
  localStorage.setItem(KEYS.proxy, corsProxy?.trim() || DEFAULT_PROXY);
}

export function hasYouTubeKey() {
  return !!getSettings().ytApiKey;
}

export function hasAnthropicKey() {
  return !!getSettings().anthropicApiKey;
}

export function initSettingsDialog({ onSaved } = {}) {
  const dialog = document.getElementById("settings-dialog");
  const form = document.getElementById("settings-form");
  const ytInput = document.getElementById("yt-key-input");
  const anthropicInput = document.getElementById("anthropic-key-input");
  const modelSelect = document.getElementById("model-select");
  const proxyInput = document.getElementById("proxy-input");
  const openBtn = document.getElementById("settings-btn");
  const cancelBtn = document.getElementById("settings-cancel");

  function fillFromStorage() {
    const s = getSettings();
    ytInput.value = s.ytApiKey;
    anthropicInput.value = s.anthropicApiKey;
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
      anthropicApiKey: anthropicInput.value,
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
