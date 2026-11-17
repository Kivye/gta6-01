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

mkdirSync(outDir, { recursive: true });
cpSync(join(repoDir, 'game'), join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoDir, 'screenshots'))) {
  cpSync(join(repoDir, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

const payload = payloadInventory(join(outDir, 'game'));
if (payload.totalBytes > 50331648) {
  throw new Error(`game payload is ${payload.totalBytes} bytes, over the 50331648-byte cap (game_max_bytes)`);
}
console.log(`game payload: ${payload.files.length} files, ${payload.totalBytes} bytes`);

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
