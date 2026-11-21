// Deterministic staging for the four screenshots: ?shot=<scene>&seed=1
// composes a tableau with a fixed camera and staged-but-real game state
// (every HUD figure in these frames is read from the same state the
// panels read in play). Normal play never calls this. Scenes: cover
// (the boulevard chase), onfoot (the first steal), stats (the pause
// career panel over a Heights chase) and mission (the fence quote).
import { CHOP_SHOPS } from './config.js';
import { createCar } from './vehicles.js';
import { spawnPed } from './pedestrians.js';
import { setWanted, ensureHeli, updateHeli } from './police.js';

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
    // The boulevard chase, photographed from the front: the hero Vesper
    // GT runs at the camera down the Marina strip, two cruisers flank
    // behind it, a third trails in smoking, a fourth answers from far
    // off, and AIR-1 holds the light over all of it at four stars.
    P.x = 0; P.z = 88; P.angle = 0;
    const hero = park(G, 'sports', 0, 88, 0, 'player');
    hero.stolen = true; hero.health = 88; hero.speed = 17;
    P.car = hero; P.mesh.visible = false;
    park(G, 'police', -2.2, 77, 0.08, 'police').speed = 15;
    park(G, 'police', 2.2, 78.5, -0.08, 'police').speed = 15;
    const hurt = park(G, 'police', 0, 64, 0, 'police');
    hurt.speed = 13; hurt.health = 30; // the smoking unit: damage you can see
    park(G, 'police', 0, 28, 0, 'police').speed = 12;
    // Filler traffic on the cross streets, both sides of the boulevard.
    park(G, 'taxi', -24, 96, Math.PI / 2); park(G, 'sedan', 26, 70, -Math.PI / 2);
    park(G, 'convertible', -26, 64, 0); park(G, 'pickup', 26, 96, -Math.PI / 2);
    for (let i = 0; i < 11; i++) spawnPed(G, -8 + i * 1.7, 96 + (i % 3));
    setWanted(G, 4);
    G.sightSeen = true; // four cruisers on an open boulevard: Rio is seen
    ensureHeli(G); updateHeli(G, 0.4);
    G.cash = 2450; G.completed = 2; G.respect = 300;
    G.standing['Marina'] = 58;
    G.missions.idx = 2; G.missions.stage = 0; G.missions.active = true;
    G.hud.setObjective('Stop the rival car (ram it or shoot it), then grab the briefcase.', { x: 52, z: 26 });
    P.camYaw = Math.PI; P.camPitch = 0.3;
    G.camera.position.set(2.5, 3.6, 103); G.camera.lookAt(0, 4.2, 82);
  } else if (scene === 'onfoot') {
    // The first steal: Rio on foot in an Old Town street, the Regent
    // Limo ahead of him wearing the objective column, mission 1 stage 0.
    P.x = -24.5; P.z = 5; P.angle = 2.9; P.mesh.position.set(P.x, 0, P.z); P.mesh.rotation.y = P.angle;
    const limo = park(G, 'limo', -26.5, -3, 0);
    park(G, 'taxi', -26.5, 14, 0); park(G, 'compact', -14, 0, Math.PI / 2);
    for (let i = 0; i < 8; i++) spawnPed(G, -31 + (i % 2) * 1.3, 10 - i * 2.4);
    G.cash = 890; G.completed = 0; G.respect = 40;
    G.missions.idx = 0; G.missions.stage = 0; G.missions.active = true;
    G.hud.setObjective('Steal any car (walk up and press E).', { x: -26.5, z: -3 });
    G.nearCar = limo;
    P.camYaw = 2.9; P.camPitch = 0.3;
    G.camera.position.set(-29.5, 2.8, 12.5); G.camera.lookAt(-25, 1.2, 0);
  } else if (scene === 'stats') {
    // The pause career panel over the Heights descent: hero cabrio, one
    // cruiser on its tail, two stars — and a mid-story career staged as
    // ordinary state for the panel to read.
    P.x = 54; P.z = -30; P.angle = Math.PI / 2;
    const hero = park(G, 'convertible', 54, -30, Math.PI / 2, 'player');
    hero.speed = 31; hero.health = 76; P.car = hero; P.mesh.visible = false;
    park(G, 'police', 43, -27.5, Math.PI / 2, 'police').speed = 28;
    for (let i = 0; i < 4; i++) spawnPed(G, 46 + i * 3, -21);
    setWanted(G, 2);
    G.cash = 1730; G.completed = 3; G.respect = 940;
    G.stats = { stolen: 14, fenced: 9, distKm: 23.6, topSpeed: 128, escapes: 5, shots: 41, earned: 6840, crewUsed: 6, nearMiss: 17 };
    G.standing = { 'Marina': 58, 'Old Town': 74, 'The Heights': 41 };
    G.missions.idx = 3; G.missions.stage = 0; G.missions.active = true;
    G.hud.setObjective('Steal the Vesper GT from the Heights showroom.', { x: 54, z: -50 });
    G.hud.showVehicle(hero);
    P.camYaw = Math.PI / 2 + Math.PI; P.camPitch = 0.26;
    G.camera.position.set(34, 6.5, -20); G.camera.lookAt(64, 1, -29);
  } else if (scene === 'mission') {
    // The moment before the sale: a stolen Meridian idles in the West
    // Chop Shop bay at mission 1 stage 1, and the fence panel quoting
    // its real price is the star — no completion banner. Four stars of
    // heat stand behind it, one cruiser parked across Rio's way out as
    // the roadblock, so the dispatch panel reads ROADBLOCK too.
    const shop = CHOP_SHOPS[0];
    P.x = shop.x; P.z = shop.z + 7; P.angle = Math.PI;
    const hero = park(G, 'sedan', shop.x, shop.z + 7, Math.PI, 'player');
    hero.stolen = true; hero.health = 82; hero.speed = 0;
    P.car = hero; P.mesh.visible = false;
    park(G, 'police', -26, -33, -0.9, 'police');
    const block = park(G, 'police', shop.x, shop.z - 8, Math.PI / 2, 'police');
    block.roadblock = { phase: 'hold', until: 1e9 };
    G.rbNextAt = 1e9;
    for (let i = 0; i < 3; i++) spawnPed(G, shop.x - 6 + i * 3, shop.z + 14);
    setWanted(G, 4);
    G.cash = 1250; G.completed = 0;
    G.missions.idx = 0; G.missions.stage = 1; G.missions.active = true;
    G.hud.setObjective('Deliver the stolen car to a chop shop garage.', { x: shop.x, z: shop.z + 7 });
    P.camYaw = 0; P.camPitch = 0.3;
    G.camera.position.set(shop.x - 7, 3.6, shop.z + 19); G.camera.lookAt(shop.x, 1.6, shop.z + 4);
  }
  G.hud.show();
  G.hud.update(0.016);
  if (scene === 'stats') {
    // Freeze on the pause screen: the career panel over the chase. The
    // minimap gets an explicit draw — paused frames stop the HUD tick
    // that normally paints it every second frame.
    G.hud.drawMinimap();
    G.state = 'paused';
    G.hud.showStats(G);
  }
}
