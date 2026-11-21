// Builds Palmshade itself: gradient sky, ground, roads and sidewalks,
// instanced buildings with lit windows, Marina frontage dressing, palms,
// lamps, the sea and pier, both chop shops, the respawn pads, the kevlar
// vest prop, and the objective markers. Also owns the static building
// colliders and the road queries every other module uses.
import { WORLD, CITY_EDGE, roadCentres, districtAt, DISTRICT_PALETTES, CHOP_SHOPS, STATION } from './config.js';
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
// The golden-hour sky: a vertical gradient painted once onto a small
// canvas — deep violet at the zenith through pink to a pale cream
// horizon, the same cream the fog uses, so the city melts into it.
function paintSky(scene) {
  const cv = document.createElement('canvas'); cv.width = 4; cv.height = 256;
  const cx = cv.getContext('2d');
  const grad = cx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#3a2060');
  grad.addColorStop(0.42, '#b83a6e');
  grad.addColorStop(0.68, '#ff7a4d');
  grad.addColorStop(0.88, '#ffb37a');
  grad.addColorStop(1, '#ffd9a0');
  cx.fillStyle = grad; cx.fillRect(0, 0, 4, 256);
  scene.background = new THREE.CanvasTexture(cv);
}

export function buildWorld(G) {
  const { scene, rng } = G;
  const centres = roadCentres();
  G.colliders = [];
  paintSky(scene);
  // Ground: warm sand under everything.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(560, 560), new THREE.MeshLambertMaterial({ color: 0xd9b380 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; scene.add(ground);
  // Sea along the +z edge.
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(560, 190), new THREE.MeshLambertMaterial({ color: 0x2e9db8 }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(0, 0.02, WORLD.seaZ + 92); sea.name = 'sea'; scene.add(sea);
  G.sea = sea;
  // Pier: a wooden deck walking out over the water.
  const pier = new THREE.Mesh(new THREE.BoxGeometry(7, 0.7, 46), new THREE.MeshLambertMaterial({ color: 0x8a6844 }));
  pier.position.set(0, 0.45, WORLD.seaZ + 20); scene.add(pier);
  // Roads + sidewalks: one long strip per centreline, each way.
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
  // Buildings: one instanced box for the whole city, per-instance colour
  // from the district palette; the dims are kept for the dressing below.
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
  const dims = [];
  plots.forEach((p, i) => {
    const pal = DISTRICT_PALETTES[districtAt(p.x, p.z)];
    const h = pal.minH + rng() * (pal.maxH - pal.minH);
    const w = 6.5 + rng() * 2.6, d = 6.5 + rng() * 2.6;
    m4.makeScale(w, h, d).setPosition(p.x, 0, p.z);
    inst.setMatrixAt(i, m4);
    inst.setColorAt(i, col.setHex(rngPick(rng, pal.wall)));
    G.colliders.push({ x: p.x, z: p.z, hw: w / 2, hd: d / 2 });
    dims.push({ x: p.x, z: p.z, w, d, h });
  });
  inst.instanceMatrix.needsUpdate = true; if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  scene.add(inst);
  // Lit windows for the golden hour: one instanced plane mesh scattered
  // over the south and east faces of those same buildings — warm
  // front-room light, the odd cool television — so flat slabs read as
  // lived in at dusk without a single dynamic light.
  const winSpots = [];
  const winCols = [0xffc978, 0xffc978, 0xffe2ae, 0xff9d5c, 0xa8d8ff];
  for (const b of dims) {
    const n = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      const y = 1.9 + rng() * Math.max(1, b.h - 3);
      if (rng() < 0.55) winSpots.push({ x: b.x + (rng() * 2 - 1) * (b.w / 2 - 1.1), y, z: b.z - b.d / 2 - 0.07, a: Math.PI, c: rngPick(rng, winCols) });
      else winSpots.push({ x: b.x + b.w / 2 + 0.07, y, z: b.z + (rng() * 2 - 1) * (b.d / 2 - 1.1), a: Math.PI / 2, c: rngPick(rng, winCols) });
    }
  }
  const winInst = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.95, 1.25), new THREE.MeshBasicMaterial({ color: 0xffffff }), Math.max(1, winSpots.length));
  { const q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    winSpots.forEach((w, i) => { e.set(0, w.a, 0); q.setFromEuler(e); v.set(w.x, w.y, w.z); m4.compose(v, q, one); winInst.setMatrixAt(i, m4); winInst.setColorAt(i, col.setHex(w.c)); }); }
  winInst.count = winSpots.length;
  winInst.instanceMatrix.needsUpdate = true; if (winInst.instanceColor) winInst.instanceColor.needsUpdate = true;
  scene.add(winInst);
  // Marina frontage: striped awnings and bright sign boards on the
  // faces lining the boulevard roads — two instanced meshes total, so
  // the commercial strip reads without a draw-call bill.
  const frontage = dims.filter((b) => b.z > 30 && (Math.abs(b.z - 78) < 26 || Math.abs(b.z - 104) < 20));
  const awnings = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff }), Math.max(1, frontage.length));
  const signs = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), Math.max(1, frontage.length));
  const frontCols = [0xff2e7e, 0x2ec4c6, 0xffb020, 0xff5e3a, 0x7dff8a];
  frontage.forEach((b, i) => {
    const faceZ = b.z - b.d / 2 - 0.9;
    m4.makeScale(Math.min(6, b.w * 0.8), 0.28, 1.8).setPosition(b.x, 2.7, faceZ);
    awnings.setMatrixAt(i, m4); awnings.setColorAt(i, col.setHex(frontCols[i % frontCols.length]));
    m4.makeScale(3.4, 0.95, 0.22).setPosition(b.x, 4.1, faceZ - 0.4);
    signs.setMatrixAt(i, m4); signs.setColorAt(i, col.setHex(frontCols[(i + 2) % frontCols.length]));
  });
  awnings.count = frontage.length; signs.count = frontage.length;
  awnings.instanceMatrix.needsUpdate = true; if (awnings.instanceColor) awnings.instanceColor.needsUpdate = true;
  signs.instanceMatrix.needsUpdate = true; if (signs.instanceColor) signs.instanceColor.needsUpdate = true;
  scene.add(awnings, signs);
  // Palms: the Marina rows, a dense double row along the z=78 boulevard
  // every thirteen metres, and scattered shade elsewhere.
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.24, 4.6, 5); trunkGeo.translate(0, 2.3, 0);
  const frondGeo = new THREE.ConeGeometry(2.3, 1.1, 6); frondGeo.translate(0, 4.9, 0);
  const palmSpots = [];
  for (const c of centres) for (const s of [-1, 1]) {
    palmSpots.push({ x: c + s * 7.6, z: 92 + (rng() - 0.5) * 4 });
    if (rng() < 0.55) palmSpots.push({ x: c + (rng() - 0.5) * 8, z: -WORLD.step * 2 + s * 7.6 });
  }
  for (let x = -CITY_EDGE; x <= CITY_EDGE; x += 13) for (const s of [-1, 1]) {
    palmSpots.push({ x: x + (rng() - 0.5) * 2, z: 78 + s * 7.6 });
  }
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: 0x7a5a38 }), palmSpots.length);
  const fronds = new THREE.InstancedMesh(frondGeo, new THREE.MeshLambertMaterial({ color: 0x2e9e4f }), palmSpots.length);
  palmSpots.forEach((p, i) => {
    m4.makeRotationY(rng() * 6.28).setPosition(p.x, 0, p.z);
    trunks.setMatrixAt(i, m4); fronds.setMatrixAt(i, m4);
    G.colliders.push({ x: p.x, z: p.z, hw: 0.35, hd: 0.35, soft: true });
  });
  scene.add(trunks, fronds);
  // Lamps at every intersection.
  const lampGeo = new THREE.BoxGeometry(0.22, 5.4, 0.22); lampGeo.translate(0, 2.7, 0);
  const lampSpots = [];
  for (const cx of centres) for (const cz of centres) lampSpots.push({ x: cx + 5.6, z: cz + 5.6 });
  const lamps = new THREE.InstancedMesh(lampGeo, new THREE.MeshLambertMaterial({ color: 0x44484e }), lampSpots.length);
  lampSpots.forEach((p, i) => { m4.identity().setPosition(p.x, 0, p.z); lamps.setMatrixAt(i, m4); });
  scene.add(lamps);
  // Chop shop garages: a wide box, a bright door, a pink sign board.
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
  // The kevlar vest prop: a dark vest on a crate, seven metres in front
  // of the station door. Walking into it tops armour up; it restocks a
  // minute later (player.js runs the pickup, main.js the visibility).
  const vest = new THREE.Group();
  const crate = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 1.2), new THREE.MeshLambertMaterial({ color: 0x8a6844 }));
  crate.position.y = 0.35; vest.add(crate);
  const shell = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.55, 0.45), new THREE.MeshLambertMaterial({ color: 0x22303c }));
  shell.position.y = 0.98; vest.add(shell);
  vest.position.set(STATION.x, 0, STATION.z + 7);
  scene.add(vest);
  G.vestMesh = vest; G.vestReadyAt = 0;
  // Objective light column + ground ring, moved by the mission runner.
  const column = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false }));
  column.position.y = 30; column.visible = false; scene.add(column);
  G.objectiveColumn = column;
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 3, 24), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; ring.visible = false; scene.add(ring);
  G.objectiveRing = ring;
}
