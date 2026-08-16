// Detalle de un vídeo (por ID) usando la YouTube Data API v3, y extracción
// del ID de vídeo a partir de un enlace (o ID) pegado por el usuario.

const API_BASE = "https://www.googleapis.com/youtube/v3";

function isoDurationToSeconds(iso) {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || "");
  if (!m) return 0;
  const [, h, min, s] = m;
  return (Number(h) || 0) * 3600 + (Number(min) || 0) * 60 + (Number(s) || 0);
}

export function formatDuration(totalSeconds) {
  if (!totalSeconds && totalSeconds !== 0) return "";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  const mm = h ? String(m).padStart(2, "0") : String(m);
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatTimestamp(totalSeconds) {
  return formatDuration(Math.max(0, Math.floor(totalSeconds || 0)));
}

class YouTubeApiError extends Error {}

async function apiFetch(path, params, apiKey) {
  const url = new URL(`${API_BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) {
    let message = `Error ${res.status} llamando a YouTube Data API`;
    try {
      const body = await res.json();
      message = body?.error?.message || message;
    } catch {
      /* ignore */
    }
    throw new YouTubeApiError(message);
  }
  return res.json();
}

function mapVideoItem(item) {
  return {
    id: item.id,
    title: item.snippet.title,
    description: item.snippet.description,
    channelTitle: item.snippet.channelTitle,
    publishedAt: item.snippet.publishedAt,
    thumbnail:
      item.snippet.thumbnails?.medium?.url ||
      item.snippet.thumbnails?.default?.url ||
      "",
    durationSeconds: isoDurationToSeconds(item.contentDetails?.duration),
    viewCount: item.statistics?.viewCount,
  };
}

/**
 * @returns {Promise<object|null>} null si no existe ningún vídeo con ese ID.
 */
export async function getVideoById(videoId, apiKey) {
  const data = await apiFetch(
    "videos",
    { part: "snippet,contentDetails,statistics", id: videoId },
    apiKey
  );
  const item = data.items?.[0];
  return item ? mapVideoItem(item) : null;
}

/**
 * Extrae el ID de vídeo de YouTube de un texto pegado por el usuario: puede
 * ser una URL completa (youtube.com/watch, youtu.be, shorts, live,
 * music.youtube.com…) o directamente el ID de 11 caracteres.
 * @returns {string|null}
 */
export function extractVideoId(text) {
  if (!text) return null;
  const trimmed = text.trim();

  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;

  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^(www|m|music)\./, "");

  if (host === "youtu.be") {
    return url.pathname.slice(1).split("/")[0] || null;
  }

  if (host === "youtube.com") {
    const v = url.searchParams.get("v");
    if (v) return v;
    const match = /^\/(shorts|live|embed)\/([\w-]{11})/.exec(url.pathname);
    if (match) return match[2];
  }

  return null;
}

export { YouTubeApiError };
