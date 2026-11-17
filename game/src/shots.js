// Deterministic staging for screenshots: ?shot=<scene>&seed=1 sets a composed scene
// with a fixed camera and frozen HUD state. Normal play never calls this.
import { CHOP_SHOPS } from './config.js';
import { createCar } from './vehicles.js';
import { spawnPed } from './pedestrians.js';
import { setWanted } from './police.js';

export function parseShot() {
  const q = new URLSearchParams(location.search);
  const shot = q.get('shot');
  if (!shot) return null;
  return { scene: shot, seed: parseInt(q.get('seed') || '1', 10) || 1 };
}
function park(G, model, x, z, angle, kind = 'traffic') {
  const car = createCar(G, model, x, z, angle, kind);
  car.speed = 0;
  return car;
}
export function stageScene(G, scene) {
  const P = G.player;
  G.shotMode = scene;
  if (scene === 'cover') {
    // Police chase on a Marina boulevard: Rio's sports car fleeing, two cruisers behind.
    P.x = 2; P.z = 84; P.angle = 0;
    const hero = park(G, 'sports', 2, 84, 0, 'player');
    hero.stolen = true; hero.speed = 16;
    P.car = hero; P.mesh.visible = false;
    park(G, 'police', -2.5, 73, 0.1, 'police').speed = 15;
    park(G, 'police', 4.5, 67, -0.08, 'police').speed = 15;
    park(G, 'taxi', -24, 96, Math.PI / 2); park(G, 'sedan', 26, 70, -Math.PI / 2);
    for (let i = 0; i < 6; i++) spawnPed(G, -6 + i * 2.4, 96 + (i % 3));
    setWanted(G, 3);
    G.cash = 2450; G.completed = 2;
    G.missions.idx = 2; G.missions.stage = 0; G.missions.active = true;
    G.hud.setObjective('Stop the rival car (ram it or shoot it), then grab the briefcase.', { x: 30, z: 40 });
    P.camYaw = Math.PI; P.camPitch = 0.3;
    G.camera.position.set(2.5, 6, 54); G.camera.lookAt(0, 1.3, 84);
  } else if (scene === 'onfoot') {
    P.x = -22; P.z = 6; P.angle = 2.6; P.mesh.position.set(P.x, 0, P.z); P.mesh.rotation.y = P.angle;
    park(G, 'taxi', -26, 12, 0); park(G, 'sedan', -20, -14, Math.PI); park(G, 'compact', -6, 2, Math.PI / 2);
    for (let i = 0; i < 8; i++) spawnPed(G, -30 + i * 2.6, 8.5 - (i % 2) * 1.4);
    G.cash = 890; G.completed = 1;
    G.missions.idx = 1; G.missions.stage = 0; G.missions.active = true;
    G.hud.setObjective('Pick up the package in the Marina.', { x: 28, z: 80 });
    G.nearCar = G.cars[0];
    P.camYaw = 2.4; P.camPitch = 0.3;
    G.camera.position.set(-30, 3.4, 16); G.camera.lookAt(-18, 1.2, 0);
  } else if (scene === 'drive') {
    P.x = 54; P.z = -30; P.angle = Math.PI / 2;
    const hero = park(G, 'convertible', 54, -30, Math.PI / 2, 'player');
    hero.speed = 31; P.car = hero; P.mesh.visible = false;
    park(G, 'suv', 78, -36, Math.PI / 2); park(G, 'limo', 30, -24, -Math.PI / 2);
    for (let i = 0; i < 4; i++) spawnPed(G, 46 + i * 3, -21);
    G.cash = 1730; G.completed = 3;
    G.missions.idx = 3; G.missions.stage = 0; G.missions.active = true;
    G.hud.setObjective('Steal the Vesper GT from the Heights showroom.', { x: 54, z: -50 });
    G.hud.showVehicle(hero);
    P.camYaw = Math.PI / 2 + Math.PI; P.camPitch = 0.26;
    G.camera.position.set(34, 5, -31); G.camera.lookAt(62, 1.5, -28);
  } else if (scene === 'mission') {
    const shop = CHOP_SHOPS[0];
    P.x = shop.x + 1; P.z = shop.z + 12; P.angle = Math.PI;
    const hero = park(G, 'sedan', shop.x, shop.z + 8, Math.PI, 'player');
    hero.stolen = true; hero.health = 82; P.car = hero; P.mesh.visible = false;
    for (let i = 0; i < 3; i++) spawnPed(G, shop.x - 6 + i * 3, shop.z + 14);
    G.cash = 1250; G.completed = 0;
    G.missions.idx = 0; G.missions.stage = 1; G.missions.active = true;
    G.hud.setObjective('Deliver the stolen car to a chop shop garage.', { x: shop.x, z: shop.z + 7 });
    G.hud.banner('MISSION COMPLETE', 'First sale done. The fence remembers your face now.\n+$150 — Rank: Runner', 600);
    P.camYaw = 0; P.camPitch = 0.3;
    G.camera.position.set(shop.x - 11, 5, shop.z + 22); G.camera.lookAt(shop.x, 1.6, shop.z + 4);
  }
  G.hud.show();
  G.hud.update(0.016);
}
