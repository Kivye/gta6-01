// Palmshade Heat — boot, screen state machine and the game loop.
import { TUNING, HOSPITAL, STATION, rankFor } from './config.js';
import { makeRng } from './random.js';
import { Input } from './input.js';
import { GameAudio } from './audio.js';
import { loadSave, writeSave, clearSave, hasSave } from './save.js';
import { buildWorld } from './world.js';
import { spawnTraffic, updateVehicles } from './vehicles.js';
import { updatePeds, spawnPed } from './pedestrians.js';
import { createPlayer, updatePlayer, exitCar } from './player.js';
import { initPolice, updatePolice, setWanted, policeCars } from './police.js';
import { initCombat, updateCombat, damagePlayer } from './combat.js';
import { Missions } from './missions.js';
import { Hud } from './hud.js';
import { parseShot, stageScene } from './shots.js';

const shot = parseShot();
const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffb37a);
scene.fog = new THREE.Fog(0xffc38f, 55, 210);
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 600);
camera.position.set(0, 30, 130);
const sun = new THREE.DirectionalLight(0xffd9a8, 1.15);
sun.position.set(-60, 90, 40); scene.add(sun);
scene.add(new THREE.AmbientLight(0xffe0c0, 0.55));
const hemi = new THREE.HemisphereLight(0xffd9b0, 0x8a6a4a, 0.35); scene.add(hemi);

const G = {
  scene, camera, renderer, time: 0, state: 'menu', shake: 0, spawnCd: 0,
  cash: 250, completed: 0, missionIndex: 0, cars: [], peds: [], colliders: [],
  wanted: 0, wantedBlinking: false, hiddenT: 0, decayT: 0, bustT: 0, danger: null,
  nearCar: null, shotMode: null, rng: makeRng(shot ? shot.seed * 7919 : (Date.now() % 100000) + 7),
  audio: new GameAudio(),
};
G.rankName = () => rankFor(G.completed);
G.damagePlayer = (n) => damagePlayer(G, n);
window.__game = G; // debug/playtest handle; harmless in normal play
G.input = new Input(canvas, () => togglePause());
G.hud = new Hud(G);
initPolice(G); initCombat(G);
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
  P.mesh.position.set(P.x, 0, P.z);
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
  if (fresh) { G.cash = 250; G.completed = 0; G.missionIndex = 0; }
  else {
    const s = loadSave();
    if (s) { G.cash = s.cash; G.completed = s.completed; G.missionIndex = s.mission; }
  }
  const P = G.player;
  if (P.car) exitCar(G);
  P.x = 2; P.z = 100; P.angle = Math.PI; P.health = TUNING.playerHealth; P.mesh.visible = true;
  P.mesh.position.set(P.x, 0, P.z);
  P.mesh.rotation.y = P.angle; P.camYaw = Math.PI; P.camPitch = 0.32;
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
    bigEl.textContent = 'PAUSED'; bigEl.style.color = '#ffd23f'; bigEl.classList.remove('hidden', 'busted');
    subEl.textContent = 'Palmshade waits for no one. Well — just this once.'; subEl.classList.remove('hidden');
    resumeBtn.classList.remove('hidden');
    G.audio.setEngine(false, 0);
  } else if (G.state === 'paused') resumeGame();
}
function resumeGame() {
  if (G.state !== 'paused') return;
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
// The render loop: menu gets a slow orbit over the live city; shot mode freezes
// the tableau but keeps the police lights flashing; play runs every system.
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
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
    }
    G.hud.update(0);
  } else if (G.state === 'playing' || G.state === 'over') {
    if (G.state === 'playing') {
      updatePlayer(G, dt);
      updateCombat(G, dt);
      G.missions.update(dt);
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
