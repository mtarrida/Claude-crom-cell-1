// Búsqueda y detalle de vídeos usando la YouTube Data API v3.

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

export async function searchVideos(query, apiKey, { maxResults = 16 } = {}) {
  const searchData = await apiFetch(
    "search",
    { part: "snippet", type: "video", q: query, maxResults },
    apiKey
  );

  const ids = (searchData.items || [])
    .map((it) => it.id?.videoId)
    .filter(Boolean);

  if (ids.length === 0) return [];

  const detailsData = await apiFetch(
    "videos",
    { part: "snippet,contentDetails,statistics", id: ids.join(",") },
    apiKey
  );

  return (detailsData.items || []).map((item) => ({
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
  }));
}

export { YouTubeApiError };
