// The car factory (twelve procedural models), arcade driving physics,
// traffic AI, collisions — and the golden-hour light kit every car
// carries: a headlight bar, warm nose glow, red tail glow, a pool of
// light on the road, and for cruisers a siren glow on the asphalt that
// follows the lightbar flash. Shared materials keep the kit's cost flat.
import { MODEL_BY_ID, TRAFFIC_MODELS, WORLD, CITY_EDGE } from './config.js';
import { rngPick, clamp, dist2d, angleLerp } from './random.js';
import { isOnRoad, snapToRoad, insideBuilding } from './world.js';

const bodyMat = (hex) => new THREE.MeshLambertMaterial({ color: hex });
const darkMat = new THREE.MeshLambertMaterial({ color: 0x1c2126 });
const glassMat = new THREE.MeshLambertMaterial({ color: 0x9fd4e8 });

// Shared glow assets, built once: a radial-gradient sprite texture, one
// sprite material per (colour, opacity) pair, one pool plane.
let glowTex = null;
const glowMats = {};
function glowSpriteMat(color, opacity) {
  if (!glowTex) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const cx = cv.getContext('2d');
    const grad = cx.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
    cx.fillStyle = grad; cx.fillRect(0, 0, 64, 64);
    glowTex = new THREE.CanvasTexture(cv);
  }
  const key = color + '/' + opacity;
  if (!glowMats[key]) glowMats[key] = new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
  return glowMats[key];
}
const poolGeo = new THREE.PlaneGeometry(3.0, 4.6);
const poolMat = new THREE.MeshBasicMaterial({ color: 0xffdf9a, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false });
const sirenGeo = new THREE.CircleGeometry(3.6, 20);

