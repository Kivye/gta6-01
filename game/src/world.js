// Builds Palmshade: ground, roads, sidewalks, instanced buildings, palms, lamps,
// the sea and the pier. Also owns the static building colliders and road queries.
import { WORLD, CITY_EDGE, roadCentres, districtAt, DISTRICT_PALETTES, CHOP_SHOPS } from './config.js';
import { rngPick } from './random.js';

export function isOnRoad(x, z) {
  const s = WORLD.step;
  const near = (v) => Math.abs(v - Math.round(v / s) * s) < WORLD.roadHalf + 0.4;
  return near(x) || near(z);
}
export function snapToRoad(v) { return Math.round(v / WORLD.step) * WORLD.step; }
export function insideBuilding(colliders, x, z, pad = 0) {
  for (const c of colliders) {
    if (Math.abs(x - c.x) < c.hw + pad && Math.abs(z - c.z) < c.hd + pad) return c;
  }
  return null;
}

export function buildWorld(G) {
  const { scene, rng } = G;
  const centres = roadCentres();
  G.colliders = [];
  // Ground: warm sand under everything.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(560, 560), new THREE.MeshLambertMaterial({ color: 0xd9b380 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; scene.add(ground);
  // Sea along the +z edge, gently lighter than the sky fog.
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(560, 190), new THREE.MeshLambertMaterial({ color: 0x2e9db8 }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(0, 0.02, WORLD.seaZ + 92); sea.name = 'sea'; scene.add(sea);
  G.sea = sea;
  // Pier: wooden deck walking out over the water.
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6844 });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(7, 0.7, 46), pierMat);
  pier.position.set(0, 0.45, WORLD.seaZ + 20); scene.add(pier);
  // Roads + sidewalks: one long strip per centreline each way.
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x3d3a40 });
  const walkMat = new THREE.MeshLambertMaterial({ color: 0xbfae94 });
  const span = CITY_EDGE + WORLD.step;
  for (const c of centres) {
    for (const horiz of [true, false]) {
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(horiz ? span * 2 : WORLD.walkHalf * 2, horiz ? WORLD.walkHalf * 2 : span * 2), walkMat);
      walk.rotation.x = -Math.PI / 2; walk.position.set(horiz ? 0 : c, 0.0, horiz ? c : 0); scene.add(walk);
      const road = new THREE.Mesh(new THREE.PlaneGeometry(horiz ? span * 2 : WORLD.roadHalf * 2, horiz ? WORLD.roadHalf * 2 : span * 2), roadMat);
      road.rotation.x = -Math.PI / 2; road.position.set(horiz ? 0 : c, 0.015, horiz ? c : 0); scene.add(road);
    }
  }
  // Buildings: one instanced box, per-instance colour from the district palette.
  const plots = [];
  for (let bx = -WORLD.halfRoads; bx < WORLD.halfRoads; bx++) {
    for (let bz = -WORLD.halfRoads; bz < WORLD.halfRoads; bz++) {
      const cx = bx * WORLD.step + WORLD.step / 2, cz = bz * WORLD.step + WORLD.step / 2;
      const per = rng() < 0.4 ? 1 : 2;
      for (let k = 0; k < per; k++) {
        const off = per === 1 ? 0 : (k === 0 ? -4.6 : 4.6);
        plots.push({ x: cx + off, z: cz + (per === 1 ? 0 : off * 0.4) });
      }
    }
  }
  const boxGeo = new THREE.BoxGeometry(1, 1, 1); boxGeo.translate(0, 0.5, 0);
  const inst = new THREE.InstancedMesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), plots.length);
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  plots.forEach((p, i) => {
    const pal = DISTRICT_PALETTES[districtAt(p.x, p.z)];
    const h = pal.minH + rng() * (pal.maxH - pal.minH);
    const w = 6.5 + rng() * 2.6, d = 6.5 + rng() * 2.6;
    m4.makeScale(w, h, d).setPosition(p.x, 0, p.z);
    inst.setMatrixAt(i, m4);
    inst.setColorAt(i, col.setHex(rngPick(rng, pal.wall)));
    G.colliders.push({ x: p.x, z: p.z, hw: w / 2, hd: d / 2 });
  });
  inst.instanceMatrix.needsUpdate = true; if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  scene.add(inst);
  // Palms along the Marina rows and scattered elsewhere; lamps at intersections.
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.24, 4.6, 5); trunkGeo.translate(0, 2.3, 0);
  const frondGeo = new THREE.ConeGeometry(2.3, 1.1, 6); frondGeo.translate(0, 4.9, 0);
  const palmSpots = [];
  for (const c of centres) for (const s of [-1, 1]) {
    palmSpots.push({ x: c + s * 7.6, z: 92 + (rng() - 0.5) * 4 });
    if (rng() < 0.55) palmSpots.push({ x: c + (rng() - 0.5) * 8, z: -WORLD.step * 2 + s * 7.6 });
  }
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: 0x7a5a38 }), palmSpots.length);
  const fronds = new THREE.InstancedMesh(frondGeo, new THREE.MeshLambertMaterial({ color: 0x2e9e4f }), palmSpots.length);
  palmSpots.forEach((p, i) => {
    m4.makeRotationY(rng() * 6.28).setPosition(p.x, 0, p.z);
    trunks.setMatrixAt(i, m4); fronds.setMatrixAt(i, m4);
    G.colliders.push({ x: p.x, z: p.z, hw: 0.35, hd: 0.35, soft: true });
  });
  scene.add(trunks, fronds);
  const lampGeo = new THREE.BoxGeometry(0.22, 5.4, 0.22); lampGeo.translate(0, 2.7, 0);
  const lampSpots = [];
  for (const cx of centres) for (const cz of centres) lampSpots.push({ x: cx + 5.6, z: cz + 5.6 });
  const lamps = new THREE.InstancedMesh(lampGeo, new THREE.MeshLambertMaterial({ color: 0x44484e }), lampSpots.length);
  lampSpots.forEach((p, i) => { m4.identity().setPosition(p.x, 0, p.z); lamps.setMatrixAt(i, m4); });
  scene.add(lamps);
  // Chop shop garages: a wide box with a bright door and a pink sign board.
  G.chopMeshes = [];
  for (const shop of CHOP_SHOPS) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(13, 5, 10), new THREE.MeshLambertMaterial({ color: 0x5a4a3a }));
    body.position.y = 2.5; g.add(body);
    const door = new THREE.Mesh(new THREE.BoxGeometry(7, 3.6, 0.3), new THREE.MeshLambertMaterial({ color: 0xffb020, emissive: 0x664400 }));
    door.position.set(0, 1.8, 5.1); g.add(door);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(9, 1.1, 0.3), new THREE.MeshLambertMaterial({ color: 0xff2e7e, emissive: 0x550022 }));
    sign.position.set(0, 5.4, 3); g.add(sign);
    g.position.set(shop.x, 0, shop.z); scene.add(g);
    G.chopMeshes.push(g);
    G.colliders.push({ x: shop.x, z: shop.z - 3, hw: 6.5, hd: 3.4 });
  }
  // Hospital + station pads Rio respawns on.
  const pad = (x, z, color) => {
    const p = new THREE.Mesh(new THREE.CircleGeometry(3.4, 20), new THREE.MeshBasicMaterial({ color }));
    p.rotation.x = -Math.PI / 2; p.position.set(x, 0.04, z); scene.add(p);
  };
  pad(-78, 78, 0xffffff); pad(26, -78, 0x3a6fd8);
  // Objective light column + ground ring, moved by the mission runner.
  const column = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false }));
  column.position.y = 30; column.visible = false; scene.add(column);
  G.objectiveColumn = column;
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 3, 24), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; ring.visible = false; scene.add(ring);
  G.objectiveRing = ring;
}
