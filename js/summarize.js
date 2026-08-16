// Genera resumen + capítulos llamando directamente a la API de Gemini
// (Google AI Studio) desde el navegador, usando la clave que el usuario
// introduce en Ajustes. La API de Gemini admite llamadas cross-origin con
// la clave como query param, así que no hace falta ningún header especial.

const GEMINI_URL_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

class SummarizeError extends Error {}

function stripCodeFence(text) {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return fenced ? fenced[1] : trimmed;
}

function buildPrompt({ title, description, transcriptText }) {
  return `Eres un asistente que analiza transcripciones de vídeos de YouTube para crear un resumen y una lista de capítulos.

Devuelve EXCLUSIVAMENTE un JSON válido (sin explicaciones, sin markdown, sin texto antes o después) con esta forma exacta:
{
  "summary": "resumen de un único párrafo corto (máximo ~60 palabras) en español, que explique de qué trata el vídeo",
  "chapters": [
    { "title": "título breve del capítulo", "start": 0, "summary": "resumen de 1-2 frases de ese capítulo" }
  ]
}

Reglas:
- "start" es el segundo (número entero) donde empieza el capítulo según las marcas de tiempo de la transcripción.
- Si la descripción del vídeo ya incluye marcas de tiempo de capítulos (líneas tipo "0:00 Intro"), úsalas como referencia principal para los títulos y límites de capítulo.
- Si no hay marcas de capítulos en la descripción, divide la transcripción en capítulos temáticos coherentes (normalmente entre 4 y 10, según la duración).
- Los capítulos deben cubrir todo el vídeo, en orden, sin solaparse.
- Responde siempre en español, sea cual sea el idioma original del vídeo.

Título del vídeo: ${title}

Descripción del vídeo (puede incluir marcas de tiempo de capítulos):
"""
${(description || "(sin descripción)").slice(0, 2000)}
"""

Transcripción con marcas de tiempo [minutos:segundos]:
"""
${transcriptText}
"""`;
}

/**
 * @returns {Promise<{summary: string, chapters: {title:string, start:number, summary:string}[]}>}
 */
export async function summarizeVideo({ apiKey, model, title, description, transcriptText }) {
  if (!apiKey) {
    throw new SummarizeError("Falta la clave de API de Gemini. Ábrela desde Ajustes ⚙️.");
  }

  const url = `${GEMINI_URL_BASE}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: buildPrompt({ title, description, transcriptText }) }] }],
      generationConfig: { responseMimeType: "application/json" },
    }),
  });

  if (!res.ok) {
    let message = `Error ${res.status} llamando a la API de Gemini`;
    try {
      const body = await res.json();
      message = body?.error?.message || message;
    } catch {
      /* ignore */
    }
    throw new SummarizeError(message);
  }

  const data = await res.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  const jsonText = stripCodeFence(rawText);

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new SummarizeError("La respuesta del modelo no era JSON válido. Prueba a regenerar el análisis.");
  }

  if (!parsed.summary || !Array.isArray(parsed.chapters)) {
    throw new SummarizeError("La respuesta del modelo no tenía el formato esperado.");
  }

  parsed.chapters = parsed.chapters
    .filter((c) => c && typeof c.title === "string")
    .map((c) => ({
      title: c.title,
      start: Number(c.start) || 0,
      summary: c.summary || "",
    }))
    .sort((a, b) => a.start - b.start);

  return parsed;
}

export { SummarizeError };
