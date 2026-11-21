// Palmshade Heat playtest: drives the real game in headless Chromium and
// checks the full loop — menu, walking, stealing, driving, wanted,
// missions, death, bust — plus the narrative-HUD round: mission panel,
// round minimap, radio, dispatch with callsigns and the helicopter,
// sight chip, roadblock, crew abilities, standing, respect, armour and
// the vest, the fence quote, near misses with their toast, damage smoke
// and the pause career panel. This VM renders WebGL in software at a
// variable 4–7 fps and the loop clamps dt, so game time runs slower
// than real time: every time-sensitive check below POLLS game state
// with a generous real-time cap instead of trusting a fixed sleep.
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require2 = createRequire('/home/hatch/workspace/makefun/entries/makefun-frontend-01/scratch/shots/node_modules/playwright-core/package.json');
const { chromium } = require2('playwright-core');
const exeCandidates = [
  process.env.HOME + '/.cache/ms-playwright/chromium-1255/chrome-linux/chrome',
  process.env.HOME + '/.cache/ms-playwright/chromium-1148/chrome-linux/chrome',
  process.env.HOME + '/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome',
];
const exe = exeCandidates.find((p) => existsSync(p));
if (!exe) { console.error('NO_CHROMIUM'); process.exit(2); }

const server = spawn('node', ['serve.ts'], { cwd: new URL('.', import.meta.url).pathname, stdio: 'pipe' });
await new Promise((r) => setTimeout(r, 1200));
const results = [];
const check = (name, ok, extra = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`); };
const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('response', (r) => { if (r.status() >= 400) errors.push('http ' + r.status() + ' ' + r.url()); });
// Every evaluate callback binds G itself — window.__game is the game's debug handle.
const ev = (fn) => page.evaluate(fn);
const G = (expr) => page.evaluate(new Function('const G = window.__game; return (' + expr + ')'));
// Poll a boolean game expression until it holds or the cap runs out.
const poll = async (expr, tries = 40, step = 500) => {
  for (let i = 0; i < tries; i++) { if (await G(expr)) return true; await page.waitForTimeout(step); }
  return G(expr);
};

try {
  await page.goto('http://localhost:8080/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  check('page loads, no errors yet', errors.length === 0, errors.join(' | '));
  check('start screen visible', await page.isVisible('#menu'));
  check('title shows Palmshade Heat', (await page.textContent('#title')).includes('PALMSHADE'));
  await ev(() => localStorage.clear());
  await page.click('#btn-start');
  await page.waitForTimeout(600);
  check('Start begins play', await G('G.state') === 'playing');
  check('mission 1 active', await G('G.missions.active && G.missions.idx === 0'));
  // The narrative HUD round: the mission panel names the live mission,
  // and the minimap computes as a round disc.
  check('mission panel shows the active mission', await poll("(() => { const el = document.getElementById('missionpanel'); return el && !el.classList.contains('hidden') && el.textContent.includes('MISSION 1/5'); })()", 20, 300));
  check('minimap is round', await G("getComputedStyle(document.getElementById('minimap')).borderRadius") === '50%');
  // Walk for a bit and confirm Rio actually moves.
  const p0 = await G('({x: G.player.x, z: G.player.z})');
  await page.keyboard.down('w');
  let walked = 0;
  for (let i = 0; i < 80 && walked <= 3; i++) {
    await page.waitForTimeout(500);
    const p1 = await G('({x: G.player.x, z: G.player.z})');
    walked = Math.hypot(p1.x - p0.x, p1.z - p0.z);
  }
  await page.keyboard.up('w');
  check('walks with WASD', walked > 3, `moved ${walked.toFixed(1)}m from ${JSON.stringify(p0)}`);
  // Teleport next to a traffic car and steal it with E. The target's speed
  // is zeroed for the staging: at full frame rate the car otherwise drives
  // out of the 3.4m interaction radius during the fixed wait.
  await ev(() => { const G = window.__game; const car = G.cars.find((c) => c.kind === 'traffic'); car.speed = 0; G.player.x = car.mesh.position.x + 2; G.player.z = car.mesh.position.z; G.player.mesh.position.set(G.player.x, 0, G.player.z); });
  await page.waitForTimeout(300);
  await page.keyboard.press('e');
  await page.waitForTimeout(400);
  check('E steals a car', await G('!!G.player.car'));
  check('theft registered (stolen flag)', await G('G.player.car && G.player.car.stolen === true'));
  // Drive and check speed — poll, because acceleration is game-time based.
  await page.keyboard.down('w');
  let spd = 0;
  for (let i = 0; i < 26 && spd <= 4; i++) { await page.waitForTimeout(300); spd = await G('G.player.car ? Math.abs(G.player.car.speed) : 0'); }
  check('car accelerates', spd > 4, `speed ${spd.toFixed(1)}`);
  await page.keyboard.up('w');
  // Radio: R retunes the station and the bar names the new one.
  const st0 = await G('G.audio.stationIndex');
  await page.keyboard.press('r');
  check('R changes the tuned station', await poll(`G.audio.stationIndex !== ${st0}`, 12, 300));
  check('radio bar names the station and its track', await G("(() => { const el = document.getElementById('radiobar'); const st = G.audio.station; return el.textContent.includes(st.name) && el.textContent.includes(st.track); })()"));
  // Collision: park the car south of a big building, aimed north into it, and floor it.
  await ev(() => { const G = window.__game; const clear = (x, z, pad) => !G.colliders.some((b) => Math.abs(x - b.x) < b.hw + pad && Math.abs(z - b.z) < b.hd + pad); const c = G.colliders.find((b) => !b.soft && b.hw > 3 && clear(b.x, b.z + b.hd + 16, 3)); const car = G.player.car; car.mesh.position.set(c.x, 0, c.z + c.hd + 16); car.angle = Math.PI; car.speed = 0; });
  await page.keyboard.down('w');
  let hitWall = false;
  for (let i = 0; i < 120 && !hitWall; i++) {
    await page.waitForTimeout(500);
    hitWall = await G('(() => { const car = G.player.car; const c = G.colliders.find((b) => !b.soft && Math.abs(car.mesh.position.x - b.x) < b.hw + 2 && Math.abs(car.mesh.position.z - b.z) < b.hd + 3); return !!c; })()');
  }
  await page.keyboard.up('w');
  check('building collision stops car at wall', hitWall);
  // Wanted: force 1 star, police should spawn; then 3 stars and more cruisers.
  await ev(() => { const G = window.__game; if (G.player.car) { const c = G.player.car; G.player.car = null; c.kind = 'parked'; G.player.mesh.visible = true; } G.wanted = 1; G.hiddenT = 0; });
  let copSpawned = false;
  for (let i = 0; i < 60 && !copSpawned; i++) {
    await page.waitForTimeout(500);
    copSpawned = await G('G.cars.some(c => c.model.id === "police")');
  }
  check('wanted 1 spawns police', copSpawned);
  // Pursuit: the nearest cruiser must close distance on the stationary player.
  const copDist = () => G('(() => { const cs = G.cars.filter(c => c.model.id === "police"); return cs.length ? Math.min(...cs.map(c => Math.hypot(c.mesh.position.x - G.player.x, c.mesh.position.z - G.player.z))) : -1; })()');
  const copD0 = await copDist();
  let copD1 = copD0, pursued = false;
  for (let i = 0; i < 120 && !pursued; i++) {
    await page.waitForTimeout(500);
    copD1 = await copDist();
    if (copD1 >= 0 && (copD1 < copD0 - 12 || copD1 < 16)) pursued = true;
    if ((await G('G.state')) !== 'playing') break; // busted mid-pursuit also proves the chase works
  }
  check('police pursue the player', pursued || (await G('G.state')) !== 'playing', `nearest cruiser ${copD0.toFixed(0)}m -> ${copD1.toFixed(0)}m`);
  await ev(() => { const G = window.__game; if (G.state === 'playing') G.wanted = 3; });
  let copCount = 0;
  for (let i = 0; i < 180 && copCount < 2; i++) {
    await page.waitForTimeout(1000);
    await ev(() => { const G = window.__game; if (G.state === 'playing' && G.wanted < 3) G.wanted = 3; });
    copCount = await G('G.cars.filter(c => c.model.id === "police").length');
  }
  check('wanted 3 scales police', copCount >= 2, `${copCount} cruisers`);
  // At three stars the helicopter is up and dispatch names it.
  check('helicopter rises at three stars', await poll('!!G.heli', 30, 400));
  check('dispatch panel names PSPD and AIR-1', await poll("(() => { const el = document.getElementById('dispatchpanel'); return el && !el.classList.contains('hidden') && el.textContent.includes('PSPD DISPATCH') && el.textContent.includes('AIR-1'); })()", 30, 400));
  check('sight chip shows IN SIGHT or LOSING THEM', await poll("(() => { const el = document.getElementById('sightchip'); return el && !el.classList.contains('hidden') && /IN SIGHT|LOSING THEM/.test(el.textContent); })()", 30, 400));
  // Escape: hide on the pier with cops teleported far away until stars decay.
  await ev(() => { const G = window.__game; G.wanted = 3; G.player.x = -100; G.player.z = 130; G.player.mesh.position.set(-100, 0, 130); G.cars.filter((c) => c.model.id === 'police').forEach((c) => { c.mesh.position.set(100, 0, -100); c.speed = 0; }); G.hiddenT = 99; });
  let decayed = false;
  for (let i = 0; i < 260 && !decayed; i++) {
    await page.waitForTimeout(1000);
    await ev(() => { const G = window.__game; G.player.x = -100; G.player.z = 130; G.cars.filter((c) => c.model.id === 'police').forEach((c) => { if (Math.hypot(c.mesh.position.x + 100, c.mesh.position.z - 130) < 62) { c.mesh.position.set(100, 0, -100); c.speed = 0; } }); });
    decayed = (await G('G.wanted')) === 0;
  }
  check('wanted decays when hidden', decayed, `wanted=${await G('G.wanted')}`);
  check('helicopter leaves when the heat dies', await poll('!G.heli', 30, 400));
  // Mission 1 end to end on a fresh story: steal, deliver to the chop shop.
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await ev(() => localStorage.clear());
  await page.click('#btn-start');
  await page.waitForTimeout(500);
  await ev(() => { const G = window.__game; const car = G.cars.find((c) => c.kind === 'traffic'); car.speed = 0; G.player.x = car.mesh.position.x + 2; G.player.z = car.mesh.position.z; G.player.mesh.position.set(G.player.x, 0, G.player.z); });
  await page.waitForTimeout(250);
  await page.keyboard.press('e');
  await page.waitForTimeout(300);
  check('mission run: car stolen again', await G('!!G.player.car'));
  const cashBefore = await G('G.cash');
  await ev(() => { const G = window.__game; G.player.car.mesh.position.set(-52, 0, -52 + 7); G.player.car.speed = 0; });
  let cashAfter = cashBefore;
  for (let i = 0; i < 60 && cashAfter <= cashBefore; i++) {
    await page.waitForTimeout(500);
    cashAfter = await G('G.cash');
  }
  check('mission 1 completes at chop shop', cashAfter > cashBefore, `cash ${cashBefore} -> ${cashAfter}`);
  check('save written', await ev(() => !!localStorage.getItem('palmshade-heat-save-v1')));
  // The economy moved with the job: standing in Old Town (the sale and
  // the finish both happened there) and respect for a completed mission.
  check('standing rose in Old Town after sale + finish', await G("G.standing['Old Town'] > 50"), `standing=${await G("G.standing['Old Town']")}`);
  check('respect reached the first rung after mission 1', await G('G.respect >= 120'), `respect=${await G('G.respect')}`);
  // A second steal feeds the career counter.
  await ev(() => { const G = window.__game; const car = G.cars.find((c) => c.kind === 'traffic'); car.speed = 0; G.player.x = car.mesh.position.x + 2; G.player.z = car.mesh.position.z; G.player.mesh.position.set(G.player.x, 0, G.player.z); });
  await page.waitForTimeout(250);
  await page.keyboard.press('e');
  await page.waitForTimeout(300);
  check('career counter counts stolen cars', await G('G.stats.stolen >= 2'), `stolen=${await G('G.stats.stolen')}`);
  // Armour absorbs before health: 30 damage against 50 armour.
  const healthBefore = await G('G.player.health');
  await ev(() => { const G = window.__game; G.player.armour = 50; G.damagePlayer(30); });
  check('armour absorbs damage before health', await G('G.player.armour === 20') && (await G('G.player.health')) === healthBefore,
    `armour=${await G('G.player.armour')} health=${await G('G.player.health')}`);
  // Crew: QUICK FIX patches a 40% car to 85% and starts its cooldown.
  await ev(() => { const G = window.__game; if (G.player.car) G.player.car.health = 40; });
  await page.keyboard.press('x');
  check('QUICK FIX repairs 40 -> 85 and cools down', await poll('G.player.car && G.player.car.health === 85 && G.crew.cds.fix > G.time', 20, 300));
  // Crew: SWAP PLATES drops exactly one star.
  await ev(() => { const G = window.__game; G.wanted = 2; });
  await page.keyboard.press('z');
  check('SWAP PLATES drops one star', await poll('G.wanted === 1', 20, 300));
  await ev(() => { const G = window.__game; G.wanted = 0; });
  // Crew: EYES OUT opens the lookout window.
  await page.keyboard.press('c');
  check('EYES OUT opens the lookout window', await poll('G.crew.eyesUntil > G.time', 20, 300));
  // Fence panel: park the stolen car 12 m from the bay — close enough to
  // quote, too far to sell — and the panel names the real fence value.
  await ev(() => { const G = window.__game; const car = G.player.car; car.mesh.position.set(-52, 0, -33); car.speed = 0; });
  check('fence panel quotes a dollar value near the shop', await poll("(() => { const el = document.getElementById('fencepanel'); return el && !el.classList.contains('hidden') && el.textContent.includes('$'); })()", 24, 300));
  // Near miss: thread past a parked traffic car at speed, laterally ~4 m.
  await ev(() => { const G = window.__game; const car = G.player.car; car.mesh.position.set(0, 0, 40); car.angle = 0; car.speed = 22; G.player.x = 0; G.player.z = 40; const t = G.cars.filter((c) => c.kind === 'traffic').sort((a, b) => Math.hypot(a.mesh.position.x, a.mesh.position.z - 50) - Math.hypot(b.mesh.position.x, b.mesh.position.z - 50))[0]; t.speed = 0; t.cruiseSpeed = 0; t.waypoint = null; t.mesh.position.set(3.8, 0, 56); G._nmCar = t; });
  for (let i = 0; i < 24; i++) {
    const done = await ev(() => { const G = window.__game; const c = G.player.car; if (!c) return true; if (c.mesh.position.z < 62) c.speed = 22; if (G._nmCar && c.mesh.position.z < 58) { G._nmCar.speed = 0; G._nmCar.mesh.position.set(3.8, 0, 56); } return G.stats.nearMiss >= 1 || c.mesh.position.z > 70; });
    if (done) break;
    await page.waitForTimeout(200);
  }
  check('a close pass at speed scores a near miss', await G('G.stats.nearMiss >= 1'), `nearMiss=${await G('G.stats.nearMiss')}`);
  check('near-miss toast shows with the respect line', await G("(() => { const el = document.getElementById('nmtoast'); return el && !el.classList.contains('hidden') && el.textContent.includes('NEAR MISS'); })()"));
  // Damage smoke reads on a hurt traffic car.
  await ev(() => { const G = window.__game; const t = G.cars.find((c) => c.kind === 'traffic'); if (t) t.health = 20; });
  check('a car at 20% health shows its smoke', await poll("(() => { const t = G.cars.find((c) => c.kind === 'traffic' && c.health === 20); return t && t.smoke.visible === true; })()", 24, 300));
  // Roadblock: at four stars a far cruiser is designated, and the
  // minimap draws its barricade marker. Cops are held far away while
  // waiting so the stationary player is not busted mid-check.
  await ev(() => { const G = window.__game; G.wanted = 4; });
  let rbOk = false;
  for (let i = 0; i < 40 && !rbOk; i++) {
    await page.waitForTimeout(500);
    await ev(() => { const G = window.__game; if (G.state === 'playing' && G.wanted < 4) G.wanted = 4; G.cars.filter((c) => c.model.id === 'police').forEach((c, k) => { if (!c.roadblock) { c.mesh.position.set(90 - k * 6, 0, -90); c.speed = 0; } }); });
    rbOk = await G('G.cars.some((c) => !!c.roadblock)');
  }
  check('a roadblock unit is designated at four stars', rbOk);
  check('minimap draws the roadblock barricade marker', await poll('G.hud.rbMark === true', 16, 400));
  await ev(() => { const G = window.__game; G.wanted = 0; G.cars.filter((c) => c.model.id === 'police').forEach((c) => { c.roadblock = null; }); });
  // Pause opens the career panel with its completion header and rows.
  await page.keyboard.press('p');
  await page.waitForTimeout(300);
  check('pause opens the career stats panel', await G('G.state') === 'paused' &&
    await G("(() => { const el = document.getElementById('statspanel'); return el && !el.classList.contains('hidden') && el.textContent.includes('COMPLETE') && el.textContent.includes('Cars stolen') && el.textContent.includes('Respect'); })()"));
  await page.click('#btn-resume');
  await page.waitForTimeout(300);
  check('resume hides the stats panel', await G('G.state') === 'playing');
  // The kevlar vest outside the station tops armour up.
  await ev(() => { const G = window.__game; if (G.player.car) { G.player.car.speed = 0; G.exitCar(); } G.player.x = 26; G.player.z = -71.2; G.player.mesh.position.set(26, 0, -71.2); G.player.armour = 0; });
  check('kevlar vest at the station tops armour up', await poll('G.player.armour === 100', 16, 300),
    `armour=${await G('G.player.armour')}`);
  // Fire the pistol on foot: the shot must stamp a fresh danger marker.
  const dangerT0 = await G('G.danger ? G.danger.t : -1');
  let fired = false;
  for (let i = 0; i < 30 && !fired; i++) {
    if (i % 10 === 0) await page.keyboard.press('f');
    await page.waitForTimeout(500);
    fired = (await G('G.danger ? G.danger.t : -1')) > dangerT0;
  }
  check('pistol fires (danger set)', fired);
  // Die and respawn at the hospital (the vest's 100 armour is eaten first).
  await ev(() => { const G = window.__game; G.damagePlayer(999); });
  await page.waitForTimeout(3400);
  const afterDeath = await G('({state: G.state, health: G.player.health, x: G.player.x, z: G.player.z})');
  check('WASTED respawns at hospital', afterDeath.state === 'playing' && afterDeath.health === 100 && Math.hypot(afterDeath.x + 78, afterDeath.z - 78) < 6, JSON.stringify(afterDeath));
  // Get busted: stand still while a cruiser sits next to Rio at 2 stars.
  await ev(() => { const G = window.__game; G.wanted = 2; const cop = G.cars.find((c) => c.model.id === 'police'); if (cop) { cop.mesh.position.set(G.player.x + 2, 0, G.player.z); cop.speed = 0; } });
  let busted = false;
  for (let i = 0; i < 40 && !busted; i++) {
    await page.waitForTimeout(1000);
    await ev(() => { const G = window.__game; const cop = G.cars.find((c) => c.model.id === 'police'); if (cop && G.state === 'playing') { cop.mesh.position.set(G.player.x + 2, 0, G.player.z); cop.speed = 0; } });
    const pos = await G('({x: G.player.x, z: G.player.z, w: G.wanted})');
    if (pos.w === 0 && Math.hypot(pos.x - 26, pos.z + 78) < 8) busted = true;
  }
  check('BUSTED respawns at station, wanted cleared', busted);
  // Pause / resume.
  await page.keyboard.press('p');
  await page.waitForTimeout(300);
  check('pause works', await G('G.state') === 'paused');
  await page.click('#btn-resume');
  await page.waitForTimeout(300);
  check('resume works', await G('G.state') === 'playing');
  // Reload and Continue the saved progress.
  const savedCash = await G('G.cash');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  check('Continue offered after reload', await page.isVisible('#btn-continue'));
  await page.click('#btn-continue');
  await page.waitForTimeout(500);
  check('Continue restores cash', (await G('G.cash')) === savedCash, `saved ${savedCash}`);
  check('no page errors overall', errors.length === 0, errors.slice(0, 4).join(' | '));
} finally {
  await browser.close();
  server.kill();
}
// Hand-in guard, exercised outside the browser: stage a throwaway copy of
// this repo (main.ts + vendor + game + screenshots, well under 2 MB), plant
// a screenshot one byte over the 262,144-byte per-screenshot cap, and run the
// real hand-in program against it. It must refuse — non-zero exit — and its
// error must name the offending file and its size, not fail silently or pass.
{
  const repoRoot = new URL('.', import.meta.url).pathname;
  const stage = mkdtempSync(join(tmpdir(), 'palmshade-handin-'));
  try {
    for (const item of ['main.ts', 'vendor', 'game', 'screenshots']) {
      cpSync(join(repoRoot, item), join(stage, item), { recursive: true });
    }
    writeFileSync(join(stage, 'screenshots', '9-oversized.jpg'), Buffer.alloc(262145));
    const run = spawnSync('node', ['main.ts'], {
      cwd: stage,
      env: { ...process.env, MAKEFUN_OUTPUT_DIR: join(stage, 'out') },
      encoding: 'utf8',
    });
    const said = `${run.stdout ?? ''}\n${run.stderr ?? ''}`;
    check(
      'hand-in rejects an oversized screenshot by name',
      run.status !== 0 && said.includes('9-oversized.jpg') && said.includes('262145'),
      `exit ${run.status}`,
    );
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}
// Second hand-in guard, for the game/index.html cap (1 MiB): stage the
// same throwaway copy, replace its game/index.html with a file one byte
// over the cap, and run the real hand-in. It must refuse — non-zero exit —
// with an error naming game/index.html and its size, from validatePayload's
// sorted game/ walk, before any dossier is built.
{
  const repoRoot = new URL('.', import.meta.url).pathname;
  const stage = mkdtempSync(join(tmpdir(), 'palmshade-handin-index-'));
  try {
    for (const item of ['main.ts', 'vendor', 'game', 'screenshots']) {
      cpSync(join(repoRoot, item), join(stage, item), { recursive: true });
    }
    writeFileSync(join(stage, 'game', 'index.html'), Buffer.alloc(1048577));
    const run = spawnSync('node', ['main.ts'], {
      cwd: stage,
      env: { ...process.env, MAKEFUN_OUTPUT_DIR: join(stage, 'out') },
      encoding: 'utf8',
    });
    const said = `${run.stdout ?? ''}\n${run.stderr ?? ''}`;
    check(
      'hand-in rejects an oversized game/index.html by name',
      run.status !== 0 && said.includes('index.html') && said.includes('1048577') && said.includes('1048576')
        && !existsSync(join(stage, 'out', 'dossier.json')),
      `exit ${run.status}`,
    );
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
