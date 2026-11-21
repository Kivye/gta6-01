// Playtest — 93 pemeriksaan.
import { readdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveDir, launchPage, sleep } from './cdp.mjs';

const root = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
function ok(c, name) { if (c) { pass++; console.log('PASS  ' + name); } else { fail++; console.log('FAIL  ' + name); } }

const srv = await serveDir(join(root, 'game'), 8081);
const page = await launchPage(800, 450);
const E = (expr) => page.ev(expr);
const B = async (expr) => !!(await E(expr));
const OB = async (expr, name) => ok(await B(expr), name);
const txt = (id) => E("document.getElementById('" + id + "').textContent");
const disp = (id) => E("document.getElementById('" + id + "').style.display");
async function waitFor(expr, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await B(expr)) return true; await sleep(200); }
  return false;
}
const WF = async (expr, name, ms) => ok(await waitFor(expr, ms || 6000), name);

try {
  await page.goto('http://localhost:8081/index.html');
  await E('localStorage.clear()');
  await page.goto('http://localhost:8081/index.html');
  await E('new Promise(r => { const t = setInterval(() => { if (window.PS && window.WORLD && WORLD.renderer) { clearInterval(t); r(1); } }, 100); })');
  await E('window.$d = (i) => document.getElementById(i)');
  await sleep(600);

  await OB('PS.errors().length === 0', 'boot: nol error halaman');
  ok(await disp('title') !== 'none', 'judul tampil');
  await E('PS.start()'); await sleep(300);
  await OB("G.mode === 'play'", 'mode play');
  await OB('PLAYER.mesh.visible && !G.playerCar', 'Rio berjalan kaki');
  ok((await txt('moneyLbl')) === '$350', 'label uang = $350 state');
  await OB("getComputedStyle(document.getElementById('mmap')).borderRadius === '50%'", 'minimap bulat');
  ok((await txt('districtLbl')) === 'OLD TOWN', 'distrik spawn Old Town');
  ok((await txt('standingLbl')).includes('NEUTRAL · 50'), 'standing NEUTRAL 50');
  const radio = await txt('radioTxt');
  ok(radio.includes('PALM 98.4') && radio.includes('Neon Palms'), 'radio PALM 98.4 + Neon Palms');
  await page.key('KeyR', true); await page.key('KeyR', false);
  await WF("AUDIO.station === 1 && $d('radioTxt').textContent.includes('SOL 101.9')", 'R: stasiun -> SOL 101.9');
  ok(await disp('missionPanel') === 'block' && (await txt('msnHead')).includes('REGENT RUN'), 'panel misi 1 Regent Run');
  await OB("document.querySelectorAll('#msnPips .pip').length === 2", 'pip misi 1 = 2');
  ok(await disp('dialogBox') === 'flex' && (await txt('dlgName')).includes('Mara Vale'), 'dialog: Mara Vale');
  ok((await txt('dlgLine')).includes('money on wheels'), 'dialog = intro misi 1');
  await OB('WORLD.marker.visible', 'kolom emas di limo');
  const s1 = await E("document.getElementById('slot1').textContent");
  ok(s1.includes('PISTOL') && s1.includes('∞') && s1.includes('READY'), 'slot1 PISTOL ∞ READY');
  const s2 = await E("document.getElementById('slot2').textContent");
  ok(s2.includes('MICRO SMG') && s2.includes('LOCKED'), 'slot2 SMG LOCKED');
  ok((await E("document.getElementById('slot3').textContent")).includes('PUMP SHOTGUN'), 'slot3 PUMP SHOTGUN');

  const z0 = await E('PLAYER.mesh.position.z');
  await E('INPUT.keys.KeyW = true');
  const walkOk = await waitFor('PLAYER.mesh.position.z > ' + (z0 + 1), 6000);
  await E('INPUT.keys.KeyW = false');
  ok(walkOk, 'jalan kaki menggerakkan Rio');
  await E('PS.teleport(-24.2, -3)');
  await OB("PLAYER.nearestCar() && PLAYER.nearestCar().car.def.name === 'Regent Limo'", 'mobil terdekat = limo');
  await page.key('KeyE', true); await page.key('KeyE', false); await sleep(300);
  await OB("!!G.playerCar && G.playerCar.def.name === 'Regent Limo'", 'E masuk limo');
  await OB('G.stats.stolen === 1', 'stats.stolen = 1');
  await OB("MSN.stage === 1 && G.playerCar.stolen === true", 'stage naik + mobil curian');
  await WF("$d('vehiclePanel').style.display === 'block' && $d('vehName').textContent.includes('Regent Limo')", 'panel kendaraan limo');
  await E('PS.teleport(-26, -3)'); await E('G.playerCar.heading = 0');
  await E('INPUT.keys.KeyW = true');
  const spdOk = await waitFor('G.playerCar.speed > 3', 6000);
  await E('INPUT.keys.KeyW = false');
  ok(spdOk, 'kecepatan limo > 3');
  await WF("$d('vehGear').textContent === 'D'", 'gigi D saat maju');
  await E('PS.teleport(-34, -13)');
  await WF("$d('fencePanel').style.display === 'block' && $d('fenceTxt').textContent.includes('West Chop Shop')", 'panel fence <25m West Chop');
  await OB("document.getElementById('fenceTxt').textContent.includes('$' + MSN.fenceValue(G.playerCar).toLocaleString('en-US'))", 'fence = fenceValue');
  await E('PS.teleport(-52, -13)'); await E('G.playerCar.speed = 0');
  await WF('MSN.current === 1', 'deliver fence: misi 1 tuntas');
  await OB('G.stats.sold === 1', 'stats.sold = 1');
  await OB('G.respect >= 120', 'respect >= 120');
  await WF("$d('rankLbl').textContent.includes('RUNNER')", 'gelar Runner tampil');
  await OB("G.standing['Old Town'] > 50", 'standing Old Town > 50');
  await WF("$d('storyLbl').textContent.includes('STORY 1/8')", 'STORY 1/8');

  await E('G.armour = 50'); await E('PLAYER.hurt(30)');
  await OB('G.armour === 20 && G.health === 100', 'armour serap 50->20');
  await E('PS.teleport(18.5, 8)');
  await WF('G.armour === 100', 'kevlar -> armour 100');
  await OB('WORLD.vest.available === false', 'rompi hilang');

  await E('COPS.setWanted(3)');
  ok(await waitFor('COPS.heli.active', 4000), 'wanted 3: AIR-1 naik');
  await WF("$d('dispatchPanel').style.display === 'block' && $d('dspHead').textContent.includes('PSPD DISPATCH')", 'dispatch PSPD DISPATCH');
  await WF("$d('dspRows').textContent.includes('AIR-1')", 'dispatch ada AIR-1');
  await WF("['IN SIGHT','LOSING THEM'].some(s => $d('sightChip').textContent.includes(s))", 'chip sight');
  await E('COPS.setWanted(4)');
  ok(await waitFor('!!COPS.roadblock', 9000), 'roadblock ditunjuk');
  await WF("$d('dspRows').textContent.includes('ROADBLOCK')", 'dispatch: ROADBLOCK');
  await E('COPS.setWanted(0)');
  await WF('!COPS.heli.active', 'wanted 0: heli turun');

  await E("(function(){ var c = CARS.spawn('sedan', 16, 14, 0, 'parked'); PLAYER.enterCar(c); return true; })()");
  await E('COPS.setWanted(2)'); await E("PS.key('KeyZ')"); await sleep(200);
  await OB('G.wanted === 1', 'SWAP PLATES 2->1');
  await OB("CREW.stateLabel(0) !== 'READY'", 'cooldown Nia berjalan');
  await E('G.playerCar.health = 40'); await E("PS.key('KeyX')"); await sleep(200);
  await OB('G.playerCar.health === 85', 'QUICK FIX 40->85');
  await E('G.flatTyre = true; CREW.members[1].cdUntil = 0'); await E("PS.key('KeyX')"); await sleep(200);
  await OB('G.flatTyre === false && G.playerCar.health === 100', 'QUICK FIX pulihkan ban');
  await E("PS.key('KeyC')"); await sleep(200);
  await OB('G.eyesOutUntil > G.time', 'EYES OUT aktif');
  await OB('G.stats.crew >= 3', 'stats.crew >= 3');

  await E("(function(){ for (var i = CARS.list.length - 1; i >= 0; i--) { var c = CARS.list[i]; if (c.kind === 'traffic' && Math.abs(c.mesh.position.x) < 30 && Math.abs(c.mesh.position.z - 7) < 30) CARS.remove(c); } CARS.spawn('compact', 3, 14, 0, 'parked'); G.playerCar.mesh.position.set(0, 0, -8); G.playerCar.heading = 0; G.playerCar.speed = 0; G.nitro = 10; return true; })()");
  await E('INPUT.keys.KeyW = true');
  const nmOk = await waitFor('G.stats.nearMiss >= 1', 6000);
  await E('INPUT.keys.KeyW = false');
  ok(nmOk, 'near-miss terhitung');
  await OB("G.lastToast.indexOf('NEAR MISS') === 0", 'toast NEAR MISS');
  await OB('G.nitro >= 25', 'near-miss +15 nitro');
  await E("(function(){ var c = CARS.spawn('compact', 8, 30, 0, 'parked'); CARS.damage(c, 80); window.__smk = c; return true; })()");
  await OB('window.__smk.refs.smoke.visible === true && window.__smk.health === 20', 'mobil health 20 berasap');
  await page.key('KeyP', true); await page.key('KeyP', false); await sleep(300);
  ok(await B('G.paused') && await disp('pausePanel') === 'block', 'jeda terbuka');
  ok((await txt('pauseTxt')).includes('Cars stolen'), 'jeda: baris mobil dicuri');
  const ptxt = await txt('pauseTxt');
  ok(ptxt.includes('Respect') && ptxt.includes('Runner'), 'jeda: Respect + gelar');
  await page.key('KeyP', true); await page.key('KeyP', false); await sleep(200);
  await OB('!G.paused', 'jeda tertutup');

  await E("if (G.playerCar) PLAYER.exitCar(); PS.teleport(12, 82)");
  await WF("$d('shopPanel').style.display === 'block'", 'panel Gun Van tampil');
  await E('G.money = 5000'); await E("PS.key('Digit1')"); await sleep(200);
  await OB('G.ownSmg && G.ammoSmg === 120 && G.money === 4200', 'beli SMG $800');
  await E("PS.key('Digit2')"); await sleep(200);
  await OB('G.ownShotgun && G.ammoShot === 24 && G.money === 3000', 'beli Shotgun $1200');
  await E('G.ammoSmg = 37'); await E("PS.key('Digit3')"); await sleep(200);
  await OB('G.ammoSmg === 120 && G.money === 2850', 'refill $150 penuh');
  await E('G.armour = 10'); await E("PS.key('Digit4')"); await sleep(200);
  await OB('G.armour === 100 && G.money === 2550', 'kevlar $300 -> 100');
  await E('PS.teleport(0, 60)'); await waitFor('!G.shopOpen', 4000); await E("PS.key('Digit2')");
  await WF("G.slot === 2 && $d('slot2').className.includes('active')", 'slot 2 aktif');
  await E('INPUT.mouseDown = true');
  const fireOk = await waitFor('G.ammoSmg < 120', 5000);
  await E('INPUT.mouseDown = false');
  ok(fireOk, 'tembak SMG: ammo turun');
  await E("(function(){ var c = CARS.spawn('sedan', 2, 62, 0, 'parked'); PLAYER.enterCar(c); return true; })()");
  const ammoBeforeDb = await E('G.ammoSmg');
  await E('INPUT.mouseDown = true');
  const dbOk = await waitFor('G.ammoSmg < ' + ammoBeforeDb, 4000);
  await E('INPUT.mouseDown = false');
  ok(dbOk, 'drive-by SMG: ammo turun');
  await E("PS.key('Digit3')"); await sleep(100);
  await E('INPUT.mouseDown = true');
  const sgOk = await waitFor("G.lastEvent === 'NO DRIVE-BY'", 4000);
  await E('INPUT.mouseDown = false');
  ok(sgOk && await B('G.ammoShot === 24'), 'drive-by shotgun ditolak');
  await E("PS.key('KeyE')"); await sleep(300);
  await E('INPUT.mouseDown = true');
  const shellOk = await waitFor('G.ammoShot === 23', 5000);
  await E('INPUT.mouseDown = false');
  ok(shellOk, 'shotgun: 1 tembak 1 selongsong');
  await OB('GUNS.damageAt(3, 30) < GUNS.damageAt(3, 5)', 'shotgun falloff jarak');
  await E('G.ammoSmg = 50'); await E('(function(){ var p = PLAYER.mesh.position; GUNS.dropPickup(p.x, p.z); GUNS.pickups[GUNS.pickups.length - 1].kind = "smg"; return true; })()');
  ok(await waitFor('G.ammoSmg === 80', 3000), 'pickup ammo +30');

  await E('MSN.start(5)'); await sleep(300);
  await OB("MSN.defs[5].name === 'Harbor Heist' && !!MSN.targetCar && MSN.targetCar.key === 'truck'", 'misi 6: truk muncul');
  await OB('MSN.escorts.length === 2', '2 pengawal truk');
  await E('MSN.start(6)'); await sleep(200);
  await OB('G.wantedLock === 4', 'misi 7: lock 4 bintang');
  await E('MSN.start(7)'); await sleep(200);
  await OB("MSN.defs[7].name === 'Palmshade Takeover' && !!MSN.targetCar && !!MSN.targetCar.commander", 'misi 8: komandan muncul');
  await E('CARS.damage(MSN.targetCar, 9999)');
  await WF('MSN.stage === 1 && G.wantedLock === 5', 'komandan tumbang: lock 5');
  ok(await waitFor('!!COPS.swat', 4000), 'SWAT-1 turun');
  await E('PLAYER.mesh.position.set(-16, 0, 100)');
  await WF('MSN.current === 8 && G.storyDone === 8', 'STORY 8/8 tuntas');
  await OB("G.respect >= 1200 && respectTitle(G.respect) === 'Palmshade Legend'", 'gelar Legend');

  await E('G.money = 2000');
  await E("(function(){ COPS.setWanted(0); var c = CARS.spawn('cabrio', -52, -1, Math.PI, 'parked'); PLAYER.enterCar(c); return true; })()");
  await E("PS.key('KeyT')"); await sleep(300);
  await OB('!!ULTRA.race && G.money === 1500', 'balapan mulai, bet terpotong');
  await WF("$d('racePanel').style.display === 'block' && $d('crewPanel').style.display === 'none'", 'panel race ganti panel kru');
  await WF("$d('racePanel').textContent.includes('POS') && $d('racePanel').textContent.includes('CHECKPOINT')", 'panel race POS+CP');
  await E('G.nitro = 80'); await E('INPUT.keys.ShiftLeft = true; INPUT.keys.KeyW = true');
  const nitroOk = await waitFor('G.nitro < 80', 5000);
  const nitroAfter = await E('G.nitro');
  await E('INPUT.keys.ShiftLeft = false; INPUT.keys.KeyW = false');
  ok(nitroOk && nitroAfter < 80, 'nitro terkuras oleh Shift');
  await E("(function(){ ULTRA.race.idx = ULTRA.race.def.pts.length - 1; G.playerCar.mesh.position.set(-52, 0, 0); G.playerCar.speed = 0; return true; })()");
  await WF('!ULTRA.race && G.money === 2500 && G.stats.racesWon === 1', 'menang race: bayar 2x');

  await E('G.money = 10000'); await E('PS.teleport(-44, 92)'); await E("PS.key('KeyB')"); await sleep(200);
  await OB("G.props.includes('pier') && G.money === 6000", 'beli Pier Club');
  await E('ULTRA.incomeT = 59.5');
  await WF('G.money > 6000', 'income properti jalan');
  await E('PS.teleport(6, 45)'); await E('G.money = 1000; G.flatTyre = true'); await E("PS.key('KeyY')"); await sleep(200);
  await OB('G.flatTyre === false && G.money === 900', 'respray $100 + ban pulih');
  await E("(function(){ COPS.units.slice().forEach(function(u){ CARS.remove(u); }); COPS.units = []; COPS.setWanted(2); G.garageTrimUsed = false; G.sight.seen = false; G.sight.t = 0; return true; })()");
  await E("PS.key('KeyY')");
  await WF('G.wanted === 1 && G.money === 800', 'respray: wanted -1');
  await E("PS.key('KeyU')"); await sleep(200);
  await OB("!!G.fav && G.fav.key === 'cabrio'", 'favorit tersimpan');
  await E("PS.key('KeyE')"); await sleep(200); await E("PS.key('KeyU')"); await sleep(300);
  await OB("CARS.list.some(function(c){ return c.kind === 'fav'; })", 'favorit diambil lagi');

  await E("PS.key('KeyN')");
  await WF('WORLD.nightF > 0.3', 'Neon Night naik', 8000);
  await OB('WORLD.rainCount === 260 && !!ULTRA.spawnCashVan()', 'hujan 260 + cash van');
  const moneyBeforeLoot = await E('G.money'), wantedBeforeLoot = await E('G.wanted');
  await E("(function(){ var v = ULTRA.cashVan; v.health = 30; if (G.playerCar) PLAYER.exitCar(); PLAYER.mesh.position.set(v.mesh.position.x + 1.5, 0, v.mesh.position.z); return true; })()");
  await E("PS.key('KeyE')"); await sleep(300);
  ok(await B('G.money > ' + moneyBeforeLoot + ' && G.wanted === ' + Math.min(5, wantedBeforeLoot + 2)), 'cash van dibajak');

  let total = 0;
  async function walk(dir, skip) {
    for (const name of await readdir(dir)) {
      if (skip.includes(name)) continue;
      const p = join(dir, name), s = await stat(p);
      if (s.isDirectory()) await walk(p, skip); else total += s.size;
    }
  }
  await walk(join(root, 'game'), ['vendor']);
  for (const f of ['main.ts', 'serve.ts', 'README.md', 'shots.json', 'shots.mjs', 'playtest.mjs', 'cdp.mjs']) total += (await stat(join(root, f))).size;
  ok(total <= 158000, 'guard ukuran: total source sendiri ' + total + ' byte <= 158.000');
} catch (err) {
  fail++;
  console.log('SUITE ERROR: ' + (err && err.message));
} finally {
  await page.close();
  srv.close();
}
console.log('---');
console.log('PLAYTEST: ' + pass + ' PASS, ' + fail + ' FAIL, total ' + (pass + fail) + ' pemeriksaan');
process.exit(fail ? 1 : 0);
