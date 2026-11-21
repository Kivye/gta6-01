// Palmshade Heat — boot, the screen state machine and the game loop.
// Owns the shared state object G: progression (cash, missions, respect,
// standing, career stats), the pause screen with its career panel, the
// crew/radio key bindings, and the respawn sweeps that keep a fresh run
// from inheriting a dead run's timers.
import { TUNING, HOSPITAL, STATION, respectRank } from './config.js';
import { makeRng } from './random.js';
import { Input } from './input.js';
import { GameAudio } from './audio.js';
import { loadSave, writeSave, clearSave, hasSave, freshStats, freshStanding } from './save.js';
import { buildWorld } from './world.js';
import { spawnTraffic, updateVehicles } from './vehicles.js';
import { updatePeds, spawnPed } from './pedestrians.js';
import { createPlayer, updatePlayer, exitCar } from './player.js';
import { initPolice, updatePolice, setWanted, policeCars, updateHeli } from './police.js';
import { initCombat, updateCombat, damagePlayer } from './combat.js';
import { Missions } from './missions.js';
import { Hud } from './hud.js';
import { initCrew, useCrew } from './crew.js';
import { parseShot, stageScene } from './shots.js';

const shot = parseShot();
const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
// Fill cost scales with pixel count and this scene is only ~5k triangles,
// so the pixel ratio is the lever that matters: cap at 1.5 (not 2), and
// let the adaptive monitor in the frame loop step it down on slow kit.
const BASE_PIXEL_RATIO = Math.min(devicePixelRatio, 1.5);
renderer.setPixelRatio(BASE_PIXEL_RATIO);
renderer.setSize(innerWidth, innerHeight);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffb37a); // buildWorld paints the gradient over this
scene.fog = new THREE.Fog(0xffc38f, 55, 210);
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 600);
camera.position.set(0, 30, 130);
const sun = new THREE.DirectionalLight(0xffd9a8, 1.15);
sun.position.set(-60, 90, 40); scene.add(sun);
scene.add(new THREE.AmbientLight(0xffe0c0, 0.55));
const hemi = new THREE.HemisphereLight(0xffd9b0, 0x8a6a4a, 0.35); scene.add(hemi);

const G = {
  scene, camera, renderer, time: 0, state: 'menu', shake: 0, spawnCd: 0,
  cash: 250, completed: 0, missionIndex: 0, respect: 0,
  standing: freshStanding(), stats: freshStats(),
  cars: [], peds: [], colliders: [],
  wanted: 0, wantedBlinking: false, hiddenT: 0, decayT: 0, bustT: 0, danger: null,
  nearCar: null, shotMode: null, rng: makeRng(shot ? shot.seed * 7919 : (Date.now() % 100000) + 7),
  audio: new GameAudio(),
};
G.rankName = () => respectRank(G.respect || 0);
// Career completion, one fixed formula: the story is worth 70, a
// friendly-or-better map is worth 20 shared across the districts, and
// the first ten cars stolen share the last 10.
G.completionPct = () => G.completed / 5 * 70 +
  Object.values(G.standing).filter((v) => v > 60).length / 3 * 20 +
  Math.min(10, G.stats.stolen) / 10 * 10;
