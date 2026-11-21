// Palmshade Heat screenshot run: serves the game, opens each staged
// scene listed in shots.json, saves a 1280x800 JPEG into screenshots/,
// and reports each file's size against the 256 KiB cap. Finishes with
// an FPS probe in the staged cover scene, the densest tableau.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';

const require2 = createRequire('/home/hatch/workspace/makefun/entries/makefun-frontend-01/scratch/shots/node_modules/playwright-core/package.json');
const { chromium } = require2('playwright-core');
const exeCandidates = [
  process.env.HOME + '/.cache/ms-playwright/chromium-1255/chrome-linux/chrome',
  process.env.HOME + '/.cache/ms-playwright/chromium-1148/chrome-linux/chrome',
  process.env.HOME + '/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome',
];
const exe = exeCandidates.find((p) => existsSync(p));
if (!exe) { console.error('NO_CHROMIUM'); process.exit(2); }
const root = new URL('.', import.meta.url).pathname;
const shots = JSON.parse(readFileSync(root + 'shots.json', 'utf8'));
const server = spawn('node', ['serve.ts'], { cwd: root, stdio: 'pipe' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
try {
  for (const s of shots) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.goto('http://localhost:8080/' + s.query, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2600);
    const path = root + 'screenshots/' + s.name;
    await page.screenshot({ path, type: 'jpeg', quality: 80 });
    const bytes = statSync(path).size;
    console.log(`${s.name}: ${bytes} bytes ${bytes <= 262144 ? 'OK' : 'OVER 256KiB'}${errs.length ? ' ERRORS: ' + errs.join(' | ') : ''}`);
    await page.close();
  }
  // FPS probe: 30 seconds in the staged cover scene.
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('http://localhost:8080/?shot=cover&seed=1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const fps = await page.evaluate(() => new Promise((resolve) => {
    let frames = 0; const t0 = performance.now();
    const tick = () => { frames++; if (performance.now() - t0 < 30000) requestAnimationFrame(tick); else resolve(frames / ((performance.now() - t0) / 1000)); };
    requestAnimationFrame(tick);
  }));
  console.log(`FPS (cover scene, software WebGL): ${fps.toFixed(1)}`);
  await page.close();
} finally {
  await browser.close();
  server.kill();
}
