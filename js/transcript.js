// Obtiene la transcripción (subtítulos) pública de un vídeo de YouTube.
//
// YouTube no expone esto como una API oficial ni permite leerlo con CORS
// directo desde un dominio ajeno, así que:
//   1. Intentamos leer la página del vídeo directamente.
//   2. Si el navegador bloquea la petición por CORS, reintentamos a través
//      de un proxy CORS configurable (ver ajustes ⚙️).
// Si el vídeo no tiene ningún subtítulo (ni siquiera autogenerado), no hay
// forma de transcribirlo sin descargar y procesar el audio en un backend
// (p. ej. con Whisper) — eso queda fuera de este front-end estático y se
// documenta como mejora futura en el README.
//
// Dos formas de obtener la lista de subtítulos, se prueban en orden:
//   A. El endpoint "timedtext?type=list" (video.google.com) — más ligero,
//      y al vivir en otro dominio que youtube.com evita casi siempre la
//      página de aviso de cookies/consentimiento. OJO: este endpoint suele
//      NO listar pistas autogeneradas (asr), solo manuales.
//   B. Rastrear el HTML de la página del vídeo en busca de "captionTracks"
//      (método clásico, incluye pistas autogeneradas, pero más frágil).
//
// Si ninguno de los dos encuentra nada, se lanza un error con el detalle de
// qué falló en cada paso — mejor eso que decir "sin subtítulos" cuando en
// realidad el fallo es de scraping/proxy y el vídeo sí los tiene.

function decodeHtmlEntities(str) {
  const el = document.createElement("textarea");
  el.innerHTML = str;
  return el.value;
}

async function fetchText(url, corsProxy) {
  try {
    const res = await fetch(url);
    if (res.ok) return await res.text();
  } catch {
    /* probablemente CORS: seguimos con el proxy */
  }
  const proxied = corsProxy + encodeURIComponent(url);
  const res = await fetch(proxied);
  if (!res.ok) throw new Error(`No se pudo obtener ${url} (status ${res.status})`);
  return res.text();
}

function extractJsonArrayAfter(html, marker) {
  const idx = html.indexOf(marker);
  if (idx === -1) return null;
  const start = idx + marker.length;
  if (html[start] !== "[") return null;
  let depth = 0;
  let i = start;
  for (; i < html.length; i++) {
    const ch = html[i];
    if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) {
        i++;
        break;
      }
    }
  }
  try {
    return JSON.parse(html.slice(start, i));
  } catch {
    return null;
  }
}

function pickBestTrack(tracks, preferredLang) {
  if (!tracks?.length) return null;
  const byLang = (lang) =>
    tracks.find((t) => t.languageCode?.toLowerCase().startsWith(lang));

  const manual = tracks.filter((t) => t.kind !== "asr");
  return (
    (preferredLang && byLang(preferredLang.slice(0, 2))) ||
    manual.find((t) => t.languageCode?.startsWith("es")) ||
    manual.find((t) => t.languageCode?.startsWith("en")) ||
    manual[0] ||
    tracks.find((t) => t.languageCode?.startsWith("es")) ||
    tracks.find((t) => t.languageCode?.startsWith("en")) ||
    tracks[0]
  );
}

function parseTimedTextXml(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, "text/xml");
  const nodes = Array.from(doc.getElementsByTagName("text"));
  return nodes
    .map((node) => ({
      start: parseFloat(node.getAttribute("start") || "0"),
      duration: parseFloat(node.getAttribute("dur") || "0"),
      text: decodeHtmlEntities(node.textContent || "").replace(/\s+/g, " ").trim(),
    }))
    .filter((c) => c.text);
}

function parseTrackListXml(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, "text/xml");
  return Array.from(doc.getElementsByTagName("track")).map((node) => ({
    languageCode: node.getAttribute("lang_code") || "",
    name: node.getAttribute("name") || "",
    kind: node.getAttribute("kind") || "",
  }));
}

// Método A: endpoint ligero de listado de subtítulos.
async function fetchViaTrackListEndpoint(videoId, corsProxy, preferredLang, notes) {
  const listUrl = `https://video.google.com/timedtext?type=list&v=${videoId}`;
  const listXml = await fetchText(listUrl, corsProxy);

  const tracks = parseTrackListXml(listXml);
  if (tracks.length === 0) {
    notes.push("Método A: la lista de pistas vino vacía (habitual si el vídeo solo tiene subtítulos automáticos).");
    return null;
  }

  const track = pickBestTrack(tracks, preferredLang);
  if (!track) {
    notes.push(`Método A: ${tracks.length} pista(s) listada(s) pero no se pudo elegir ninguna.`);
    return null;
  }

  const params = new URLSearchParams({ v: videoId, lang: track.languageCode });
  if (track.name) params.set("name", track.name);
  if (track.kind) params.set("kind", track.kind);
  const capUrl = `https://video.google.com/timedtext?${params.toString()}`;

  const xml = await fetchText(capUrl, corsProxy);
  const cues = parseTimedTextXml(xml);
  if (cues.length === 0) {
    notes.push(`Método A: pista '${track.languageCode}' encontrada pero sin cues al descargarla.`);
    return null;
  }

  return { cues, languageCode: track.languageCode || "?", isAutoGenerated: track.kind === "asr" };
}