G.damagePlayer = (n) => damagePlayer(G, n);
window.__game = G; // debug/playtest handle; harmless in normal play
// Adaptive quality state, driven by the frame loop below. Levels are
// fixed multipliers on BASE_PIXEL_RATIO; the monitor only steps DOWN.
const quality = { level: 0, lastAvgMs: 0, accMs: 0, frames: 0 };
const QUALITY_FACTORS = [1, 0.75, 0.5];
G.quality = quality;
G.input = new Input(canvas, () => togglePause());
G.hud = new Hud(G);
initPolice(G); initCombat(G); initCrew(G);
buildWorld(G);
createPlayer(G);
G.missions = new Missions(G);
G.exitCar = () => exitCar(G);
spawnTraffic(G, 10);
for (let i = 0; i < 14; i++) {
  const horiz = G.rng() < 0.5, side = (G.rng() < 0.5 ? -1 : 1) * 5.6;
  const rx = (G.rng() * 2 - 1) * 90, rz = (G.rng() * 2 - 1) * 90;
  spawnPed(G, horiz ? rx : Math.round(rx / 26) * 26 + side, horiz ? Math.round(rz / 26) * 26 + side : rz);
}
G.onWasted = () => {
  if (G.state !== 'playing') return;
  G.state = 'over';
  const fine = Math.round(G.cash * 0.10);
  G.cash -= fine;
  showBig('WASTED', `Hospital bill: -$${fine}. The mission restarts.`, '#e33');
  G.audio.fail(); G.audio.setEngine(false, 0); G.audio.setSiren(false, 0);
  setTimeout(() => {
    respawn(HOSPITAL);
    G.missions.fail('Rio was wasted.');
  }, 2600);
};
G.onBusted = () => {
  if (G.state !== 'playing') return;
  G.state = 'over';
  const fine = Math.round(G.cash * 0.15);
  G.cash -= fine;
  showBig('BUSTED', `Fine: -$${fine}. The heat lets you walk — this time.`, '#7db4ff', true);
  G.audio.fail(); G.audio.setEngine(false, 0); G.audio.setSiren(false, 0);
  setTimeout(() => {
    respawn(STATION);
    if (G.missions.active) G.missions.fail('Rio got busted.');
  }, 2600);
};
function respawn(place) {
  const P = G.player;
  if (P.car) { const c = P.car; P.car = null; c.kind = 'parked'; c.speed = 0; G.hud.hideVehicle(); }
  P.mesh.visible = true;
  P.x = place.x; P.z = place.z; P.health = TUNING.playerHealth; P.dead = false;
  P.armour = 40; // the hospital and the station both hand Rio a vest
  P.mesh.position.set(P.x, 0, P.z);
  // setWanted(G, 0) only zeroes the star count: police.js clears the
  // pursuit timers solely when the new level is above zero, and bustT is
  // not cleared there at all — so a grab timer part-way to TUNING.bustTime
  // when Rio died would survive the respawn and, since updatePolice never
  // decays bustT at wanted 0, greet the next episode almost fully charged.
  // A respawn is a fresh run; sweep the timers like startGame does. The
  // stale danger marker and blinking flag go too, so pedestrians do not
  // flee the spawn pad and the HUD does not blink stars Rio no longer has.
  G.bustT = 0; G.hiddenT = 0; G.decayT = 0; G.lastSeenT = 0;
  G.danger = null; G.wantedBlinking = false; G.peakWanted = 0;
  // Second half of the sweep: a leftover camera shake, a pistol still on
  // cooldown, or a police spawn cooldown would all bleed into the first
  // seconds back on the street.
  G.shake = 0; G.fireCd = 0; G.recoil = 0; G.spawnCd = 0;
  setWanted(G, 0);
  for (const cop of policeCars(G)) cop.speed = 0;
  hideOverlay();
  G.state = 'playing';
  writeSave(G);
}
const overlay = document.getElementById('overlay');
const menuEl = document.getElementById('menu');
const bigEl = document.getElementById('bigtext');
const subEl = document.getElementById('subtext');
const resumeBtn = document.getElementById('btn-resume');
function showBig(text, sub, color, busted = false) {
  menuEl.classList.add('hidden'); resumeBtn.classList.add('hidden');
  bigEl.textContent = text; bigEl.style.color = color;
  bigEl.classList.toggle('busted', busted); bigEl.classList.remove('hidden');
  subEl.textContent = sub; subEl.classList.remove('hidden');
  overlay.classList.remove('clear'); overlay.classList.add('solid');
}
function hideOverlay() {
  overlay.classList.add('clear'); overlay.classList.remove('solid');
  bigEl.classList.add('hidden'); subEl.classList.add('hidden'); resumeBtn.classList.add('hidden');
  menuEl.classList.add('hidden');
}
function showMenu() {
  G.state = 'menu';
  overlay.classList.remove('clear', 'solid');
  menuEl.classList.remove('hidden');
  bigEl.classList.add('hidden'); subEl.classList.add('hidden'); resumeBtn.classList.add('hidden');
  document.getElementById('btn-continue').style.display = hasSave() ? '' : 'none';
  document.getElementById('menunote').textContent = hasSave() ? 'A save was found — Continue picks up your story.' : '';
  G.hud.hide();
}
function startGame(fresh) {
  G.audio.unlock();
  if (fresh) {
    G.cash = 250; G.completed = 0; G.missionIndex = 0; G.respect = 0;
    G.standing = freshStanding(); G.stats = freshStats();
    G.player.armour = 0;
  } else {
    const s = loadSave();
    if (s) {
      G.cash = s.cash; G.completed = s.completed; G.missionIndex = s.mission;
      G.respect = s.respect; G.standing = s.standing; G.stats = s.stats;
      G.player.armour = s.armour;
    }
  }
  initCrew(G); // cooldowns never carry across runs
  const P = G.player;
  if (P.car) exitCar(G);
  // setWanted(G, 0) below only zeroes the stars (see respawn): reset the
  // pursuit timers explicitly or a half-charged bust follows Rio in.
  G.bustT = 0; G.hiddenT = 0; G.decayT = 0; G.lastSeenT = 0; G.peakWanted = 0;
  P.x = 2; P.z = 100; P.angle = Math.PI; P.health = TUNING.playerHealth; P.mesh.visible = true;
  P.mesh.position.set(P.x, 0, P.z);
  P.mesh.rotation.y = P.angle; P.camYaw = Math.PI; P.camPitch = 0.32;
  // Same leftover-state sweep, second half: stale danger, shake, fire
  // cooldown, a dead flag, and the engine/siren loops of a previous run.
  G.danger = null; G.shake = 0; G.spawnCd = 0; G.fireCd = 0;
  P.dead = false; P.walkPhase = 0;
  G.audio.setEngine(false, 0); G.audio.setSiren(false, 0);
  setWanted(G, 0);
  hideOverlay();
  G.hud.show();
  G.state = 'playing';
  G.input.playing = true;
  G.missions.start(G.missionIndex);
  writeSave(G);
}
function togglePause() {
  if (G.state === 'playing') {
    G.state = 'paused';
    overlay.classList.remove('clear'); overlay.classList.add('solid');
    menuEl.classList.add('hidden');
    // The pause screen IS the career panel now: its own header carries
    // the word PAUSED, so the giant overlay text stays hidden — and the
    // panel (inside the pointer-events-free HUD) never blocks Resume.
    bigEl.classList.add('hidden'); subEl.classList.add('hidden');
    G.hud.showStats(G);
    resumeBtn.classList.remove('hidden');
    G.audio.setEngine(false, 0);
  } else if (G.state === 'paused') resumeGame();
}
function resumeGame() {
  if (G.state !== 'paused') return;
  G.hud.hideStats();
  hideOverlay(); G.state = 'playing';
}
document.getElementById('btn-start').addEventListener('click', () => startGame(true));
document.getElementById('btn-continue').addEventListener('click', () => startGame(false));
document.getElementById('btn-reset').addEventListener('click', () => {
  clearSave();
  document.getElementById('menunote').textContent = 'Save cleared.';
  document.getElementById('btn-continue').style.display = 'none';
});
document.getElementById('btn-how').addEventListener('click', () => {
  document.getElementById('howto').classList.toggle('hidden');
});
resumeBtn.addEventListener('click', resumeGame);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
addEventListener('keydown', (e) => {
  if (e.code === 'KeyM') { const m = G.audio.toggleMute(); if (G.state === 'playing') G.hud.banner(m ? 'SOUND OFF' : 'SOUND ON', '', 1.2); }
  if (G.state !== 'playing') return;
  if (e.code === 'KeyR') { const st = G.audio.cycleStation(); G.hud.showEvent(st.name, st.genre); }
  else if (e.code === 'KeyZ') useCrew(G, 'plates');
  else if (e.code === 'KeyX') useCrew(G, 'fix');
  else if (e.code === 'KeyC') useCrew(G, 'eyes');
});
if (shot) {
  G.state = 'playing';
  G.hud.show();
  menuEl.classList.add('hidden');
  overlay.classList.add('clear');
  stageScene(G, shot.scene);
} else {
  showMenu();
}
// The render loop: the menu gets a slow orbit over the live city; shot
// mode freezes the tableau but keeps lights, rotors and sirens alive;
// play runs every system.
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const rawMs = now - last;
  const dt = Math.min(0.05, rawMs / 1000); last = now;
  // Adaptive quality insurance for unknown hardware: average the raw
  // frame time over a ~2 s window; if it stays above 24 ms, step the
  // pixel ratio down one fixed notch (1x -> 0.75x -> 0.5x of base).
  // Deterministic — fixed window, threshold and steps — and it never
  // steps back up mid-session.
  if (G.state !== 'paused') {
    quality.accMs += rawMs; quality.frames++;
    if (quality.accMs >= 2000) {
      quality.lastAvgMs = quality.accMs / quality.frames;
      if (quality.lastAvgMs > 24 && quality.level < QUALITY_FACTORS.length - 1) {
        quality.level++;
        renderer.setPixelRatio(Math.max(0.5, BASE_PIXEL_RATIO * QUALITY_FACTORS[quality.level]));
      }
      quality.accMs = 0; quality.frames = 0;
    }
  }
  if (G.state === 'paused') { renderer.render(scene, camera); return; }
  G.time += dt;
  G.shake = Math.max(0, G.shake - dt * 1.4);
  if (G.sea) G.sea.position.y = 0.02 + Math.sin(G.time * 0.7) * 0.05;
  if (G.state === 'menu') {
    const a = G.time * 0.05;
    camera.position.set(Math.sin(a) * 95, 34, Math.cos(a) * 95);
    camera.lookAt(0, 4, 20);
    updateVehicles(G, dt * 0.4);
    updatePeds(G, dt * 0.4);
  } else if (G.shotMode) {
    for (const car of G.cars) if (car.lightBar) {
      const on = Math.sin(G.time * 7) > 0;
      car.lightBar.children[0].material.color.setHex(on ? 0xff6666 : 0x881111);
      car.lightBar.children[1].material.color.setHex(on ? 0x113388 : 0x6688ff);
      if (car.sirenGlow) car.sirenGlow.material.color.setHex(on ? 0xff2222 : 0x2255ff);
    }
    if (G.heli) updateHeli(G, dt);
    G.hud.update(0);
  } else if (G.state === 'playing' || G.state === 'over') {
    if (G.state === 'playing') {
      updatePlayer(G, dt);
      updateCombat(G, dt);
      G.missions.update(dt);
      // Career distance and top speed, sampled from the driven car.
      if (G.player.car) {
        const s = Math.abs(G.player.car.speed);
        G.stats.distKm += s * dt / 1000;
        if (s * 3.6 > G.stats.topSpeed) G.stats.topSpeed = s * 3.6;
      }
    }
    updateVehicles(G, dt);
    updatePeds(G, dt);
    updatePolice(G, dt);
    G.hud.update(dt);
    G.audio.updateMusic(dt, G.state === 'playing');
  }
  G.input.endFrame();
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
