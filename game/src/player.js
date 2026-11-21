// Rio: on-foot movement, the third-person camera, entering and leaving
// cars, the theft bookkeeping (stat, standing, dispatch event) and the
// kevlar vest pickup outside the station.
import { TUNING, CITY_EDGE, districtAt } from './config.js';
import { clamp, dist2d, angleLerp } from './random.js';
import { insideBuilding } from './world.js';
import { drivePlayerCar } from './vehicles.js';
import { makePedMesh, spawnPed } from './pedestrians.js';

export function createPlayer(G) {
  const parts = makePedMesh(G);
  // Rio wears a sunset-orange jacket so he reads at a glance.
  parts.group.children[0].material = new THREE.MeshLambertMaterial({ color: 0xff7a1a });
  G.scene.add(parts.group);
  G.player = {
    mesh: parts.group, x: 2, z: 100, angle: Math.PI, health: TUNING.playerHealth, armour: 0,
    car: null, camYaw: Math.PI, camPitch: 0.32, dead: false, walkPhase: 0,
  };
  parts.group.position.set(G.player.x, 0, G.player.z);
}
export function nearestCar(G, maxD) {
  let best = null, bd = maxD;
  for (const car of G.cars) {
    if (car.dead) continue;
    const d = dist2d(G.player.x, G.player.z, car.mesh.position.x, car.mesh.position.z);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}
export function enterCar(G, car) {
  const P = G.player;
  P.car = car; car.kind = 'player'; car.speed = car.speed || 0;
  P.mesh.visible = false;
  // A driver inside bolts and runs.
  const driver = G.peds.find((p) => p.driverOf === car);
  if (driver) { driver.driverOf = null; driver.fleeT = 3; }
  else if (car.hadDriver) {
    const ped = spawnPed(G, car.mesh.position.x + 1.6, car.mesh.position.z);
    ped.fleeT = 3;
  }
  car.hadDriver = false;
  if (!car.stolen && car.model.id !== 'police') {
    car.stolen = true;
    G.stats.stolen++;
    G.crime('theft', car.mesh.position.x, car.mesh.position.z);
    // A theft a cruiser can see costs standing where the car stood.
    const witnessed = G.cars.some((c) => c.model.id === 'police' &&
      dist2d(car.mesh.position.x, car.mesh.position.z, c.mesh.position.x, c.mesh.position.z) < 70);
    if (witnessed) {
      const d = districtAt(car.mesh.position.x, car.mesh.position.z);
      G.standing[d] = clamp(G.standing[d] - 2, 0, 100);
    }
    G.hud.showEvent('VEHICLE STOLEN', car.model.name);
    G.missions?.onCarStolen(car);
  }
  G.hud.showVehicle(car);
  G.audio.blip(220, 0.08, 'square', 0.08);
}
export function exitCar(G) {
  const P = G.player, car = P.car;
  if (!car) return;
  car.kind = car.model.id === 'police' ? 'parked' : 'traffic';
  if (car.kind === 'traffic') { car.waypoint = null; car.cruiseSpeed = 7; }
  car.speed = 0;
  const side = car.angle + Math.PI / 2;
  P.x = car.mesh.position.x + Math.sin(side) * 2.2;
  P.z = car.mesh.position.z + Math.cos(side) * 2.2;
  if (insideBuilding(G.colliders, P.x, P.z, 0.4)) { P.x = car.mesh.position.x; P.z = car.mesh.position.z + 2.4; }
  P.car = null; P.mesh.visible = true;
  P.mesh.position.set(P.x, 0, P.z);
  G.audio.setEngine(false, 0);
  G.hud.hideVehicle();
}
export function updatePlayer(G, dt) {
  const P = G.player, inp = G.input;
  // Camera orbit from the mouse, plus a gentle ease behind movement.
  if (inp.locked) {
    P.camYaw -= inp.mouseDX * 0.0032;
    P.camPitch = clamp(P.camPitch + inp.mouseDY * 0.0024, 0.06, 1.1);
  }
  if (P.car) {
    drivePlayerCar(G, P.car, dt);
    P.x = P.car.mesh.position.x; P.z = P.car.mesh.position.z;
    P.angle = P.car.angle;
    const speedRatio = clamp(Math.abs(P.car.speed) / 30, 0, 1);
    const targetYaw = P.car.angle;
    if (!inp.locked || Math.abs(inp.mouseDX) < 0.01) P.camYaw = angleLerp(P.camYaw, targetYaw, dt * (0.7 + speedRatio));
    placeCamera(G, 8.5 + speedRatio * 3.5, 3.2);
    // E leaves the car once it is slow enough.
    if (inp.hit('KeyE') && Math.abs(P.car.speed) < 4) exitCar(G);
    return;
  }
  G.audio.setEngine(false, 0);
  const mv = inp.moveAxis();
  const running = inp.down('ShiftLeft') || inp.down('ShiftRight');
  const speed = running ? TUNING.runSpeed : TUNING.playerSpeed;
  if (mv.x !== 0 || mv.z !== 0) {
    // WASD is camera-relative: W walks away from the camera, D right.
    const worldAngle = P.camYaw + Math.atan2(mv.x, mv.z) + Math.PI;
    const nx = P.x + Math.sin(worldAngle) * speed * dt;
    const nz = P.z + Math.cos(worldAngle) * speed * dt;
    if (!insideBuilding(G.colliders, nx, P.z, 0.45)) P.x = nx;
    if (!insideBuilding(G.colliders, P.x, nz, 0.45)) P.z = nz;
    P.x = clamp(P.x, -CITY_EDGE - 12, CITY_EDGE + 12);
    P.z = clamp(P.z, -CITY_EDGE - 12, 138);
    P.angle = angleLerp(P.angle, worldAngle, clamp(dt * 12, 0, 1));
    P.walkPhase += dt * (running ? 12 : 8);
    if (!inp.locked) P.camYaw = angleLerp(P.camYaw, P.angle, dt * 1.6);
  }
  P.mesh.position.set(P.x, Math.abs(Math.sin(P.walkPhase)) * 0.05, P.z);
  P.mesh.rotation.y = P.angle;
  placeCamera(G, 7.2, 2.6);
  // The kevlar vest outside the station: walk into it on foot and the
  // armour tops up; the prop hides until its restock minute passes.
  if (G.vestMesh) {
    const ready = G.time >= (G.vestReadyAt || 0);
    G.vestMesh.visible = ready;
    if (ready && dist2d(P.x, P.z, G.vestMesh.position.x, G.vestMesh.position.z) < 2.4) {
      P.armour = 100;
      G.vestReadyAt = G.time + 60;
      G.vestMesh.visible = false;
      G.hud.showEvent('KEVLAR VEST', 'Armour topped up to 100.');
      G.audio.blip(520, 0.12, 'triangle', 0.1);
    }
  }
  // Context interaction: steal / enter the nearest car.
  const car = nearestCar(G, 3.4);
  G.nearCar = car;
  if (car && inp.hit('KeyE')) enterCar(G, car);
}
function placeCamera(G, dist, height) {
  const P = G.player;
  const cx = P.x - Math.sin(P.camYaw) * Math.cos(P.camPitch) * dist;
  const cz = P.z - Math.cos(P.camYaw) * Math.cos(P.camPitch) * dist;
  const cy = height + Math.sin(P.camPitch) * dist * 0.7;
  const shake = G.shake > 0 ? (Math.random() - 0.5) * G.shake : 0;
  G.camera.position.set(cx + shake, Math.max(1.2, cy), cz + shake);
  G.camera.lookAt(P.x, 1.6, P.z);
}
