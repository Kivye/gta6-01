// Pedestrians: low-poly figures who stroll the sidewalk bands, scatter
// with a floating "!" when danger lands near them, and — for the gang
// subset — stand their ground and let combat.js drive their gunfire.
import { WORLD, CITY_EDGE } from './config.js';
import { rngPick, clamp, dist2d } from './random.js';
import { snapToRoad, insideBuilding } from './world.js';

const SHIRTS = [0xff6b6b, 0x4ecdc4, 0xffe66d, 0x95e06c, 0xf7a8d8, 0x7aa2f7, 0xffffff, 0xff9f43];
const SKINS = [0xf2c49b, 0xc68642, 0x8d5524, 0xffdbac];

export function makePedMesh(G, isGang = false) {
  const g = new THREE.Group();
  const shirt = isGang ? 0x8e24aa : rngPick(G.rng, SHIRTS);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.72, 0.3), new THREE.MeshLambertMaterial({ color: shirt }));
  body.position.y = 0.95; g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.3), new THREE.MeshLambertMaterial({ color: rngPick(G.rng, SKINS) }));
  head.position.y = 1.5; g.add(head);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.6, 0.27), new THREE.MeshLambertMaterial({ color: 0x2e3a52 }));
  legs.position.y = 0.3; g.add(legs);
  const bangGeo = new THREE.PlaneGeometry(0.5, 0.62);
  const bang = new THREE.Mesh(bangGeo, new THREE.MeshBasicMaterial({ color: 0xffe23f, transparent: true, opacity: 0, side: THREE.DoubleSide }));
  bang.position.y = 2.1; g.add(bang);
  // Draw a "!" on a tiny canvas so the marker needs no font asset.
  const cv = document.createElement('canvas'); cv.width = 32; cv.height = 40;
  const cx = cv.getContext('2d'); cx.fillStyle = '#ffe23f'; cx.font = 'bold 34px sans-serif'; cx.textAlign = 'center'; cx.fillText('!', 16, 32);
  bang.material.map = new THREE.CanvasTexture(cv); bang.material.needsUpdate = true;
  bang.visible = false; // transparent until a ped flees; skip its draw call till then
  return { group: g, bang, legs };
}

export function spawnPed(G, x, z, opts = {}) {
  const parts = makePedMesh(G, !!opts.gang);
  parts.group.position.set(x, 0, z);
  G.scene.add(parts.group);
  const ped = {
    mesh: parts.group, bang: parts.bang, legs: parts.legs,
    angle: G.rng() * 6.28, speed: 0, walkSpeed: 1.1 + G.rng() * 0.9,
    target: null, fleeT: 0, dead: false, gang: !!opts.gang, health: opts.gang ? 60 : 20,
    shootCd: 0, driverOf: opts.driverOf || null, phase: G.rng() * 6.28,
  };
  G.peds.push(ped);
  return ped;
}
export function removePed(G, ped) {
  G.scene.remove(ped.mesh);
  const i = G.peds.indexOf(ped); if (i >= 0) G.peds.splice(i, 1);
}
function sidewalkTarget(G, ped) {
  // A stroll target on a pavement band: along one road centreline,
  // offset sideways by a little more than the road's half width.
  const horiz = G.rng() < 0.5;
  const c = snapToRoad((G.rng() * 2 - 1) * CITY_EDGE);
  const side = (G.rng() < 0.5 ? -1 : 1) * (WORLD.roadHalf + 1.1 + G.rng() * 0.7);
  const along = clamp((horiz ? ped.mesh.position.x : ped.mesh.position.z) + (G.rng() * 70 - 35), -CITY_EDGE - 8, CITY_EDGE + 8);
  return horiz ? { x: along, z: c + side } : { x: c + side, z: along };
}
export function updatePeds(G, dt) {
  const px = G.player.x, pz = G.player.z;
  for (const ped of [...G.peds]) {
    if (ped.dead) continue;
    const p = ped.mesh.position;
    let danger = null;
    if (G.danger && G.time - G.danger.t < 2.5 && dist2d(p.x, p.z, G.danger.x, G.danger.z) < 13) danger = G.danger;
    const fastCar = G.player.car && Math.abs(G.player.car.speed) > 9 && dist2d(p.x, p.z, px, pz) < 8 && !isSidewalkSafe(p.x, p.z);
    if (danger || fastCar) ped.fleeT = Math.max(ped.fleeT, 1.6);
    ped.bang.material.opacity = ped.fleeT > 0 ? 1 : Math.max(0, ped.bang.material.opacity - dt * 3);
    ped.bang.visible = ped.bang.material.opacity > 0.02;
    ped.bang.lookAt(G.camera.position.x, 2.1, G.camera.position.z);
    if (ped.gang) continue; // gang members are driven by combat.js
    if (ped.fleeT > 0) {
      ped.fleeT -= dt;
      const src = danger || { x: px, z: pz };
      const away = Math.atan2(p.x - src.x, p.z - src.z);
      ped.angle = away;
      movePed(G, ped, dt, 3.6);
    } else {
      if (!ped.target || dist2d(p.x, p.z, ped.target.x, ped.target.z) < 1.2) ped.target = sidewalkTarget(G, ped);
      ped.angle = Math.atan2(ped.target.x - p.x, ped.target.z - p.z);
      movePed(G, ped, dt, ped.walkSpeed);
    }
    ped.mesh.rotation.y = ped.angle;
    ped.phase += dt * (ped.fleeT > 0 ? 13 : 7);
    ped.legs.position.y = 0.3 + Math.abs(Math.sin(ped.phase)) * 0.07;
    ped.mesh.position.y = Math.abs(Math.sin(ped.phase)) * 0.04;
    if (dist2d(p.x, p.z, px, pz) > 160) removePed(G, ped);
  }
  // Keep the sidewalks alive near Rio.
  if (G.peds.filter((p) => !p.gang).length < 22 && G.state === 'playing') {
    const a = G.rng() * Math.PI * 2, r = 34 + G.rng() * 40;
    const x = clamp(px + Math.sin(a) * r, -CITY_EDGE - 6, CITY_EDGE + 6);
    const z = clamp(pz + Math.cos(a) * r, -CITY_EDGE - 6, 112);
    const horiz = G.rng() < 0.5, side = (G.rng() < 0.5 ? -1 : 1) * 5.6;
    spawnPed(G, horiz ? x : snapToRoad(x) + side, horiz ? snapToRoad(z) + side : z);
  }
}
function isSidewalkSafe(x, z) {
  const s = WORLD.step;
  const off = (v) => Math.abs(v - Math.round(v / s) * s);
  return off(x) > WORLD.roadHalf + 0.5 && off(z) > WORLD.roadHalf + 0.5;
}
function movePed(G, ped, dt, speed) {
  const p = ped.mesh.position;
  const nx = p.x + Math.sin(ped.angle) * speed * dt;
  const nz = p.z + Math.cos(ped.angle) * speed * dt;
  if (!insideBuilding(G.colliders, nx, nz, 0.3)) { p.x = nx; p.z = nz; }
  else ped.target = null;
  p.x = clamp(p.x, -CITY_EDGE - 12, CITY_EDGE + 12);
  p.z = clamp(p.z, -CITY_EDGE - 12, 116);
}
export function nearestPed(G, x, z, maxD) {
  let best = null, bd = maxD;
  for (const ped of G.peds) {
    if (ped.dead) continue;
    const d = dist2d(x, z, ped.mesh.position.x, ped.mesh.position.z);
    if (d < bd) { bd = d; best = ped; }
  }
  return best;
}