export function makeCarMesh(model, rng) {
  const g = new THREE.Group();
  const paint = model.id === 'golden'
    ? new THREE.MeshStandardMaterial({ color: model.color, metalness: 0.85, roughness: 0.3, emissive: 0x442d00 })
    : bodyMat(model.color);
  const body = new THREE.Mesh(new THREE.BoxGeometry(model.wid, model.hgt * 0.55, model.len), paint);
  body.position.y = 0.35 + model.hgt * 0.27; g.add(body);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(model.wid * 0.92, model.hgt * 0.3, model.len * 0.24), paint);
  hood.position.set(0, 0.35 + model.hgt * 0.42, model.len * 0.36); g.add(hood);
  if (model.id === 'truck' || model.id === 'van') {
    const box = new THREE.Mesh(new THREE.BoxGeometry(model.wid * 0.98, model.hgt * 0.95, model.len * 0.62),
      model.id === 'truck' ? bodyMat(0xe8e2d4) : paint);
    box.position.set(0, 0.3 + model.hgt * 0.5, -model.len * 0.14); g.add(box);
  } else if (model.id === 'pickup') {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(model.wid * 0.94, model.hgt * 0.34, model.len * 0.4), darkMat);
    bed.position.set(0, 0.35 + model.hgt * 0.4, -model.len * 0.26); g.add(bed);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(model.wid * 0.9, model.hgt * 0.5, model.len * 0.3), glassMat);
    cab.position.set(0, 0.4 + model.hgt * 0.55, model.len * 0.14); g.add(cab);
  } else if (model.id !== 'convertible') {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(model.wid * 0.84, model.hgt * 0.48, model.len * (model.id === 'limo' ? 0.52 : 0.42)), glassMat);
    cab.position.set(0, 0.42 + model.hgt * 0.52, model.id === 'limo' ? -model.len * 0.05 : -model.len * 0.03); g.add(cab);
  }
  if (model.id === 'convertible') {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(model.wid * 0.8, 0.3, model.len * 0.34), bodyMat(0x7a2e2e));
    seat.position.set(0, 0.72, -model.len * 0.05); g.add(seat);
  }
  if (model.id === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.24, 0.3), new THREE.MeshLambertMaterial({ color: 0xfff2a0, emissive: 0x665500 }));
    sign.position.set(0, 1.32, 0); g.add(sign);
  }
  let lightBar = null;
  if (model.id === 'police') {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(model.wid + 0.02, 0.3, model.len * 0.9), bodyMat(0x2456c8));
    stripe.position.y = 0.72; g.add(stripe);
    lightBar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.4), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    red.position.x = -0.3; const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.4), new THREE.MeshBasicMaterial({ color: 0x2255ff }));
    blue.position.x = 0.3; lightBar.add(red, blue); lightBar.position.set(0, 1.62, 0); g.add(lightBar);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 10); wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const w = new THREE.Mesh(wheelGeo, darkMat);
    w.position.set(sx * (model.wid / 2 - 0.05), 0.34, sz * (model.len / 2 - 0.85));
    g.add(w); wheels.push(w);
  }
  const brakeMat = new THREE.MeshBasicMaterial({ color: 0x550000 });
  const brake = new THREE.Mesh(new THREE.BoxGeometry(model.wid * 0.8, 0.16, 0.08), brakeMat);
  brake.position.set(0, 0.62, -model.len / 2 - 0.03); g.add(brake);
  // One pale headlight bar across the nose.
  const headBar = new THREE.Mesh(new THREE.BoxGeometry(model.wid * 0.72, 0.15, 0.07),
    new THREE.MeshBasicMaterial({ color: 0xfff3b8 }));
  headBar.position.set(0, 0.66, model.len / 2 + 0.03); g.add(headBar);
  const smoke = new THREE.Mesh(new THREE.SphereGeometry(0.5, 7, 6),
    new THREE.MeshBasicMaterial({ color: 0x555555, transparent: true, opacity: 0 }));
  smoke.position.set(0, 1.3, model.len * 0.35); smoke.visible = false; g.add(smoke);
  // The glow kit: nose sprite, tail sprite, headlight pool on the road.
  const glow = new THREE.Sprite(glowSpriteMat(0xffe9b0, 0.5));
  glow.scale.set(2.7, 1.3, 1); glow.position.set(0, 0.66, model.len / 2 + 0.5); g.add(glow);
  const tail = new THREE.Sprite(glowSpriteMat(0xff4444, 0.45));
  tail.scale.set(2.0, 0.85, 1); tail.position.set(0, 0.66, -model.len / 2 - 0.4); g.add(tail);
  const pool = new THREE.Mesh(poolGeo, poolMat);
  pool.rotation.x = -Math.PI / 2; pool.position.set(0, 0.05, model.len / 2 + 2.6); g.add(pool);
  // Cruisers spill their siren colours onto the asphalt; the material is
  // per-car because its colour chases the lightbar phase.
  let sirenGlow = null;
  if (lightBar) {
    sirenGlow = new THREE.Mesh(sirenGeo, new THREE.MeshBasicMaterial({ color: 0xff2222, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }));
    sirenGlow.rotation.x = -Math.PI / 2; sirenGlow.position.y = 0.07; g.add(sirenGlow);
  }
  return { group: g, wheels, brakeMat, lightBar, smoke, sirenGlow };
}

