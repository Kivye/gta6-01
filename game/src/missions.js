// The five chained story missions plus the free-roam chop-shop fencing loop.
import { CHOP_SHOPS, PIER } from './config.js';
import { clamp, dist2d } from './random.js';
import { createCar, removeCar } from './vehicles.js';
import { spawnPed, removePed } from './pedestrians.js';
import { setWanted } from './police.js';
import { writeSave } from './save.js';

export function fenceValue(car) {
  return Math.round(car.model.value * clamp(car.health, 4, 100) / 100);
}
export const MISSION_DEFS = [
  { name: 'First Wheels', reward: 150, intro: 'Rio needs wheels and a fence. Steal any car and sell it at a chop shop.', outro: 'First sale done. The fence remembers your face now.' },
  { name: 'Hot Package', reward: 350, intro: 'A package waits in the Marina. Grab it and run it to Old Town — the clock is ticking.', outro: 'Delivered hot and on time. Word travels fast in Palmshade.' },
  { name: 'Rival Colors', reward: 600, intro: 'A rival crew is moving a briefcase across town. Stop their car, take it, bring it to the West Chop Shop.', outro: 'Their colors just faded. Yours are getting brighter.' },
  { name: 'Sirens', reward: 1200, intro: 'A Vesper GT sits in a Heights showroom. Take it, shake the 3-star heat, then fence it.', outro: 'You outran the sirens and cashed the Vesper. Big league now.' },
  { name: 'The Golden Hour', reward: 3000, intro: 'The Aurum One rolls in a convoy at golden hour. Steal it under 4-star heat and rivals\' fire — deliver it to the pier.', outro: 'The golden car gleams on the pier as the sun drops. Palmshade is yours, legend.' },
];
const PKG = { x: 28, z: 80 }, DROP = { x: -28, z: 2 }, SHOWROOM = { x: 54, z: -50 };