// Método B (fallback): rastrear la página del vídeo en busca de "captionTracks".
// @returns {{result: object|null, confirmedNoCaptions: boolean}}
async function fetchViaWatchPage(videoId, corsProxy, preferredLang, notes) {
  // &gl=US intenta evitar que YouTube devuelva la interstitial de
  // consentimiento de cookies (frecuente en IPs europeas al pedir la
  // página sin cookies de sesión, como pasa aquí al ir vía proxy CORS).
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}&hl=en&gl=US`;
  const html = await fetchText(watchUrl, corsProxy);

  const tracks = extractJsonArrayAfter(html, '"captionTracks":');
  if (!tracks) {
    if (html.includes("consent.youtube.com")) {
      throw new Error(
        "YouTube ha devuelto una página de aviso de cookies en vez del vídeo (típico al leerlo sin sesión de navegador desde IPs europeas). Prueba a regenerar el análisis, o cambia el proxy CORS en Ajustes ⚙️."
      );
    }
    notes.push(
      `Método B: no se encontró "captionTracks" en el HTML de la página (${html.length} caracteres recibidos).`
    );
    return { result: null, confirmedNoCaptions: false };
  }
  if (tracks.length === 0) {
    // captionTracks SÍ apareció en la página, y explícitamente como lista
    // vacía: esta es la única señal fiable de "el vídeo no tiene subtítulos".
    notes.push("Método B: captionTracks está presente pero vacío (el vídeo no declara subtítulos).");
    return { result: null, confirmedNoCaptions: true };
  }

  const track = pickBestTrack(tracks, preferredLang);
  if (!track?.baseUrl) {
    notes.push(`Método B: ${tracks.length} pista(s) en captionTracks pero sin baseUrl utilizable.`);
    return { result: null, confirmedNoCaptions: false };
  }

  // baseUrl viene como URL absoluta a www.youtube.com/api/timedtext
  const xml = await fetchText(track.baseUrl, corsProxy);
  const cues = parseTimedTextXml(xml);
  if (cues.length === 0) {
    notes.push(`Método B: pista '${track.languageCode}' encontrada pero sin cues al descargarla.`);
    return { result: null, confirmedNoCaptions: false };
  }

  return {
    result: { cues, languageCode: track.languageCode || "?", isAutoGenerated: track.kind === "asr" },
    confirmedNoCaptions: false,
  };
}

/**
 * @returns {Promise<{cues: {start:number, duration:number, text:string}[], languageCode: string, isAutoGenerated: boolean} | null>}
 *   null solo cuando se confirma positivamente que el vídeo no declara
 *   ninguna pista de subtítulos. Si algo falla de forma ambigua (proxy
 *   caído, scraping roto, etc.) lanza un error con el detalle, para no
 *   confundirlo con "sin subtítulos" cuando el vídeo sí los tiene.
 */
export async function fetchTranscript(videoId, corsProxy) {
  const notes = [];

  try {
    const viaList = await fetchViaTrackListEndpoint(videoId, corsProxy, navigator.language, notes);
    if (viaList) return viaList;
  } catch (err) {
    notes.push(`Método A falló: ${err.message}`);
  }

  const { result, confirmedNoCaptions } = await fetchViaWatchPage(videoId, corsProxy, navigator.language, notes);
  if (result) return result;
  if (confirmedNoCaptions) return null;

  throw new Error(`No se pudo extraer la transcripción por ninguna vía. Detalle: ${notes.join(" | ")}`);
}

export function cuesToTimestampedText(cues, { maxChars = 18000 } = {}) {
  const lines = [];
  let total = 0;
  for (const cue of cues) {
    const mm = Math.floor(cue.start / 60);
    const ss = String(Math.floor(cue.start % 60)).padStart(2, "0");
    const line = `[${mm}:${ss}] ${cue.text}`;
    total += line.length + 1;
    if (total > maxChars) break;
    lines.push(line);
  }
  return lines.join("\n");
}
