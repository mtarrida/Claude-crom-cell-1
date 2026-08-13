// Panel divisor arrastrable: coloca el vídeo arriba (columna) o a la
// izquierda (fila) según la relación de aspecto del contenedor, y permite
// arrastrar el divisor (ratón, táctil o teclado) para redimensionar.

const STORAGE_KEY = "yta.videoSizePct";
const MIN_PCT = 15;
const MAX_PCT = 75;
const DEFAULT_PCT = 38;

export function initSplit({ container, divider }) {
  let landscape = false;
  let dragging = false;

  function applyOrientation() {
    const rect = container.getBoundingClientRect();
    landscape = rect.width > rect.height * 1.15;
    container.classList.toggle("landscape", landscape);
    divider.setAttribute("aria-orientation", landscape ? "vertical" : "horizontal");
  }

  function currentPct() {
    const raw = getComputedStyle(container).getPropertyValue("--video-size").trim();
    const n = parseFloat(raw);
    return Number.isNaN(n) ? DEFAULT_PCT : n;
  }

  function setPct(pct, { persist = false } = {}) {
    const clamped = Math.min(MAX_PCT, Math.max(MIN_PCT, pct));
    container.style.setProperty("--video-size", `${clamped}%`);
    if (persist) localStorage.setItem(STORAGE_KEY, String(clamped));
  }

  const saved = parseFloat(localStorage.getItem(STORAGE_KEY));
  setPct(Number.isNaN(saved) ? DEFAULT_PCT : saved);

  const ro = new ResizeObserver(applyOrientation);
  ro.observe(container);
  applyOrientation();

  function pctFromPointer(e) {
    const rect = container.getBoundingClientRect();
    return landscape
      ? ((e.clientX - rect.left) / rect.width) * 100
      : ((e.clientY - rect.top) / rect.height) * 100;
  }

  divider.addEventListener("pointerdown", (e) => {
    dragging = true;
    divider.setPointerCapture(e.pointerId);
  });

  divider.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    setPct(pctFromPointer(e));
  });

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    setPct(currentPct(), { persist: true });
  }
  divider.addEventListener("pointerup", endDrag);
  divider.addEventListener("pointercancel", endDrag);

  divider.addEventListener("keydown", (e) => {
    const step = 4;
    if (["ArrowUp", "ArrowLeft"].includes(e.key)) {
      setPct(currentPct() - step, { persist: true });
      e.preventDefault();
    } else if (["ArrowDown", "ArrowRight"].includes(e.key)) {
      setPct(currentPct() + step, { persist: true });
      e.preventDefault();
    }
  });

  return { destroy: () => ro.disconnect() };
}
