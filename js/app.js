import { initSettingsDialog, getSettings } from "./settings.js";
import { searchVideos, formatDuration, YouTubeApiError } from "./youtube.js";
import { fetchTranscript, cuesToTimestampedText } from "./transcript.js";
import { summarizeVideo, SummarizeError } from "./summarize.js";
import { initSplit } from "./split.js";
import { mountPlayer, seekTo, destroyPlayer } from "./player.js";

// ---------- DOM refs ----------
const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const resultsView = document.getElementById("results-view");
const resultsGrid = document.getElementById("results-grid");
const resultsHint = document.getElementById("results-hint");
const resultsStatus = document.getElementById("results-status");

const videoView = document.getElementById("video-view");
const backBtn = document.getElementById("back-btn");
const videoTitleEl = document.getElementById("video-title");
const splitContainer = document.getElementById("split-container");
const divider = document.getElementById("divider");
const summaryText = document.getElementById("summary-text");
const chaptersList = document.getElementById("chapters-list");
const analysisStatus = document.getElementById("analysis-status");

// ---------- helpers ----------
function setStatus(el, text, { error = false, hidden = false } = {}) {
  el.textContent = text;
  el.hidden = hidden || !text;
  el.classList.toggle("error", !!error);
}

function formatTimestamp(totalSeconds) {
  return formatDuration(Math.max(0, Math.floor(totalSeconds || 0)));
}

function analysisCacheKey(videoId) {
  return `yta.analysis.${videoId}`;
}
function loadAnalysisCache(videoId) {
  try {
    return JSON.parse(localStorage.getItem(analysisCacheKey(videoId)));
  } catch {
    return null;
  }
}
function saveAnalysisCache(videoId, data) {
  localStorage.setItem(analysisCacheKey(videoId), JSON.stringify(data));
}

// ---------- settings dialog ----------
initSettingsDialog();

// ---------- split panel ----------
initSplit({ container: splitContainer, divider });

// ---------- search ----------
searchForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const query = searchInput.value.trim();
  if (!query) return;

  const { ytApiKey } = getSettings();
  if (!ytApiKey) {
    setStatus(resultsStatus, "Falta la clave de la YouTube Data API. Ábrela desde Ajustes ⚙️.", { error: true });
    document.getElementById("settings-btn").click();
    return;
  }

  resultsHint.hidden = true;
  resultsGrid.innerHTML = "";
  setStatus(resultsStatus, "Buscando…");

  try {
    const results = await searchVideos(query, ytApiKey);
    if (results.length === 0) {
      setStatus(resultsStatus, "Sin resultados para esa búsqueda.");
      return;
    }
    setStatus(resultsStatus, "", { hidden: true });
    renderResults(results);
  } catch (err) {
    const msg = err instanceof YouTubeApiError ? err.message : "Error al buscar en YouTube.";
    setStatus(resultsStatus, msg, { error: true });
    console.error(err);
  }
});

