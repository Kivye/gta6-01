// Palmshade Heat — hand-in program (Node 22, standard library only).
// Copies this repo's game/ and screenshots/ into the output directory and writes
// dossier.json there with the vendored make.fun library, using the gta6-01 caps.
// Run it twice and the output is byte-identical: the copy is a plain recursive
// copy of static files and buildDossier is deterministic.
//   node main.ts                       (writes to /output)
//   MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Pre-flight caps from the gta6-01 kit rules, named once here so the
// validation below and the dossier options at the bottom cannot drift apart:
// the whole game payload may not exceed game_max_bytes, and no single
// screenshot may exceed the per-screenshot byte cap.
const GAME_MAX_BYTES = 50331648;
const SCREENSHOT_MAX_BYTES = 262144;
// Two more caps from the same kit rules, likewise named once here: the
// dossier handed in may not exceed 1.5 MiB, and the game's page itself,
// game/index.html, may not exceed 1 MiB.
const DOSSIER_MAX_BYTES = 1572864;
const INDEX_HTML_MAX_BYTES = 1048576;

// Inventory of a copied payload directory: every file under it, in stable
// sorted path order, with its byte size, plus the total payload byte count.
// Computed from the files themselves, so it is deterministic — the same
// payload always yields the same inventory.
function payloadInventory(root) {
  const files = [];
  let totalBytes = 0;
  const walk = (dir, prefix) => {
    for (const name of readdirSync(dir).sort()) {
      const abs = join(dir, name);
      const rel = prefix === '' ? name : `${prefix}/${name}`;
      const st = statSync(abs);
      if (st.isDirectory()) walk(abs, rel);
      else if (st.isFile()) {
        files.push({ path: rel, bytes: st.size });
        totalBytes += st.size;
      }
    }
  };
  walk(root, '');
  return { files, totalBytes };
}

// Pre-flight validation over the two payload inventories, run before the
// dossier is built so a bad hand-in fails here with a precise reason rather
// than at the sealed gate. Every violation names the offending file together
// with its actual size and the cap it broke:
//   - each screenshots/*.jpg file, on its own, against SCREENSHOT_MAX_BYTES;
//   - the game payload as a whole against GAME_MAX_BYTES (game_max_bytes),
//     naming the largest single contributor when the total is over;
//   - game/index.html, on its own, against INDEX_HTML_MAX_BYTES, as part of
//     the same sorted game/ walk (its inventory entry is the one named
//     exactly "index.html");
//   - the dossier bytes, when the caller passes them (dossierBytes, the
//     exact bytes buildDossier produced and about to be written), against
//     DOSSIER_MAX_BYTES.
// Returns nothing on success; the caller logs the inventories it validated.
function validatePayload(gamePayload, shotsPayload, dossierBytes = null) {
  for (const shot of shotsPayload.files) {
    if (!/\.jpg$/i.test(shot.path)) continue;
    if (shot.bytes > SCREENSHOT_MAX_BYTES) {
      throw new Error(
        `screenshot ${shot.path} is ${shot.bytes} bytes, over the ${SCREENSHOT_MAX_BYTES}-byte per-screenshot cap`,
      );
    }
  }
  for (const file of gamePayload.files) {
    if (file.path !== 'index.html') continue;
    if (file.bytes > INDEX_HTML_MAX_BYTES) {
      throw new Error(
        `game/index.html is ${file.bytes} bytes, over the ${INDEX_HTML_MAX_BYTES}-byte game/index.html cap`,
      );
    }
  }
  if (dossierBytes !== null && dossierBytes > DOSSIER_MAX_BYTES) {
    throw new Error(
      `dossier.json is ${dossierBytes} bytes, over the ${DOSSIER_MAX_BYTES}-byte dossier cap`,
    );
  }
  if (gamePayload.totalBytes > GAME_MAX_BYTES) {
    const largest = gamePayload.files.reduce(
      (big, f) => (big === null || f.bytes > big.bytes ? f : big),
      null,
    );
    const culprit = largest ? `; largest file ${largest.path} is ${largest.bytes} bytes` : '';
    throw new Error(
      `game payload is ${gamePayload.totalBytes} bytes, over the ${GAME_MAX_BYTES}-byte cap (game_max_bytes)${culprit}`,
    );
  }
}

mkdirSync(outDir, { recursive: true });
cpSync(join(repoDir, 'game'), join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoDir, 'screenshots'))) {
  cpSync(join(repoDir, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

const payload = payloadInventory(join(outDir, 'game'));
const shotsPayload = payloadInventory(join(outDir, 'screenshots'));
validatePayload(payload, shotsPayload);
console.log(`game payload: ${payload.files.length} files, ${payload.totalBytes} bytes`);
console.log(`screenshots: ${shotsPayload.files.length} files, ${shotsPayload.totalBytes} bytes`);

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: SCREENSHOT_MAX_BYTES },
  game_max_files: 993,
  game_max_bytes: GAME_MAX_BYTES,
  game_path_max_bytes: 1000,
});
// Hand-in gate for the dossier itself: check the exact bytes buildDossier
// produced against the dossier cap before anything is written, so an
// oversized dossier aborts the hand-in here instead of reaching the sealed
// gate. The check only reads the byte count — the bytes written below are
// the very bytes buildDossier returned, unchanged.
validatePayload(payload, shotsPayload, dossier.byteLength);
writeFileSync(join(outDir, 'dossier.json'), dossier);
