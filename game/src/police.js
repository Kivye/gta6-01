// The wanted system: witnessed crimes, cruiser callsigns, pursuit,
// line-of-sight decay, busts — plus the two escalation layers, the
// spotlight helicopter at three stars and the roadblock unit at four.
// Dispatch incidents (thefts, shots, the heli, roadblocks) are reported
// here into G.incident for the HUD's dispatch panel to read.
import { TUNING, CITY_EDGE, districtAt } from './config.js';
import { clamp, dist2d, angleLerp } from './random.js';
import { createCar, removeCar } from './vehicles.js';

const CRIME_STARS = { theft: 1, hitPed: 2, shooting: 1, hitPolice: 2, crash: 1 };
export function initPolice(G) {
  G.wanted = 0; G.hiddenT = 0; G.decayT = 0; G.bustT = 0; G.lastSeenT = 0;
  G.copSeq = 0; G.incident = null; G.sightSeen = false; G.peakWanted = 0;
  G.rbNextAt = 0; G.heli = null; G.heliAnnounced = false;
  G.reportIncident = (by, text) => { G.incident = { by, text, t: G.time }; };
  G.crime = (type, x, z) => {
    // A crime only counts when a cop or a crowd could plausibly witness
    // it: near a police car, or (for loud crimes) anywhere at all.
    const cops = policeCars(G);
    const nearCop = cops.filter((c) => dist2d(x, z, c.mesh.position.x, c.mesh.position.z) < 42)
      .sort((a, b) => dist2d(x, z, a.mesh.position.x, a.mesh.position.z) - dist2d(x, z, b.mesh.position.x, b.mesh.position.z))[0];
    const crowdNear = G.peds.some((p) => !p.dead && dist2d(x, z, p.mesh.position.x, p.mesh.position.z) < 16);
    const loud = type === 'shooting' || type === 'hitPed';
    if (!nearCop && !crowdNear && !loud) return; // unwitnessed: the heat never hears of it
    const add = CRIME_STARS[type] || 1;
    G.wanted = clamp(Math.max(G.wanted + (G.wanted === 0 ? add : 1), add), 0, 5);
    G.peakWanted = Math.max(G.peakWanted, G.wanted);
    G.hiddenT = 0; G.decayT = 0;
    G.danger = { x, z, t: G.time };
    if (type === 'theft' && nearCop) {
      G.reportIncident(ensureCallsign(G, nearCop), `vehicle theft reported in ${districtAt(x, z)}`);
    }
  };
}
export function setWanted(G, n) {
  G.wanted = clamp(n, 0, 5);
  if (n > 0) { G.hiddenT = 0; G.decayT = 0; G.peakWanted = Math.max(G.peakWanted, G.wanted); }
}
export function policeCars(G) { return G.cars.filter((c) => c.model.id === 'police' && !c.dead); }
// Callsigns are given once, at spawn, from a rising sequence; staged
// cruisers (screenshots) get theirs the first time the HUD looks.
export function ensureCallsign(G, car) {
  if (!car.callsign) { G.copSeq = (G.copSeq || 0) + 1; car.callsign = 'PALM-' + G.copSeq; }
  return car.callsign;
}
function spawnCop(G) {
  // Off-screen, snapped to a road, aimed at the player. Near the city
  // edge the clamp can drag a spawn into view, so keep the farthest of
  // a few tries: a cruiser must never materialise in plain sight.
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
  ensureCallsign(G, car);
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
// --- The helicopter -------------------------------------------------
// A low-poly air unit from boxes: dark-blue body, glass nose, long tail
// with a fin and tail rotor, a fast main rotor, skids, a translucent
// spotlight cone and the disc of light where the cone lands.
function buildHeli(G) {
  const grp = new THREE.Group();
  const navy = new THREE.MeshLambertMaterial({ color: 0x1d3f8f });
  const glass = new THREE.MeshLambertMaterial({ color: 0x9fd4e8 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x22262c });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.5, 4.6), navy); grp.add(body);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 1.2), glass); nose.position.set(0, -0.1, 2.6); grp.add(nose);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.6), navy); tail.position.set(0, 0.3, -4.2); grp.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.3, 0.7), navy); fin.position.set(0, 0.8, -6.3); grp.add(fin);
  const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.5, 0.22), dark); tailRotor.position.set(0.35, 0.8, -6.3); grp.add(tailRotor);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.07, 0.55), dark); rotor.position.y = 1.05; grp.add(rotor);
  for (const sx of [-1, 1]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 3.6), dark);
    skid.position.set(sx * 1.1, -1.05, 0.2); grp.add(skid);
  }
  G.scene.add(grp);
  // The spotlight is its own little rig that tracks the player on the
  // ground: a widening translucent cone plus a bright disc at its foot.
  const spot = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 6, 14, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
  cone.position.y = 7; spot.add(cone);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(5.6, 20),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.22, depthWrite: false }));
  disc.rotation.x = -Math.PI / 2; disc.position.y = 0.09; spot.add(disc);
  G.scene.add(spot);
  return { group: grp, rotor, spot };
}
export function ensureHeli(G) {
  if (!G.heli) {
    G.heli = buildHeli(G);
    if (!G.heliAnnounced) {
      G.heliAnnounced = true;
      G.reportIncident('AIR-1', 'spotlight on the suspect');
      if (G.hud && G.hud.showEvent) G.hud.showEvent('AIR UNIT DEPLOYED', 'AIR-1 has you in the light');
    }
  }
  return G.heli;
}
export function updateHeli(G, dt) {
  const heli = G.heli; if (!heli) return;
  const P = G.player;
  const hx = P.x + Math.sin(G.time * 0.5) * 5;
  const hz = P.z + Math.cos(G.time * 0.35) * 5;
  heli.group.position.set(hx, 14, hz);
  heli.group.rotation.y = P.car ? P.car.angle : P.angle;
  heli.rotor.rotation.y += dt * 26;
  heli.spot.position.set(P.x, 0, P.z);
}
function dropHeli(G) {
  if (!G.heli) return;
  G.scene.remove(G.heli.group); G.scene.remove(G.heli.spot);
  G.heli = null; G.heliAnnounced = false;
}
// --- The roadblock ----------------------------------------------------
// At four stars the farthest cruiser (past 35 m) is pulled off the chase
// and sent to a point 55 m ahead of the player's heading, where it stops
// sideways across the road. It stands down when the heat drops, after
// 25 s, or once the player has slipped past it.
function designateRoadblock(G, cops) {
  const P = G.player;
  const far = cops.filter((c) => !c.roadblock && dist2d(P.x, P.z, c.mesh.position.x, c.mesh.position.z) > 35)
    .sort((a, b) => dist2d(P.x, P.z, b.mesh.position.x, b.mesh.position.z) - dist2d(P.x, P.z, a.mesh.position.x, a.mesh.position.z))[0];
  if (!far) return;
  far.roadblock = { phase: 'go', until: G.time + 25 };
  G.rbNextAt = G.time + 45; // designation + hold + a 20 s cooldown before the next
  G.reportIncident(ensureCallsign(G, far), 'roadblock moving into position');
}
function driveRoadblock(G, cop, dt) {
  const P = G.player;
  const heading = P.car ? P.car.angle : P.angle;
  const bx = P.x + Math.sin(heading) * 55, bz = P.z + Math.cos(heading) * 55;
  const p = cop.mesh.position;
  const dBlock = dist2d(p.x, p.z, bx, bz);
  const dPlayer = dist2d(P.x, P.z, p.x, p.z);
  if (cop.roadblock.phase === 'go' && dBlock < 5) cop.roadblock.phase = 'hold';
  if (cop.roadblock.phase === 'go') {
    const targetAngle = Math.atan2(bx - p.x, bz - p.z);
    cop.angle = angleLerp(cop.angle, targetAngle, clamp(dt * 2.2, 0, 1));
    const topSpeed = cop.model.top * 0.95;
    cop.speed = clamp(cop.speed + (topSpeed - cop.speed) * dt * 1.4, 0, topSpeed);
  } else {
    cop.speed = 0;
    cop.angle = angleLerp(cop.angle, heading + Math.PI / 2, clamp(dt * 3, 0, 1));
  }
  const stoodDown = G.wanted < 4 || G.time > cop.roadblock.until || (cop.roadblock.phase === 'hold' && dPlayer < 5);
  if (stoodDown) { cop.roadblock = null; G.rbNextAt = Math.max(G.rbNextAt, G.time + 20); }
}
export function updatePolice(G, dt) {
  const P = G.player;
  const cops = policeCars(G);
  const want = G.wanted === 0 ? 0 : Math.min(TUNING.maxPolice, 1 + Math.floor(G.wanted * 0.9));
  if (G.wanted > 0 && cops.length < want && G.spawnCd <= 0) { spawnCop(G); G.spawnCd = 2.5; }
  G.spawnCd = Math.max(0, (G.spawnCd || 0) - dt);
  // The helicopter rides at three stars and above.
  if (G.wanted >= 3) { ensureHeli(G); updateHeli(G, dt); } else dropHeli(G);
  if (G.wanted === 0) {
    for (const cop of cops) if (dist2d(P.x, P.z, cop.mesh.position.x, cop.mesh.position.z) > 90) removeCar(G, cop);
    G.audio.setSiren(false, dt);
    G.sightSeen = false;
    return;
  }
  // Line of sight drives both the decay clock and the HUD sight chip.
  const seen = hasLineOfSight(G);
  G.sightSeen = seen;
  if (seen) { G.hiddenT = 0; G.decayT = 0; G.lastSeenT = G.time; }
  else {
    G.hiddenT += dt;
    if (G.hiddenT > TUNING.decayDelay) {
      G.decayT += dt;
      if (G.decayT >= TUNING.decayStep) {
        setWanted(G, G.wanted - 1);
        G.decayT = 0; G.hiddenT = TUNING.decayDelay;
        if (G.wanted === 0) {
          // A clean escape after real heat pays out: stat + respect.
          if (G.peakWanted >= 2) { G.stats.escapes++; G.respect += 60; }
          G.peakWanted = 0;
          G.missions?.onWantedCleared();
        }
      }
    }
  }
  G.wantedBlinking = !seen && G.hiddenT > 1.5;
  // Roadblock designation at four stars and up.
  if (G.wanted >= 4 && G.time >= G.rbNextAt && !cops.some((c) => c.roadblock)) designateRoadblock(G, cops);
  let anyNear = false;
  for (const cop of cops) {
    const p = cop.mesh.position;
    const d = dist2d(P.x, P.z, p.x, p.z);
    if (d < 70) anyNear = true;
    if (cop.roadblock) { driveRoadblock(G, cop, dt); continue; }
    // Pursuit: aim at the player; close in a car chase, aim ahead to block.
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