function renderResults(videos) {
  resultsGrid.innerHTML = "";
  for (const video of videos) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "result-card";
    card.innerHTML = `
      <img src="${video.thumbnail}" alt="" loading="lazy" />
      <div class="card-body">
        <p class="card-title">${escapeHtml(video.title)}</p>
        <p class="card-meta">${escapeHtml(video.channelTitle)} · ${formatDuration(video.durationSeconds)}</p>
      </div>
    `;
    card.addEventListener("click", () => openVideo(video));
    resultsGrid.appendChild(card);
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

// ---------- video view ----------
backBtn.addEventListener("click", () => {
  destroyPlayer();
  videoView.hidden = true;
  resultsView.hidden = false;
});

async function openVideo(video) {
  resultsView.hidden = true;
  videoView.hidden = false;
  videoTitleEl.textContent = video.title;

  summaryText.textContent = "Cargando…";
  chaptersList.innerHTML = "";
  setStatus(analysisStatus, "", { hidden: true });

  await mountPlayer(document.getElementById("player-wrap"), video.id);

  const cached = loadAnalysisCache(video.id);
  if (cached) {
    renderAnalysis(cached);
    setStatus(analysisStatus, "Mostrando análisis guardado.", {});
    addRefreshButton(video);
    return;
  }

  await runAnalysis(video);
}

function addRefreshButton(video) {
  clearRefreshButton();
  const btn = document.createElement("button");
  btn.textContent = "↻ Regenerar análisis";
  btn.className = "refresh-analysis";
  btn.style.marginTop = "6px";
  btn.addEventListener("click", () => runAnalysis(video));
  analysisStatus.after(btn);
}

async function runAnalysis(video) {
  const { corsProxy, anthropicApiKey, model } = getSettings();

  summaryText.textContent = "Buscando transcripción…";
  chaptersList.innerHTML = "";
  setStatus(analysisStatus, "", { hidden: true });
  clearRefreshButton();

  let transcript;
  try {
    transcript = await fetchTranscript(video.id, corsProxy);
  } catch (err) {
    console.error(err);
    summaryText.textContent = "No se pudo comprobar si el vídeo tiene subtítulos.";
    setStatus(
      analysisStatus,
      "Fallo al leer la página del vídeo (puede que el proxy CORS esté caído). Prueba a cambiarlo en Ajustes ⚙️.",
      { error: true }
    );
    return;
  }

  if (!transcript) {
    summaryText.textContent = "Este vídeo no tiene subtítulos/transcripción disponibles en YouTube.";
    setStatus(
      analysisStatus,
      "Sin transcripción → no se puede generar resumen ni capítulos todavía. " +
        "(Transcribir el audio automáticamente para vídeos sin subtítulos requeriría un servicio de " +
        "reconocimiento de voz en un backend — pendiente como mejora futura.)",
      {}
    );
    return;
  }

  if (!anthropicApiKey) {
    summaryText.textContent = `Transcripción encontrada (${transcript.languageCode}${transcript.isAutoGenerated ? ", automática" : ""}).`;
    setStatus(analysisStatus, "Falta la clave de la API de Anthropic para generar el resumen. Ábrela desde Ajustes ⚙️.", {
      error: true,
    });
    return;
  }

  summaryText.textContent = "Generando resumen y capítulos con IA…";

  try {
    const transcriptText = cuesToTimestampedText(transcript.cues);
    const analysis = await summarizeVideo({
      apiKey: anthropicApiKey,
      model,
      title: video.title,
      description: video.description,
      transcriptText,
    });
    saveAnalysisCache(video.id, analysis);
    renderAnalysis(analysis);
    setStatus(analysisStatus, "", { hidden: true });
    addRefreshButton(video);
  } catch (err) {
    console.error(err);
    const msg = err instanceof SummarizeError ? err.message : "Error generando el análisis.";
    summaryText.textContent = "No se pudo generar el resumen.";
    setStatus(analysisStatus, msg, { error: true });
  }
}

function clearRefreshButton() {
  document.querySelectorAll("button.refresh-analysis").forEach((b) => b.remove());
}

function renderAnalysis({ summary, chapters }) {
  summaryText.textContent = summary || "(sin resumen)";
  chaptersList.innerHTML = "";

  for (const chapter of chapters || []) {
    const item = document.createElement("li");
    const details = document.createElement("details");
    details.className = "chapter-item";

    const summaryEl = document.createElement("summary");
    summaryEl.innerHTML = `
      <span class="chevron">▶</span>
      <button type="button" class="chapter-time">${formatTimestamp(chapter.start)}</button>
      <span class="chapter-title">${escapeHtml(chapter.title)}</span>
    `;

    const body = document.createElement("p");
    body.className = "chapter-summary";
    body.textContent = chapter.summary || "";

    details.appendChild(summaryEl);
    details.appendChild(body);
    item.appendChild(details);
    chaptersList.appendChild(item);

    summaryEl.querySelector(".chapter-time").addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      seekTo(chapter.start);
    });
  }
}
