# hockey-prices

Precios diarios de cartas de hockey (NHL) para la app de escáner de cartas de hockey, a partir de las ventas de
[TheCardAPI](https://www.thecardapi.com) (eBay, Fanatics Collect, Goldin...). Es el mismo sistema que
`baseball-prices`, del que está copiado: solo cambian `SPORT` en `build.mjs`, el parser y las listas de `data/`.

Una tarea de GitHub Actions (`.github/workflows/update-prices.yml`) ejecuta cada día `node build.mjs public` y
publica el resultado en la rama `gh-pages` (GitHub Pages): `https://alberttsg.github.io/hockey-prices/`. El formato
de los archivos está al principio de `build.mjs`. Solo se publica el resumen diario de cada carta, no las ventas
sueltas.

## Archivos

- `build.mjs`: descarga las ventas, las agrupa por carta y genera el feed.
- `cardParser.js`: lee jugador, año, set, número, parallel, tirada y grado de un texto. **Es el mismo archivo que
  usa la app** (`hockey/Components/Prices/cardParser.js`): si se cambia aquí, hay que copiarlo allí.
- `data/players.json`: todos los jugadores y porteros que han jugado en la NHL (desde 1917) y los elegidos en los
  tres últimos drafts (API de la NHL). Se regenera con `node players.mjs` al empezar cada temporada y después del
  draft.
- `data/rules.json`: sets, parallels, equipos, alias de jugadores y palabras que descartan una venta. La app lo
  descarga del feed, así que los cambios llegan sin publicar una versión nueva.
- `ebay-worker/worker.js`: el Worker de Cloudflare que buscan las apps cuando una carta no está en el feed. Es el
  de `baseball-prices` con el parámetro `sport=hockey` (sin el parámetro funciona igual que antes, así que sirve
  para las dos apps). Ver "Worker de Cloudflare" abajo.

## Configuración en GitHub

1. Secreto del repositorio `THECARDAPI_KEY` (Settings > Secrets and variables > Actions). Es una clave distinta de
   la de `baseball-prices`, así que las 5.000 filas diarias del plan son solo para hockey.
2. Variable del repositorio `LOOKBACK_DAYS`: días hacia atrás del plan de TheCardAPI (gratis: 3, Starter: 14).
3. Settings > Pages: rama `gh-pages`, carpeta `/` (después de la primera ejecución).

## Worker de Cloudflare

El Worker es el mismo para baseball y hockey: `baseball-ebay` (`https://baseball-ebay.albertsg-86.workers.dev`).
Para actualizarlo (hace falta `npx wrangler login` una vez):

```
npm install
npx wrangler deploy --config ebay-worker/wrangler.toml
```

`ebay-worker/wrangler.toml` lleva `keep_vars = true`: `APP_KEY`, `EBAY_CLIENT_ID` y `EBAY_CLIENT_SECRET` están puestas
en el panel de Cloudflare como variables y, sin eso, el despliegue las borraría. `APP_KEY_HOCKEY` es un secreto con el
mismo valor que `WORKER_APP_KEY` en `hockey/Components/Prices/ebayWorker.js`.

Copiar también `ebay-worker/worker.js` a `baseball-prices` para que los dos repos tengan la misma versión.

## Probar en local

```
# Cuántas ventas tiene un día con varios precios mínimos (cada recuento gasta una fila por búsqueda)
THECARDAPI_KEY=... node build.mjs --estimate

THECARDAPI_KEY=... LOOKBACK_DAYS=1 node build.mjs public
```
