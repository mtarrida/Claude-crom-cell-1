---
description: Trae lo último del repo YT Analyzer y entrega un único HTML autocontenido (sin zip) para probarlo en el móvil de un tap.
---

Objetivo de este comando: dejar al usuario, en el chat, un solo archivo `.html` que pueda abrir directamente en Chrome Android — sin descomprimir zip, sin depender de que `css/` y `js/` estén junto al HTML.

Este comando es de solo lectura respecto al repositorio remoto: solo trae cambios (pull), nunca hace commit ni push. Si el usuario pide explícitamente subir algo a GitHub, es una petición aparte — no la hagas como parte de este comando.

Pasos:

1. Comprueba la rama actual (`git branch --show-current`) y trae lo último de esa misma rama en `origin`:
   - `git fetch origin <rama-actual>`
   - `git pull origin <rama-actual>`
   Si hay conflictos o el pull falla, para y explícaselo al usuario en vez de intentar resolverlo por tu cuenta.

2. Localiza los archivos actuales del proyecto: `index.html`, `css/styles.css` y todos los `js/*.js` (revisa `index.html` para ver el orden real en que se cargan los `<script>`, por si ha cambiado).

3. Genera un único HTML autocontenido en el directorio scratchpad de la sesión (p.ej. `yt-analyzer-standalone.html`):
   - Parte del `index.html` actual.
   - Sustituye el `<link rel="stylesheet" href="css/styles.css">` por un bloque `<style>` con el CSS pegado dentro.
   - Sustituye cada `<script src="js/....js"></script>` por un `<script>` con ese JS pegado dentro, respetando el mismo orden de carga que tenía el `index.html` original.
   - No cambies la lógica de la app, solo estás empaquetando los mismos archivos en uno.

4. Envía ese único archivo al usuario (herramienta de envío de archivos al usuario), con una caption corta indicando que lo abra directamente con Chrome — nada de instrucciones de descomprimir.

5. Recuérdale brevemente, solo si aplica, que necesitará sus claves de API en el botón de Ajustes (⚙️) de la app para que funcione la búsqueda/resumen.

No pidas confirmación para los pasos 1-4: son de solo lectura sobre GitHub y no modifican el repo remoto.
