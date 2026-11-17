// Wanted system and police pursuit: crimes, spawning, chasing, hiding, busts.
import { TUNING, CITY_EDGE } from './config.js';
import { clamp, dist2d, angleLerp } from './random.js';
import { createCar, removeCar } from './vehicles.js';

const CRIME_STARS = { theft: 1, hitPed: 2, shooting: 1, hitPolice: 2, crash: 1 };
export function initPolice(G) {
  G.wanted = 0; G.hiddenT = 0; G.decayT = 0; G.bustT = 0; G.lastSeenT = 0;
  G.crime = (type, x, z) => {
    // A crime only counts when a cop or a crowd could plausibly witness it:
    // near a police car, or (for loud crimes) anywhere at all.
    const copNear = G.cars.some((c) => c.model.id === 'police' && dist2d(x, z, c.mesh.position.x, c.mesh.position.z) < 42);
    const crowdNear = G.peds.some((p) => !p.dead && dist2d(x, z, p.mesh.position.x, p.mesh.position.z) < 16);
    const loud = type === 'shooting' || type === 'hitPed';
    if (!copNear && !crowdNear && !loud) return; // unwitnessed: the heat never hears about it
    const add = CRIME_STARS[type] || 1;
    G.wanted = clamp(Math.max(G.wanted + (G.wanted === 0 ? add : 1), add), 0, 5);
    G.hiddenT = 0; G.decayT = 0;
    G.danger = { x, z, t: G.time };
  };
}
export function setWanted(G, n) {
  G.wanted = clamp(n, 0, 5);
  if (n > 0) { G.hiddenT = 0; G.decayT = 0; }
}
export function policeCars(G) { return G.cars.filter((c) => c.model.id === 'police' && !c.dead); }
function spawnCop(G) {
  // Off-screen, snapped to a road, aimed at the player. Near the city edge the
  // clamp can drag a spawn point into the player's line of sight, so reject
  // candidates that land too close and keep the farthest of a few tries: a
  // cruiser must never materialise in plain view of a hiding player.
  let bx = 0, bz = 0, bd = -1;
  for (let i = 0; i < 6; i++) {
    const a = G.rng() * Math.PI * 2, r = 55 + G.rng() * 25;
    let x = clamp(G.player.x + Math.sin(a) * r, -CITY_EDGE, CITY_EDGE);
    let z = clamp(G.player.z + Math.cos(a) * r, -CITY_EDGE, CITY_EDGE);
    const s = 26;
    if (G.rng() < 0.5) x = Math.round(x / s) * s; else z = Math.round(z / s) * s;
    const d = dist2d(x, z, G.player.x, G.player.z);
    if (d > bd) { bd = d; bx = x; bz = z; }
    if (d >= 58) break;
  }
  const car = createCar(G, 'police', bx, bz, Math.atan2(G.player.x - bx, G.player.z - bz), 'police');
  car.speed = 10;
  return car;
}
function hasLineOfSight(G) {
  const P = G.player;
  for (const cop of policeCars(G)) {
    const d = dist2d(P.x, P.z, cop.mesh.position.x, cop.mesh.position.z);
    if (d > 55) continue;
    // Cheap LOS: sample the segment; a building collider blocks the view.
    let blocked = false;
    for (let t = 0.15; t < 0.9; t += 0.15) {
      const sx = cop.mesh.position.x + (P.x - cop.mesh.position.x) * t;
      const sz = cop.mesh.position.z + (P.z - cop.mesh.position.z) * t;
      for (const c of G.colliders) {
        if (!c.soft && Math.abs(sx - c.x) < c.hw && Math.abs(sz - c.z) < c.hd) { blocked = true; break; }
      }
      if (blocked) break;
    }
    if (!blocked) return true;
  }
  return false;
}
export function updatePolice(G, dt) {
  const P = G.player;
  const cops = policeCars(G);
  const want = G.wanted === 0 ? 0 : Math.min(TUNING.maxPolice, 1 + Math.floor(G.wanted * 0.9));
  if (G.wanted > 0 && cops.length < want && G.spawnCd <= 0) { spawnCop(G); G.spawnCd = 2.5; }
  G.spawnCd = Math.max(0, (G.spawnCd || 0) - dt);
  if (G.wanted === 0) {
    for (const cop of cops) if (dist2d(P.x, P.z, cop.mesh.position.x, cop.mesh.position.z) > 90) removeCar(G, cop);
    G.audio.setSiren(false, dt);
    return;
  }
  // Line of sight drives the decay clock.
  const seen = hasLineOfSight(G);
  if (seen) { G.hiddenT = 0; G.decayT = 0; G.lastSeenT = G.time; }
  else {
    G.hiddenT += dt;
    if (G.hiddenT > TUNING.decayDelay) {
      G.decayT += dt;
      if (G.decayT >= TUNING.decayStep) {
        setWanted(G, G.wanted - 1);
        G.decayT = 0; G.hiddenT = TUNING.decayDelay;
        if (G.wanted === 0) G.missions?.onWantedCleared();
      }
    }
  }
  G.wantedBlinking = !seen && G.hiddenT > 1.5;
  let anyNear = false;
  for (const cop of cops) {
    const p = cop.mesh.position;
    const d = dist2d(P.x, P.z, p.x, p.z);
    if (d < 70) anyNear = true;
    // Pursuit: aim at the player; when close in a car chase, aim ahead to block.
    let tx = P.x, tz = P.z;
    if (P.car && d < 16) { tx = P.x + Math.sin(P.car.angle) * 7; tz = P.z + Math.cos(P.car.angle) * 7; }
    const targetAngle = Math.atan2(tx - p.x, tz - p.z);
    cop.angle = angleLerp(cop.angle, targetAngle, clamp(dt * (d < 8 ? 3.2 : 2), 0, 1));
    const topSpeed = cop.model.top * (0.82 + G.wanted * 0.045);
    const wantSpeed = d > 6 ? topSpeed : clamp((P.car ? Math.abs(P.car.speed) : 0) + 2, 4, topSpeed);
    cop.speed = clamp(cop.speed + (wantSpeed - cop.speed) * dt * 1.4, 0, topSpeed);
    if (d < 3.4 && P.car) cop.speed = Math.min(cop.speed, Math.abs(P.car.speed) + 1); // ram range: shoves come from car collisions
  }
  G.audio.setSiren(anyNear, dt);
  // Bust check: grabbed on foot with a cop close, or boxed in while stopped.
  let busting = false;
  if (!P.car) busting = cops.some((c) => dist2d(P.x, P.z, c.mesh.position.x, c.mesh.position.z) < TUNING.bustRadius + 1.4);
  else if (Math.abs(P.car.speed) < 0.8) {
    const around = cops.filter((c) => dist2d(P.x, P.z, c.mesh.position.x, c.mesh.position.z) < 9).length;
    busting = around >= 2 || (around >= 1 && G.wanted >= 4);
  }
  if (busting) {
    G.bustT += dt;
    if (G.bustT >= TUNING.bustTime) { G.bustT = 0; G.onBusted(); }
  } else G.bustT = Math.max(0, G.bustT - dt * 2);
}