export function createCar(G, modelId, x, z, angle, kind) {
  const model = MODEL_BY_ID[modelId];
  const parts = makeCarMesh(model, G.rng);
  parts.group.position.set(x, 0, z); parts.group.rotation.y = angle;
  G.scene.add(parts.group);
  const car = {
    model, mesh: parts.group, wheels: parts.wheels, brakeMat: parts.brakeMat, lightBar: parts.lightBar, smoke: parts.smoke, sirenGlow: parts.sirenGlow,
    angle, speed: 0, health: 100, kind, stolen: false, dead: false,
    waypoint: null, brake: false, honkT: 0, smokeT: 0, flashT: Math.random() * 6,
    callsign: null, roadblock: null, nmArm: false,
  };
  G.cars.push(car);
  return car;
}
export function removeCar(G, car) {
  G.scene.remove(car.mesh);
  const i = G.cars.indexOf(car); if (i >= 0) G.cars.splice(i, 1);
  if (G.player.car === car) G.player.car = null;
}
export function spawnTraffic(G, count) {
  for (let i = 0; i < count; i++) {
    const horiz = G.rng() < 0.5;
    const lane = snapToRoad((G.rng() * 2 - 1) * CITY_EDGE);
    const along = (G.rng() * 2 - 1) * CITY_EDGE;
    const dirSign = G.rng() < 0.5 ? 1 : -1;
    // Right-hand traffic: offset to the right of the travel direction.
    const x = horiz ? along : lane + dirSign * 2.1;
    const z = horiz ? lane - dirSign * 2.1 : along;
    if (dist2d(x, z, G.player.x, G.player.z) < 16) continue;
    const angle = horiz ? (dirSign > 0 ? Math.PI / 2 : -Math.PI / 2) : (dirSign > 0 ? 0 : Math.PI);
    const car = createCar(G, rngPick(G.rng, TRAFFIC_MODELS), x, z, angle, 'traffic');
    car.speed = 6 + G.rng() * 4;
    pickWaypoint(G, car);
  }
}
function pickWaypoint(G, car) {
  const s = WORLD.step;
  const ix = snapToRoad(car.mesh.position.x), iz = snapToRoad(car.mesh.position.z);
  const fx = Math.sin(car.angle), fz = Math.cos(car.angle);
  let nx = ix, nz = iz;
  if (Math.abs(fx) > Math.abs(fz)) nx = ix + Math.sign(fx) * s; else nz = iz + Math.sign(fz) * s;
  nx = clamp(nx, -CITY_EDGE, CITY_EDGE); nz = clamp(nz, -CITY_EDGE, CITY_EDGE);
  car.waypoint = { x: nx, z: nz };
}
function obstacleAhead(G, car, range) {
  const fx = Math.sin(car.angle), fz = Math.cos(car.angle);
  const px = car.mesh.position.x, pz = car.mesh.position.z;
  for (const o of G.cars) {
    if (o === car || o.dead) continue;
    const dx = o.mesh.position.x - px, dz = o.mesh.position.z - pz;
    const fwd = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
    if (fwd > 0 && fwd < range && side < 1.9) return o;
  }
  for (const p of G.peds) {
    if (p.dead) continue;
    const dx = p.mesh.position.x - px, dz = p.mesh.position.z - pz;
    const fwd = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
    if (fwd > 0 && fwd < range && side < 1.6) return p;
  }
  if (!G.player.car) {
    const dx = G.player.x - px, dz = G.player.z - pz;
    const fwd = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
    if (fwd > 0 && fwd < range && side < 1.4) return G.player;
  }
  return null;
}
function collideWorld(G, car) {
  const p = car.mesh.position;
  const r = car.model.wid * 0.62;
  const hit = insideBuilding(G.colliders, p.x, p.z, r * 0.4);
  if (hit) {
    const dx = p.x - hit.x, dz = p.z - hit.z;
    const px = hit.hw + r * 0.4 - Math.abs(dx), pz = hit.hd + r * 0.4 - Math.abs(dz);
    if (px < pz) p.x = hit.x + Math.sign(dx || 1) * (hit.hw + r * 0.4);
    else p.z = hit.z + Math.sign(dz || 1) * (hit.hd + r * 0.4);
    if (Math.abs(car.speed) > 4) { car.health -= Math.abs(car.speed) * 1.1; G.audio.thud(0.7); if (car.kind === 'player') G.shake = 0.35; }
    car.speed *= -0.25;
  }
  p.x = clamp(p.x, -CITY_EDGE - 14, CITY_EDGE + 14);
  p.z = clamp(p.z, -CITY_EDGE - 14, WORLD.seaZ + 34);
  if (p.z > WORLD.seaZ + 6 && Math.abs(p.x) > 5) { p.z = WORLD.seaZ + 6; car.speed *= 0.6; } // the sea stops cars off-pier
}
function collideCars(G, dt) {
  for (let i = 0; i < G.cars.length; i++) for (let j = i + 1; j < G.cars.length; j++) {
    const a = G.cars[i], b = G.cars[j];
    if (a.dead || b.dead) continue;
    const dx = b.mesh.position.x - a.mesh.position.x, dz = b.mesh.position.z - a.mesh.position.z;
    const d = Math.hypot(dx, dz), min = (a.model.len + b.model.len) * 0.32;
    if (d > 0.01 && d < min) {
      const push = (min - d) / 2, ux = dx / d, uz = dz / d;
      a.mesh.position.x -= ux * push; a.mesh.position.z -= uz * push;
      b.mesh.position.x += ux * push; b.mesh.position.z += uz * push;
      const rel = Math.abs(a.speed - b.speed);
      if (rel > 3) {
        a.health -= rel * 1.4; b.health -= rel * 1.4; G.audio.thud(clamp(rel / 12, 0.3, 1));
        if (a.kind === 'player' || b.kind === 'player') {
          G.shake = 0.3;
          const other = a.kind === 'player' ? b : a;
          if (other.model.id === 'police') G.crime('hitPolice', other.mesh.position.x, other.mesh.position.z);
          else if (rel > 6) G.crime('crash', other.mesh.position.x, other.mesh.position.z);
        }
      }
      const avg = (a.speed + b.speed) / 2; a.speed = avg * 0.7; b.speed = avg * 0.7;
    }
  }
}
export function updateVehicles(G, dt) {
  for (const car of [...G.cars]) {
    const p = car.mesh.position;
    car.brake = false;
    if (car.health <= 0 && !car.dead) { car.dead = true; car.speed = 0; car.smoke.material.opacity = 0.75; }
    if (car.kind === 'traffic' && !car.dead) {
      if (!car.waypoint) pickWaypoint(G, car);
      const wp = car.waypoint;
      const dx = wp.x - p.x, dz = wp.z - p.z;
      const distC = Math.hypot(dx, dz);
      // Lane offset: keep to the right side of the road through junctions.
      const fx = Math.sin(car.angle), fz = Math.cos(car.angle);
      const tx = wp.x + fz * 2.1, tz = wp.z - fx * 2.1;
      const targetAngle = Math.atan2(tx - p.x, tz - p.z);
      car.angle = angleLerp(car.angle, targetAngle, clamp(dt * 2.4, 0, 1));
      const blocked = obstacleAhead(G, car, 7.5);
      const cruise = car.cruiseSpeed ?? (car.cruiseSpeed = 7 + G.rng() * 4);
      if (blocked) { car.speed = Math.max(0, car.speed - 22 * dt); car.brake = true; if (car.speed < 0.5 && car.honkT <= 0) { G.audio.horn(); car.honkT = 3; } }
      else car.speed = Math.min(cruise, car.speed + 8 * dt);
      car.honkT -= dt;
      if (distC < 3.2) {
        // At the junction: mostly straight on, sometimes a turn.
        const turn = G.rng();
        if (turn < 0.3) car.angle += Math.PI / 2; else if (turn < 0.42) car.angle -= Math.PI / 2;
        car.angle = Math.round(car.angle / (Math.PI / 2)) * (Math.PI / 2);
        pickWaypoint(G, car);
      }
      if (!isOnRoad(p.x, p.z) && Math.abs(p.x) <= CITY_EDGE && Math.abs(p.z) <= CITY_EDGE) {
        car.angle = angleLerp(car.angle, Math.atan2(snapToRoad(p.x) + fz * 2.1 - p.x, snapToRoad(p.z) - fx * 2.1 - p.z), dt);
      }
    } else if (car.kind === 'parked') {
      car.speed = 0;
    }
    // Police movement lives in police.js; mission cars in missions.js.
    if (car.kind !== 'player') {
      p.x += Math.sin(car.angle) * car.speed * dt;
      p.z += Math.cos(car.angle) * car.speed * dt;
      if (car.kind === 'traffic' || car.kind === 'police' || car.kind === 'rival' || car.kind === 'convoy') collideWorld(G, car);
    }
    car.mesh.rotation.y = car.angle;
    for (const w of car.wheels) w.rotation.x += (car.speed * dt) / 0.34;
    car.brakeMat.color.setHex(car.brake || car.speed < -0.1 ? 0xff2222 : 0x550000);
    if (car.lightBar) {
      car.flashT += dt * 7;
      const on = Math.sin(car.flashT) > 0;
      car.lightBar.children[0].material.color.setHex(on ? 0xff6666 : 0x881111);
      car.lightBar.children[1].material.color.setHex(on ? 0x113388 : 0x6688ff);
      if (car.sirenGlow) car.sirenGlow.material.color.setHex(on ? 0xff2222 : 0x2255ff);
    }
    // Damage smoke, sized to be read at a glance in a screenshot: a car
    // under 35% health breathes a big, dense, pulsing plume.
    if (car.health < 35 && car.health > 0) {
      car.smokeT += dt;
      car.smoke.material.opacity = 0.55 + 0.2 * Math.sin(car.smokeT * 9);
      const s = 1.6 + 0.5 * Math.sin(car.smokeT * 5); car.smoke.scale.set(s, s, s);
    } else if (!car.dead) car.smoke.material.opacity = Math.max(0, car.smoke.material.opacity - dt);
    car.smoke.visible = car.smoke.material.opacity > 0.02;
    // Despawn distant traffic; keep the streets populated near Rio.
    if (car.kind === 'traffic' && dist2d(p.x, p.z, G.player.x, G.player.z) > 150) removeCar(G, car);
  }
  collideCars(G, dt);
  const trafficCount = G.cars.filter((c) => c.kind === 'traffic').length;
  if (trafficCount < 9 && G.cars.length < 18 && G.state === 'playing') spawnTraffic(G, 1);
}
// Near misses: a traffic car that slips through the 2.7–5.4 m band beside
// a fast-driven player car without contact is armed; when the gap opens
// again the pass counts — stat, respect, event line and toast, with a
// chain multiplier for repeats inside four seconds. The same car cannot
// score twice until it has been 26 m away.
export function checkNearMiss(G, car) {
  const spd = Math.abs(car.speed);
  const px = car.mesh.position.x, pz = car.mesh.position.z;
  for (const o of G.cars) {
    if (o.kind !== 'traffic' || o.dead) continue;
    const d = dist2d(px, pz, o.mesh.position.x, o.mesh.position.z);
    if (spd > 14 && d > 2.7 && d < 5.4) o.nmArm = true;
    else if (o.nmArm && d <= 2.7) o.nmArm = false; // contact is a crash, not a near miss
    else if (o.nmArm && d >= 5.4 && d < 11) {
      o.nmArm = false;
      G.stats.nearMiss++;
      G.respect += 10;
      G.nmChain = (G.time - (G.nmChainT || -9) < 4) ? (G.nmChain || 0) + 1 : 1;
      G.nmChainT = G.time;
      G.hud.showEvent('NEAR MISS', `+10 RESPECT${G.nmChain > 1 ? ` · CHAIN ×${G.nmChain}` : ''}`);
      if (G.hud.nearMissToast) G.hud.nearMissToast(G.nmChain);
    } else if (d > 26) o.nmArm = false;
  }
}
// Player driving: called from player.js with the shared game state.
export function drivePlayerCar(G, car, dt) {
  const inp = G.input;
  const accelIn = (inp.down('KeyW') || inp.down('ArrowUp') ? 1 : 0) - (inp.down('KeyS') || inp.down('ArrowDown') ? 1 : 0);
  const steer = (inp.down('KeyA') || inp.down('ArrowLeft') ? 1 : 0) - (inp.down('KeyD') || inp.down('ArrowRight') ? 1 : 0);
  const hand = inp.down('Space');
  const m = car.model;
  if (accelIn > 0) car.speed += m.accel * dt * (car.speed < 0 ? 2.2 : 1);
  else if (accelIn < 0) car.speed -= (car.speed > 0.5 ? 20 : m.accel * 0.7) * dt;
  else car.speed -= car.speed * 0.35 * dt;
  const drag = car.speed * car.speed * 0.004;
  car.speed -= Math.sign(car.speed) * drag * dt;
  car.speed = clamp(car.speed, -13, m.top * (car.health < 25 ? 0.55 : 1));
  if (hand) car.speed -= car.speed * 1.6 * dt;
  const steerPower = clamp(Math.abs(car.speed) / 8, 0, 1) * (hand ? 1.7 : 1);
  car.angle += steer * steerPower * dt * 1.55 * (car.speed < 0 ? -1 : 1);
  car.brake = accelIn < 0 && car.speed > 0.5;
  const p = car.mesh.position;
  p.x += Math.sin(car.angle) * car.speed * dt;
  p.z += Math.cos(car.angle) * car.speed * dt;
  collideWorld(G, car);
  car.mesh.rotation.y = car.angle;
  checkNearMiss(G, car);
  // Running over a pedestrian is a crime and a tragedy.
  for (const ped of G.peds) {
    if (ped.dead) continue;
    if (Math.abs(car.speed) > 3 && dist2d(p.x, p.z, ped.mesh.position.x, ped.mesh.position.z) < 1.7) {
      ped.dead = true; ped.mesh.rotation.x = Math.PI / 2; ped.mesh.position.y = 0.25;
      car.health -= 2; G.audio.thud(0.8);
      G.crime('hitPed', p.x, p.z);
    }
  }
  G.audio.setEngine(true, Math.abs(car.speed) / m.top);
}
