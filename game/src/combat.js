// Hitscan pistol with gentle aim assist, muzzle flash and recoil, gang
// return fire — and the single damage gate for the player, where the
// kevlar armour value absorbs its share before health is touched.
import { clamp, dist2d } from './random.js';
import { districtAt } from './config.js';
import { removePed } from './pedestrians.js';
import { policeCars, ensureCallsign } from './police.js';

export function initCombat(G) {
  G.fireCd = 0; G.recoil = 0;
  G.tracer = null;
}
export function damagePlayer(G, amount) {
  if (G.state !== 'playing' || G.player.dead) return;
  const P = G.player;
  // Armour first: the vest eats what it can, health takes the rest.
  const absorbed = Math.min(P.armour || 0, amount);
  P.armour = (P.armour || 0) - absorbed;
  P.health -= amount - absorbed;
  G.shake = Math.max(G.shake, 0.18);
  if (P.health <= 0) { P.health = 0; G.onWasted(); }
}
function nearestHostileAhead(G, maxD, maxAngle) {
  const P = G.player;
  const facing = P.car ? P.car.angle : P.camYaw + Math.PI;
  let best = null, bd = maxD;
  const consider = (x, z, obj) => {
    const d = dist2d(P.x, P.z, x, z);
    if (d > bd) return;
    const ang = Math.atan2(x - P.x, z - P.z);
    const diff = Math.abs(((ang - facing + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    if (diff < maxAngle) { bd = d; best = obj; }
  };
  for (const ped of G.peds) if (ped.gang && !ped.dead) consider(ped.mesh.position.x, ped.mesh.position.z, { ped });
  for (const car of G.cars) if (car.missionHostile && !car.dead) consider(car.mesh.position.x, car.mesh.position.z, { car });
  return best;
}
export function tryFire(G) {
  if (G.fireCd > 0 || G.player.car) return;
  G.fireCd = 0.26; G.recoil = 1;
  G.stats.shots++;
  G.audio.shot();
  G.hud.flashMuzzle();
  G.crime('shooting', G.player.x, G.player.z);
  G.danger = { x: G.player.x, z: G.player.z, t: G.time };
  // Dispatch hears gunfire while Rio is wanted — at most one report per
  // six seconds, filed by the nearest cruiser.
  if (G.wanted > 0 && G.time - (G.lastShotReport || -9) > 6) {
    G.lastShotReport = G.time;
    const cops = policeCars(G).sort((a, b) =>
      dist2d(G.player.x, G.player.z, a.mesh.position.x, a.mesh.position.z) -
      dist2d(G.player.x, G.player.z, b.mesh.position.x, b.mesh.position.z));
    G.reportIncident(cops.length ? ensureCallsign(G, cops[0]) : 'PSPD', `shots fired in ${districtAt(G.player.x, G.player.z)}`);
  }
  const hit = nearestHostileAhead(G, 34, 0.65);
  const P = G.player;
  let ex = P.x + Math.sin(P.camYaw + Math.PI) * 30, ez = P.z + Math.cos(P.camYaw + Math.PI) * 30;
  if (hit?.ped) {
    hit.ped.health -= 34; ex = hit.ped.mesh.position.x; ez = hit.ped.mesh.position.z;
    G.hud.hitmarker();
    if (hit.ped.health <= 0) { hit.ped.dead = true; hit.ped.mesh.rotation.x = Math.PI / 2; hit.ped.mesh.position.y = 0.25; G.missions?.onGangDown(hit.ped); }
  } else if (hit?.car) {
    hit.car.health -= 16; ex = hit.car.mesh.position.x; ez = hit.car.mesh.position.z;
    G.hud.hitmarker();
    if (hit.car.health <= 20) hit.car.missionDisabled = true;
  }
  // A short tracer line sells the shot.
  if (G.tracer) G.scene.remove(G.tracer);
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(P.x, 1.45, P.z), new THREE.Vector3(ex, 1.2, ez),
  ]);
  G.tracer = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.9 }));
  G.tracer.userData.t = 0.09;
  G.scene.add(G.tracer);
}
export function updateCombat(G, dt) {
  G.fireCd = Math.max(0, G.fireCd - dt);
  G.recoil = Math.max(0, G.recoil - dt * 5);
  if (G.input.hit('KeyF')) tryFire(G);
  if (G.tracer) {
    G.tracer.userData.t -= dt;
    G.tracer.material.opacity = Math.max(0, G.tracer.userData.t * 9);
    if (G.tracer.userData.t <= 0) { G.scene.remove(G.tracer); G.tracer = null; }
  }
  // Gang members shoot back when Rio is close and in the open.
  for (const ped of [...G.peds]) {
    if (!ped.gang || ped.dead) continue;
    const p = ped.mesh.position;
    const d = dist2d(p.x, p.z, G.player.x, G.player.z);
    ped.mesh.rotation.y = Math.atan2(G.player.x - p.x, G.player.z - p.z);
    ped.shootCd -= dt;
    if (d < 24 && ped.shootCd <= 0 && G.state === 'playing') {
      ped.shootCd = 0.9 + Math.random() * 0.7;
      G.audio.enemyShot();
      if (Math.random() < clamp(0.5 - d * 0.012, 0.14, 0.5)) damagePlayer(G, 6 + Math.random() * 6);
    }
    if (d > 90) removePed(G, ped);
  }
}
