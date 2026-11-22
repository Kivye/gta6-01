// PALMSHADE HEAT — program serah-terima entri (Node 22, pustaka standar saja).
// Menyalin game/ + screenshots/ ke keluaran, menulis dossier.json via
// pustaka make.fun ter-vendor, di bawah batas kompetisi. Dua kali jalan
// hasilnya identik byte-for-byte: salinan polos statis, dossier deterministik.
// node main.ts -> /output; MAKEFUN_OUTPUT_DIR mengalihkan keluaran.
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const BATAS_GAME = 50331648;
const BATAS_SHOT = 262144;
const BATAS_DOSSIER = 1572864;
const BATAS_INDEX = 1048576;
const repoDir = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function salin(src, dst) {
  mkdirSync(dst, { recursive: true });
  for (const name of readdirSync(src).sort()) {
    const s = join(src, name);
    if (statSync(s).isDirectory()) salin(s, join(dst, name));
    else writeFileSync(join(dst, name), readFileSync(s));
  }
}

function inventaris(dir, prefix = '', files = [], box = { total: 0 }) {
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    const rel = prefix ? prefix + '/' + name : name;
    const st = statSync(p);
    if (st.isDirectory()) inventaris(p, rel, files, box);
    else if (st.isFile()) { files.push({ path: rel, bytes: st.size }); box.total += st.size; }
  }
  return { files, total: box.total };
}

function validasi(game, shots, dBytes) {
  for (const f of shots.files)
    if (/\.jpg$/i.test(f.path) && f.bytes > BATAS_SHOT)
      throw new Error(`screenshot ${f.path}: ${f.bytes} byte > batas ${BATAS_SHOT}`);
  for (const f of game.files)
    if (f.path === 'index.html' && f.bytes > BATAS_INDEX)
      throw new Error(`game/index.html: ${f.bytes} byte > batas ${BATAS_INDEX}`);
  if (dBytes != null && dBytes > BATAS_DOSSIER)
    throw new Error(`dossier.json: ${dBytes} byte > batas ${BATAS_DOSSIER}`);
  if (game.total > BATAS_GAME) {
    let big = null;
    for (const f of game.files) if (!big || f.bytes > big.bytes) big = f;
    throw new Error(`muatan game: ${game.total} byte > batas ${BATAS_GAME}; terbesar ${big.path} (${big.bytes} byte)`);
  }
}

salin(join(repoDir, 'game'), join(outDir, 'game'));
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoDir, 'screenshots')))
  salin(join(repoDir, 'screenshots'), join(outDir, 'screenshots'));

const gInv = inventaris(join(outDir, 'game'));
const sInv = inventaris(join(outDir, 'screenshots'));
validasi(gInv, sInv);
console.log(`game: ${gInv.files.length} berkas, ${gInv.total} byte`);
console.log(`screenshots: ${sInv.files.length} berkas, ${sInv.total} byte`);

const dossier = buildDossier(outDir, { text_max_bytes: 163840, screenshots: { max: 4, max_bytes: BATAS_SHOT }, game_max_files: 993, game_max_bytes: BATAS_GAME, game_path_max_bytes: 1000 });
validasi(gInv, sInv, dossier.byteLength);
writeFileSync(join(outDir, 'dossier.json'), dossier);