export class Missions {
  constructor(G) { this.G = G; this.idx = 0; this.stage = 0; this.timer = -1; this.spawned = []; this.active = false; this.done = false; this.targetCar = null; }
  start(idx) {
    const G = this.G;
    this.cleanup();
    this.idx = idx; G.missionIndex = idx; this.stage = 0; this.timer = -1; this.targetCar = null; this.guardSpawned = false; this.active = true; this.done = idx >= MISSION_DEFS.length;
    if (this.done) { G.hud.setObjective('Free roam — steal cars and fence them at the chop shops.'); return; }
    const def = MISSION_DEFS[idx];
    G.hud.banner(`MISSION ${idx + 1}: ${def.name}`, def.intro, 5);
    if (idx === 2) {
      const car = createCar(G, 'sports', 52, 26, Math.PI, 'rival');
      car.health = 90; car.missionHostile = true; this.targetCar = car; this.spawned.push(car);
    }
    if (idx === 3) {
      const car = createCar(G, 'sports', SHOWROOM.x, SHOWROOM.z, Math.PI / 2, 'parked');
      car.showroom = true; this.targetCar = car; this.spawned.push(car);
    }
    if (idx === 4) {
      const gold = createCar(G, 'golden', 78, -26, Math.PI, 'convoy');
      gold.health = 100; this.targetCar = gold; this.spawned.push(gold);
      for (const off of [-9, 9]) {
        const esc = createCar(G, 'suv', 78 + off, -26 - 6, Math.PI, 'convoy');
        esc.missionHostile = true; this.spawned.push(esc);
      }
      this.convoyT = 0;
    }
    this.refreshObjective();
  }
  cleanup() {
    for (const e of this.spawned) {
      if (e.model) {
        // Rio may still be sitting in a spawned car (e.g. the Aurum at the pier
        // the moment the finale completes): put him back on foot first, or
        // removeCar leaves him car-less with his mesh still hidden — invisible.
        if (this.G.player.car === e && this.G.exitCar) this.G.exitCar();
        if (this.G.cars.includes(e)) removeCar(this.G, e);
      }
      else if (this.G.peds.includes(e)) removePed(this.G, e);
    }
    this.spawned = [];
  }
  refreshObjective() {
    const G = this.G, i = this.idx, s = this.stage;
    const set = (x, z, text) => G.hud.setObjective(text, x === null ? null : { x, z });
    if (this.done) return;
    if (i === 0) {
      if (s === 0) set(null, null, 'Steal any car (walk up and press E).');
      else set(CHOP_SHOPS[0].x, CHOP_SHOPS[0].z + 7, 'Deliver the stolen car to a chop shop garage.');
    } else if (i === 1) {
      if (s === 0) set(PKG.x, PKG.z, 'Pick up the package in the Marina.');
      else set(DROP.x, DROP.z, 'Deliver the package to Old Town — beat the clock!');
    } else if (i === 2) {
      if (s === 0) set(this.targetCar?.mesh.position.x, this.targetCar?.mesh.position.z, 'Stop the rival car (ram it or shoot it), then grab the briefcase.');
      else if (s === 1) set(this.targetCar?.mesh.position.x, this.targetCar?.mesh.position.z, 'Take the briefcase from the stopped rival car.');
      else set(CHOP_SHOPS[0].x, CHOP_SHOPS[0].z + 7, 'Bring the briefcase to the West Chop Shop.');
    } else if (i === 3) {
      if (s === 0) set(SHOWROOM.x, SHOWROOM.z, 'Steal the Vesper GT from the Heights showroom.');
      else if (s === 1) set(null, null, 'Survive: break line of sight until the wanted stars clear.');
      else set(CHOP_SHOPS[1].x, CHOP_SHOPS[1].z + 7, 'Heat is gone — fence the Vesper at the Marina Chop Shop.');
    } else if (i === 4) {
      if (s === 0) set(this.targetCar?.mesh.position.x, this.targetCar?.mesh.position.z, 'Steal the golden Aurum One from its convoy.');
      else set(PIER.x, PIER.z, 'Deliver the Aurum One to the pier before time runs out!');
    }
  }
  complete() {
    const G = this.G, def = MISSION_DEFS[this.idx];
    const pay = def.reward;
    G.cash += pay; G.completed = this.idx + 1;
    G.audio.success(); G.audio.cashSound();
    G.hud.banner('MISSION COMPLETE', `${def.outro}\n+$${pay} — Rank: ${G.rankName()}`, 6);
    this.cleanup();
    const next = this.idx + 1;
    writeSave(G);
    this.active = false;
    setTimeout(() => { if (G.state === 'playing' || G.state === 'menu') this.start(next); }, 6500);
  }
  fail(reason) {
    const G = this.G;
    if (!this.active) return;
    this.active = false;
    G.audio.fail();
    G.hud.banner('MISSION FAILED', `${reason}\nRetrying: ${MISSION_DEFS[this.idx].name}`, 5);
    const idx = this.idx;
    setTimeout(() => { if (!G.player.dead) this.start(idx); }, 5200);
  }
  onCarStolen(car) {
    const G = this.G;
    if (!this.active || this.done) return;
    if (this.idx === 0 && this.stage === 0) { this.stage = 1; this.refreshObjective(); }
    if (this.idx === 3 && this.stage === 0 && car === this.targetCar) {
      this.stage = 1; setWanted(G, 3); this.refreshObjective();
      G.hud.banner('SIRENS', 'Three stars! Lose the cops — hide until the stars blink out.', 4);
    }
    if (this.idx === 4 && this.stage === 0 && car === this.targetCar) {
      this.stage = 1; this.timer = 240; setWanted(G, 4); this.refreshObjective();
      // Ambush crews at two intersections on the way to the pier.
      for (const [x, z] of [[2, 54], [-24, 106]]) for (let k = 0; k < 2; k++) {
        const ped = spawnPed(G, x + k * 2 - 1, z, { gang: true }); this.spawned.push(ped);
      }
      G.hud.banner('THE GOLDEN HOUR', 'Four stars and rivals are shooting — get the Aurum to the pier!', 4);
    }
  }
  onWantedCleared() {
    if (this.active && this.idx === 3 && this.stage === 1) { this.stage = 2; this.refreshObjective(); }
  }
  onGangDown() { /* flavour hook: rival crews remember this */ }
  fenceCheck() {
    const G = this.G, car = G.player.car;
    if (!car || !car.stolen || car.model.id === 'police') return false;
    // A live mission's target car is cargo, not merchandise: fencing it early
    // (the Vesper during Sirens stage 1, the rival car, the Aurum) deletes the
    // objective vehicle and softlocks the chain — those missions have no timer
    // or fail path to recover it. The one exception is Sirens stage 2, where
    // fencing the Vesper IS the objective.
    if (this.active && this.targetCar && car === this.targetCar && !(this.idx === 3 && this.stage === 2)) {
      G.hud.banner('NOT FOR SALE', 'This car is mission cargo — the fence will not touch it.', 3);
      return false;
    }
    for (const shop of CHOP_SHOPS) {
      if (dist2d(car.mesh.position.x, car.mesh.position.z, shop.x, shop.z + 7) < 7.5) {
        const pay = fenceValue(car);
        const wasTarget = car === this.targetCar;
        const soldName = car.model.name;
        G.exitCar();
        removeCar(G, car);
        G.cash += pay; G.audio.cashSound();
        G.hud.banner('CAR FENCED', `${soldName} sold for $${pay}`, 3);
        writeSave(G);
        if (this.active && this.idx === 0 && this.stage === 1) this.complete();
        else if (this.active && this.idx === 3 && this.stage === 2 && wasTarget) this.complete();
        return true;
      }
    }
    return false;
  }
  update(dt) {
    const G = this.G;
    if (G.state !== 'playing') return;
    this.fenceCheck();
    if (!this.active || this.done) { G.hud.setTimer(-1); return; }
    const P = G.player, i = this.idx;
    if (this.timer > 0) {
      this.timer -= dt; G.hud.setTimer(this.timer);
      if (this.timer <= 0) { this.fail('Out of time.'); return; }
    } else G.hud.setTimer(-1);
    if (this.targetCar?.dead && (i === 2 || i === 3 || i === 4)) { this.fail('The target car was destroyed.'); return; }
    if (i === 1) {
      if (this.stage === 0 && dist2d(P.x, P.z, PKG.x, PKG.z) < 4.5) {
        this.stage = 1; this.timer = 150; this.refreshObjective(); G.audio.cashSound();
        G.hud.banner('PACKAGE PICKED UP', 'Old Town, fast — 2:30 on the clock!', 3);
      } else if (this.stage === 1 && dist2d(P.x, P.z, DROP.x, DROP.z) < 5.5) this.complete();
    } else if (i === 2) {
      const car = this.targetCar;
      if (car) {
        this.driveRival(dt);
        G.hud.setObjective(null, { x: car.mesh.position.x, z: car.mesh.position.z }, true);
        if (this.stage === 0 && (car.missionDisabled || car.health < 45 || (Math.abs(car.speed) < 0.5 && car.health < 80))) {
          this.stage = 1; car.speed = 0; this.refreshObjective();
          for (let k = 0; k < 2; k++) { const ped = spawnPed(G, car.mesh.position.x + 2 + k * 1.5, car.mesh.position.z + 1, { gang: true }); this.spawned.push(ped); }
          G.hud.banner('CAR STOPPED', 'Grab the briefcase — watch out, the crew is armed!', 3.5);
        } else if (this.stage === 1 && !P.car && dist2d(P.x, P.z, car.mesh.position.x, car.mesh.position.z) < 3.2) {
          this.stage = 2; this.refreshObjective(); G.audio.cashSound();
          G.hud.banner('BRIEFCASE TAKEN', 'Get it to the West Chop Shop.', 3);
        } else if (this.stage === 2 && dist2d(P.x, P.z, CHOP_SHOPS[0].x, CHOP_SHOPS[0].z + 7) < 7) this.complete();
      }
    } else if (i === 4) {
      if (this.stage === 0) this.driveConvoy(dt);
      else if (this.stage === 1 && P.car === this.targetCar && dist2d(P.x, P.z, PIER.x, PIER.z) < 9) {
        this.timer = -1; this.complete();
      }
      if (this.stage === 0 && this.targetCar) G.hud.setObjective(null, { x: this.targetCar.mesh.position.x, z: this.targetCar.mesh.position.z }, true);
    } else if (i === 3 && this.stage === 0 && this.targetCar) {
      // Showroom guard: one armed lookout near the Vesper.
      if (!this.guardSpawned) {
        this.guardSpawned = true;
        const ped = spawnPed(G, SHOWROOM.x + 3, SHOWROOM.z + 2, { gang: true }); this.spawned.push(ped);
      }
    }
  }
  driveRival(dt) {
    const G = this.G, car = this.targetCar, p = car.mesh.position;
    if (this.stage > 0) { car.speed = 0; return; }
    // Flee along roads: head for the intersection furthest from Rio.
    if (!car.wp || dist2d(p.x, p.z, car.wp.x, car.wp.z) < 4) {
      const s = 26, opts = [];
      const ix = Math.round(p.x / s) * s, iz = Math.round(p.z / s) * s;
      for (const [dx, dz] of [[s, 0], [-s, 0], [0, s], [0, -s]]) {
        const nx = clamp(ix + dx, -104, 104), nz = clamp(iz + dz, -104, 104);
        opts.push({ x: nx, z: nz, score: dist2d(nx, nz, G.player.x, G.player.z) });
      }
      opts.sort((a, b) => b.score - a.score);
      car.wp = opts[0];
    }
    const target = Math.atan2(car.wp.x - p.x, car.wp.z - p.z);
    car.angle = angleTurn(car.angle, target, dt * 2.2);
    car.speed = Math.min(24, car.speed + 14 * dt);
  }
  driveConvoy(dt) {
    const G = this.G;
    this.convoyT = (this.convoyT || 0) + dt;
    for (const car of this.spawned) {
      if (!car.model || car.dead) continue;
      const p = car.mesh.position;
      if (!car.wp || dist2d(p.x, p.z, car.wp.x, car.wp.z) < 4) {
        const s = 26;
        const ix = Math.round(p.x / s) * s, iz = Math.round(p.z / s) * s;
        // Convoy drifts south toward the Marina, slowly.
        car.wp = { x: ix, z: clamp(iz + s, -104, 104) };
        if (iz >= 104) car.wp = { x: clamp(ix + s, -104, 104), z: iz };
      }
      const target = Math.atan2(car.wp.x - p.x, car.wp.z - p.z);
      car.angle = angleTurn(car.angle, target, dt * 1.8);
      car.speed = Math.min(6, car.speed + 6 * dt);
    }
  }
}
function angleTurn(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.min(1, t);
}
