# YT Analyzer

Mini app web (HTML/CSS/JS, sin build, sin backend) para:

1. Buscar vídeos de YouTube.
2. Seleccionar uno y verlo en un reproductor pequeño con un panel divisor
   **arrastrable** (vídeo arriba en vertical / a la izquierda en horizontal,
   contenido al lado).
3. Generar automáticamente:
   - Un **resumen corto** (un párrafo) del vídeo.
   - Una lista de **capítulos plegables**: al clicar uno se despliega su
     resumen, y clicando la marca de tiempo el vídeo salta a ese punto.

Pensada para publicarse tal cual con **GitHub Pages** — no hay paso de compilación.

## Cómo funciona (arquitectura)

Todo corre **en tu navegador**, no hay servidor propio:

- **Búsqueda de vídeos** → [YouTube Data API v3](https://developers.google.com/youtube/v3).
- **Transcripción** → se leen los subtítulos que YouTube ya tiene publicados
  para el vídeo (manuales o autogenerados). YouTube no permite leer esto
  con CORS desde un dominio ajeno, así que si la petición directa falla se
  reintenta a través de un proxy CORS configurable (por defecto
  `api.allorigins.win`, cambiable en Ajustes ⚙️).
- **Resumen y capítulos** → se llama directamente desde el navegador a la
  [API de Gemini (Google AI Studio)](https://ai.google.dev/) con la
  transcripción como contexto.

Las claves de API (YouTube y Gemini) se introducen una vez desde el
icono ⚙️ y se guardan **solo en `localStorage` de tu navegador**. Nunca se
suben al repositorio ni pasan por ningún servidor intermedio propio.

### Limitación conocida: vídeos sin subtítulos

Si un vídeo no tiene ningún subtítulo (ni siquiera autogenerado), hoy la
app lo indica y no genera resumen. Transcribir el audio desde cero
(por ejemplo con Whisper) requeriría descargar el audio del vídeo y
procesarlo en un backend — no es viable puramente en un sitio estático de
GitHub Pages. Queda como posible mejora futura (p. ej. una función
serverless que use la API de Whisper/AssemblyAI/Deepgram).

## Puesta en marcha

### 1. Consigue tus claves de API

- **YouTube Data API v3**: crea un proyecto en
  [Google Cloud Console](https://console.cloud.google.com/apis/credentials),
  habilita "YouTube Data API v3" y genera una clave de API. Restríngela
  por *referrer HTTP* a tu dominio de GitHub Pages cuando lo tengas.
- **Gemini (Google AI Studio)**: genera una clave gratis en
  [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (sin tarjeta).

Ambas se configuran desde el botón ⚙️ dentro de la propia app, no hace
falta tocar código.

### 2. Activa GitHub Pages

1. Une esta rama a `main` (o cambia el trigger del workflow si prefieres
   otra rama).
2. En el repositorio: **Settings → Pages → Build and deployment → Source**
   y elige **GitHub Actions**. El workflow
   [`.github/workflows/pages.yml`](.github/workflows/pages.yml) ya está
   preparado para desplegar automáticamente en cada push a `main`.
3. Espera a que termine la acción "Deploy GitHub Pages" y usa la URL que
   te da (aparece también en Settings → Pages).

> **Sobre la privacidad**: GitHub Pages generado desde un repositorio
> privado solo es posible con GitHub Pro/Team/Enterprise (plan gratuito
> exige repo público para usar Pages). En cualquier caso, la URL de Pages
> en sí es accesible por cualquiera que la conozca — no hay usuario/contraseña.
> Como no se guarda ninguna clave en el código, el único dato "sensible" es
> la propia URL: no la compartas si no quieres que la use nadie más.

### 3. Pruébalo en local (opcional)

No hace falta build, basta con servir los archivos estáticos:

```bash
python3 -m http.server 8080
# abre http://localhost:8080
```

## Estructura del proyecto

```
index.html            Estructura de la app (resultados, vista de vídeo, ajustes)
css/styles.css         Estilos (claro/oscuro automático, layout responsive)
js/settings.js         Ajustes y claves de API (localStorage)
js/youtube.js          Búsqueda y detalle de vídeos (YouTube Data API v3)
js/transcript.js        Extracción de subtítulos/transcripción
js/summarize.js         Resumen + capítulos vía API de Gemini
js/player.js             Reproductor embebido (YouTube IFrame API) + seek
js/split.js               Panel divisor arrastrable (ratón/táctil/teclado)
js/app.js                  Orquestador principal
.github/workflows/pages.yml  Despliegue automático a GitHub Pages
```

## Próximas mejoras posibles

- Transcripción real (Whisper u otro STT) para vídeos sin subtítulos, vía
  una función serverless.
- Historial de vídeos analizados.
- Exportar resumen/capítulos.
- Multi-idioma de interfaz.
