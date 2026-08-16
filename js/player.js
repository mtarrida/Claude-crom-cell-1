// Envoltorio mínimo sobre la YouTube IFrame Player API, para poder buscar
// (seek) a un segundo concreto cuando el usuario clica un capítulo.

let apiPromise = null;

function loadYouTubeApi() {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    if (window.YT && window.YT.Player) {
      resolve(window.YT);
      return;
    }
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT);
    };
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }
  });
  return apiPromise;
}

let currentPlayer = null;

/**
 * @param {HTMLElement} mountElement Contenedor persistente donde crear el player.
 *   Se recrea un <div> hijo nuevo en cada llamada porque la IFrame API
 *   sustituye el elemento indicado por un <iframe>, así que no podemos
 *   reutilizar el mismo id entre vídeos.
 */
export async function mountPlayer(mountElement, videoId) {
  const YT = await loadYouTubeApi();

  if (currentPlayer) {
    currentPlayer.destroy();
    currentPlayer = null;
  }

  mountElement.innerHTML = "";
  const inner = document.createElement("div");
  mountElement.appendChild(inner);

  return new Promise((resolve, reject) => {
    currentPlayer = new YT.Player(inner, {
      videoId,
      playerVars: { rel: 0, playsinline: 1 },
      events: {
        onReady: () => resolve(currentPlayer),
        // p. ej. error 153: la página no se sirve por http(s) (archivo local),
        // o el vídeo no permite embeberse. No bloqueamos el resto de la app.
        onError: (e) => reject(new Error(`YouTube player error ${e?.data}`)),
      },
    });
  });
}

export function seekTo(seconds) {
  currentPlayer?.seekTo(seconds, true);
  currentPlayer?.playVideo();
}

export function destroyPlayer() {
  currentPlayer?.destroy();
  currentPlayer = null;
}
