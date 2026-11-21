// Render 4 screenshot resmi (shots.json) via window.PS.
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveDir, launchPage, sleep } from './cdp.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const PORT = 8080;
const shots = JSON.parse(await readFile(join(root, 'shots.json'), 'utf8')).shots;

const srv = await serveDir(join(root, 'game'), PORT);
const page = await launchPage(1280, 720);
try {
  await page.goto('http://localhost:' + PORT + '/index.html');
  await page.ev('new Promise(r => { const t = setInterval(() => { if (window.PS && window.WORLD && WORLD.renderer) { clearInterval(t); r(1); } }, 100); })');
  for (const old of ['2-onfoot.jpg', '4-mission.jpg']) {
    try { await unlink(join(root, 'screenshots', old)); } catch {}
  }
  for (const s of shots) {
    await page.ev('PS.stage(' + JSON.stringify(s.stage) + ')');
    await sleep(700);
    let buf = await page.shot(84);
    let q = 84;
    while (buf.length > 260000 && q > 40) { q -= 10; buf = await page.shot(q); }
    await writeFile(join(root, 'screenshots', s.file), buf);
    console.log(s.file, buf.length, 'bytes @q' + q);
    if (buf.length >= 262144) { console.error('OVER CAP: ' + s.file); process.exitCode = 1; }
  }
} finally {
  await page.close();
  srv.close();
}
