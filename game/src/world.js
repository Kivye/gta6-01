'use strict';

var WORLD = {
  scene: null, camera: null, renderer: null, sun: null, hemi: null, nightF: 0,
  solids: [], hydrants: [], vest: null, marker: null, rain: null, winMat: null, lampGlow: null,
  mats: {},
  mat: function (color, emissive) {
    var k = color + '/' + (emissive || 0);
    if (!this.mats[k]) this.mats[k] = new THREE.MeshLambertMaterial({ color:color, emissive: emissive || 0x000000 });
    return this.mats[k];
  },
  box: function (w, h, d, color, x, y, z, parent, emissive) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.mat(color, emissive));
    m.position.set(x, y, z); (parent || this.scene).add(m); return m;
  },
  signTexture: function (text, bg, fg) {
    var cv = document.createElement('canvas'); cv.width = 256; cv.height = 80;
    var g = cv.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, 256, 80);
    g.fillStyle = fg; g.font = 'bold 40px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 128, 42);
    var t = new THREE.CanvasTexture(cv); return t;
  },
  build: function () {
    var r = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'low-power' });
    r.setPixelRatio(1); r.setSize(innerWidth, innerHeight);
    document.getElementById('game').appendChild(r.domElement);
    this.renderer = r;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 900);
    this.scene.fog = new THREE.Fog(0xf7e3b0, 130, 430);
    this.hemi = new THREE.HemisphereLight(0xbfe3ff, 0x8a6f4d, 0.8); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffe3b3, 1.05); this.sun.position.set(60, 95, 30); this.scene.add(this.sun);
    this.buildSky(); this.buildGround(); this.buildBlocks(); this.buildPalms();
    this.buildLamps(); this.buildProps(); this.buildRain();
    var mk = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 34, 12, 1, true),
      new THREE.MeshBasicMaterial({ color:0xffc93c, transparent: true, opacity: 0.33, side: THREE.DoubleSide, depthWrite: false }));
    mk.position.y = 17; mk.visible = false; this.scene.add(mk); this.marker = mk;
    addEventListener('resize', function () { WORLD.camera.aspect = innerWidth / innerHeight; WORLD.camera.updateProjectionMatrix(); WORLD.renderer.setSize(innerWidth, innerHeight); });
  },
  buildSky: function () {
    var geo = new THREE.SphereGeometry(430, 14, 9), pos = geo.attributes.position, cols = [];
    this._skyDay = []; this._skyNight = [];
    var day = [[0.16, 0.11, 0.36], [0.79, 0.31, 0.49], [0.95, 0.55, 0.29], [0.97, 0.89, 0.69]];
    var night = [[0.01, 0.02, 0.06], [0.04, 0.08, 0.2], [0.1, 0.17, 0.33], [0.16, 0.27, 0.42]];
    for (var i = 0; i < pos.count; i++) {
      var t = clamp((pos.getY(i) / 430 + 0.12) * 1.6, 0, 1), seg = Math.min(2, Math.floor(t * 3)), f = t * 3 - seg;
      var cd = [], cn = [];
      for (var k = 0; k < 3; k++) { cd.push(lerp(day[seg][k], day[seg + 1][k], f)); cn.push(lerp(night[seg][k], night[seg + 1][k], f)); }
      this._skyDay.push(cd); this._skyNight.push(cn); cols.push(cd[0], cd[1], cd[2]);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    var sky = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
    this.scene.add(sky); this._skyGeo = geo;
  },
  applyNight: function (f) {
    this.nightF = f;
    var cols = this._skyGeo.attributes.color;
    for (var i = 0; i < cols.count; i++) {
      var d = this._skyDay[i], n = this._skyNight[i];
      cols.setXYZ(i, lerp(d[0], n[0], f), lerp(d[1], n[1], f), lerp(d[2], n[2], f));
    }
    cols.needsUpdate = true;
    this.sun.intensity = lerp(1.05, 0.28, f);
    this.sun.color.setHSL(0.1, 0.5, lerp(0.85, 0.72, f));
    this.hemi.intensity = lerp(0.8, 0.34, f);
    this.scene.fog.color.setRGB(lerp(0.97, 0.04, f), lerp(0.89, 0.07, f), lerp(0.69, 0.15, f));
    if (this.winMat) this.winMat.opacity = 0.3 + 0.7 * f;
    if (this.lampGlow) this.lampGlow.material.opacity = 0.85 * f;
  },
  buildGround: function () {
    var g = new THREE.Mesh(new THREE.PlaneGeometry(250, 250), this.mat(0x87a860));
    g.rotation.x = -Math.PI / 2; this.scene.add(g);
    var walk = this.mat(0x9aa0a3), road = this.mat(0x33373d), dash = this.mat(0xe8d44d);
    var i, j, m;
    for (i = 0; i < ROADS.length; i++) {
      m = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W + 4, 236), walk); m.rotation.x = -Math.PI / 2; m.position.set(ROADS[i], 0.01, 0); this.scene.add(m);
      m = new THREE.Mesh(new THREE.PlaneGeometry(236, ROAD_W + 4), walk); m.rotation.x = -Math.PI / 2; m.position.set(0, 0.01, ROADS[i]); this.scene.add(m);
      m = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, 236), road); m.rotation.x = -Math.PI / 2; m.position.set(ROADS[i], 0.02, 0); this.scene.add(m);
      m = new THREE.Mesh(new THREE.PlaneGeometry(236, ROAD_W), road); m.rotation.x = -Math.PI / 2; m.position.set(0, 0.02, ROADS[i]); this.scene.add(m);
    }
    var dashGeo = new THREE.BoxGeometry(0.35, 0.04, 3), dashes = new THREE.InstancedMesh(dashGeo, dash, 260), M = new THREE.Matrix4(), n = 0;
    for (i = 0; i < ROADS.length; i++) for (j = -110; j < 112; j += 9) {
      if (n < 260) { M.setPosition(ROADS[i], 0.04, j); dashes.setMatrixAt(n++, M); }
      if (n < 260) { M.makeRotationY(Math.PI / 2); M.setPosition(j, 0.04, ROADS[i]); dashes.setMatrixAt(n++, M); }
    }
    dashes.count = n; this.scene.add(dashes);

    this.box(38, 0.5, 22, 0x8a6a44, -16, 0.25, 101, this.scene);
    for (i = -32; i <= 0; i += 8) this.box(0.5, 1.6, 0.5, 0x6e5436, i, -0.4, 92, this.scene);
  },
  reserved: function (x, z) {
    var R = [[GARAGE.x, GARAGE.z, 11], [SHOWROOM.x, SHOWROOM.z, 10], [-66, -58, 11], [64, 20, 10], [39, 13, 12]];
    for (var i = 0; i < R.length; i++) if (dist2d(x, z, R[i][0], R[i][1]) < R[i][2]) return true;
    for (i = 0; i < TRANSMITTERS.length; i++) if (dist2d(x, z, TRANSMITTERS[i].x, TRANSMITTERS[i].z) < 8) return true;
    return false;
  },
  buildBlocks: function () {
    var palette = [0xe8d8b0, 0xd9a066, 0xb8c4cc, 0xe2e2e2, 0xc96f4a, 0x7fb3c8, 0xd8b7d4, 0xf0e0a0];
    var winPos = [], winCol = [];
    var awnM = [], signM = [], signC = [];
    var M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), S3 = new THREE.Vector3(1, 1, 1), P3 = new THREE.Vector3();
    var bright = [0xff5d5d, 0xffc93c, 0x4dd0e1, 0xff8ac2, 0x9dff57, 0xff9f43];
    for (var bi = 0; bi < 6; bi++) for (var bj = 0; bj < 6; bj++) {
      var cx = -65 + bi * 26, cz = -65 + bj * 26;
      if (this.reserved(cx, cz)) continue;
      var d = districtAt(cx, cz);
      var wdt = rand(13, 18), dep = rand(13, 18), h = d === 'The Heights' ? rand(15, 32) : d === 'Marina' ? rand(8, 19) : rand(6, 13);
      var col = pick(palette);
      this.box(wdt, h, dep, col, cx, h / 2, cz, this.scene);
      this.box(wdt + 0.6, 0.5, dep + 0.6, 0x555c66, cx, h + 0.25, cz, this.scene);
      this.solids.push({ x0:cx - wdt / 2, z0:cz - dep / 2, x1:cx + wdt / 2, z1:cz + dep / 2 });

      for (var wy = 2.2; wy < h - 1; wy += 2.6) for (var wx = -wdt / 2 + 1.6; wx < wdt / 2 - 1; wx += 2.4) {
        if (!chance(0.55)) continue;
        winPos.push([cx + wx, wy, cz + dep / 2 + 0.06, 0]);
        winCol.push(chance(0.8) ? [1, 0.75, 0.42] : [0.55, 0.75, 1]);
        if (chance(0.5)) { winPos.push([cx + wdt / 2 + 0.06, wy, cz + wx * (dep / wdt), 1]); winCol.push([1, 0.72, 0.4]); }
      }

      if (d === 'Marina' && cz > 30) {
        P3.set(cx, 3.1, cz + dep / 2 + 1.1); awnM.push(M4.compose(P3, Q, new THREE.Vector3(wdt * 0.8, 0.25, 2.4)).clone());
        P3.set(cx, 4.6, cz + dep / 2 + 0.15); signM.push(M4.compose(P3, Q, S3).clone()); signC.push(pick(bright));
      }
    }
    var wg = new THREE.PlaneGeometry(1.0, 1.3);
    this.winMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.3, side: THREE.DoubleSide });
    var wins = new THREE.InstancedMesh(wg, this.winMat, winPos.length);
    for (var i = 0; i < winPos.length; i++) {
      var p = winPos[i];
      M4.makeRotationY(p[3] ? Math.PI / 2 : 0); M4.setPosition(p[0], p[1], p[2]);
      wins.setMatrixAt(i, M4); wins.setColorAt(i, new THREE.Color(winCol[i][0], winCol[i][1], winCol[i][2]));
    }
    this.scene.add(wins);
    var awns = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), this.mat(0xd64541), awnM.length);
    for (i = 0; i < awnM.length; i++) { awns.setMatrixAt(i, awnM[i]); awns.setColorAt(i, new THREE.Color(pick(bright))); }
    this.scene.add(awns);
    var signs = new THREE.InstancedMesh(new THREE.PlaneGeometry(7, 1.6), new THREE.MeshBasicMaterial({}), signM.length);
    for (i = 0; i < signM.length; i++) { signs.setMatrixAt(i, signM[i]); signs.setColorAt(i, new THREE.Color(signC[i])); }
    this.scene.add(signs);

    this.specialBuilding(39, 13, 16, 11, 14, 0x4a5a75, 'PSPD', COP_DOOR);
    this.specialBuilding(-39, 39, 15, 10, 13, 0xe8e6df, 'HOSPITAL', HOSPITAL);
    this.specialBuilding(64, 20, 15, 30, 15, 0x3d4454, 'PENTHOUSE', null);
  },
  specialBuilding: function (cx, cz, w, h, dep, col, label, door) {
    this.box(w, h, dep, col, cx, h / 2, cz, this.scene);
    this.box(w + 0.6, 0.5, dep + 0.6, 0x555c66, cx, h + 0.25, cz, this.scene);
    this.solids.push({ x0:cx - w / 2, z0:cz - dep / 2, x1:cx + w / 2, z1:cz + dep / 2 });
    var t = new THREE.Mesh(new THREE.PlaneGeometry(8, 2.4), new THREE.MeshBasicMaterial({ map: this.signTexture(label, '#141a26', '#ffd75e') }));
    t.position.set(cx, h - 1.6, cz - dep / 2 - 0.1); t.rotation.y = Math.PI; this.scene.add(t);
  },
  buildPalms: function () {
    var spots = [];
    for (var x = -104; x <= 104; x += 13) { spots.push([x + rand(-1.5, 1.5), 66.5]); spots.push([x + rand(-1.5, 1.5), 89.5]); }
    for (var i = 0; i < 18; i++) spots.push([rand(-100, 100), rand(45, 100)]);
    var trunkG = new THREE.CylinderGeometry(0.16, 0.3, 4.6, 5), crownG = new THREE.SphereGeometry(1.9, 7, 5);
    var trunks = new THREE.InstancedMesh(trunkG, this.mat(0x8a6a44), spots.length);
    var crowns = new THREE.InstancedMesh(crownG, this.mat(0x3f9e4d), spots.length);
    var M = new THREE.Matrix4(), E = new THREE.Euler(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), Sv = new THREE.Vector3(1, 0.55, 1);
    for (i = 0; i < spots.length; i++) {
      E.set(rand(-0.07, 0.07), rand(0, 6.28), rand(-0.07, 0.07)); Q.setFromEuler(E);
      V.set(spots[i][0], 2.3, spots[i][1]); M.compose(V, Q, new THREE.Vector3(1, 1, 1)); trunks.setMatrixAt(i, M);
      V.set(spots[i][0], 4.9, spots[i][1]); M.compose(V, Q, Sv); crowns.setMatrixAt(i, M);
    }
    this.scene.add(trunks); this.scene.add(crowns);
  },
  buildLamps: function () {
    var pos = [];
    for (var i = 0; i < ROADS.length; i++) for (var j = -104; j <= 104; j += 26) { pos.push([ROADS[i] + 8.6, j]); pos.push([j, ROADS[i] - 8.6]); }
    var poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.09, 5.4, 5), this.mat(0x3a4048), pos.length);
    var M = new THREE.Matrix4();
    var gpos = new Float32Array(pos.length * 3);
    for (i = 0; i < pos.length; i++) {
      M.setPosition(pos[i][0], 2.7, pos[i][1]); poles.setMatrixAt(i, M);
      gpos[i * 3] = pos[i][0]; gpos[i * 3 + 1] = 5.5; gpos[i * 3 + 2] = pos[i][1];
      this.box(0.5, 0.18, 0.5, 0xffe9a8, pos[i][0], 5.45, pos[i][1], this.scene, 0x554411);
    }
    this.scene.add(poles);
    var gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(gpos, 3));
    this.lampGlow = new THREE.Points(gg, new THREE.PointsMaterial({ color:0xffd98a, size: 2.6, transparent: true, opacity: 0, sizeAttenuation: true, depthWrite: false }));
    this.scene.add(this.lampGlow);
  },
  buildProps: function () {

    var spots = [[-33, 20], [7, -33], [33, 33], [-59, -59], [59, 59], [20, 71], [-13, 85], [45, -13], [-45, 13], [85, -33], [-85, 45], [13, -59]];
    for (var i = 0; i < spots.length; i++) {
      var grp = new THREE.Group(); grp.position.set(spots[i][0], 0, spots[i][1]);
      var body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.9, 7), this.mat(0xc22e2e)); body.position.y = 0.45; grp.add(body);
      var cap = new THREE.Mesh(new THREE.SphereGeometry(0.3, 7, 5), this.mat(0xe8e6df)); cap.position.y = 0.98; grp.add(cap);
    var sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(72), 3));
      var spray = new THREE.Points(sg, new THREE.PointsMaterial({ color:0xbfe3ff, size: 0.4, transparent: true, opacity: 0.9 }));
      spray.visible = false; grp.add(spray);
      this.scene.add(grp);
      this.hydrants.push({ x:spots[i][0], z:spots[i][1], burstT: 0, spray: spray, grp:grp });
    }

    var vg = new THREE.Group(); vg.position.set(VEST_POS.x, 0, VEST_POS.z);
    var crate = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 1.1), this.mat(0x8a6a44)); crate.position.y = 0.35; vg.add(crate);
    var vest = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.55, 0.45), this.mat(0x232a33)); vest.position.y = 0.95; vg.add(vest);
    this.scene.add(vg); this.vest = { grp:vg, mesh:vest, available: true, respawnT: 0 };

    var van = new THREE.Group(); van.position.set(GUNVAN.x, 0, GUNVAN.z); van.rotation.y = Math.PI / 2;
    var vb = new THREE.Mesh(new THREE.BoxGeometry(5.2, 2.3, 2.1), this.mat(0x2c3440)); vb.position.y = 1.45; van.add(vb);
    var vt = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.3), new THREE.MeshBasicMaterial({ map: this.signTexture('ARMORY', '#10151d', '#ffc93c') }));
    vt.position.set(0, 1.7, 1.06); van.add(vt);
    this.scene.add(van); this.gunVanMesh = van;

    var gx = GARAGE.x, gz = GARAGE.z;
    this.box(13, 0.15, 11, 0x6a7076, gx, 0.08, gz, this.scene);
    this.box(13, 4.4, 0.4, 0x7a828c, gx, 2.2, gz - 5.5, this.scene);
    this.box(0.4, 4.4, 11, 0x7a828c, gx - 6.5, 2.2, gz, this.scene);
    this.box(0.4, 4.4, 11, 0x7a828c, gx + 6.5, 2.2, gz, this.scene);
    this.box(13.6, 0.4, 11.6, 0x4a5058, gx, 4.6, gz, this.scene);
    var gs = [[gx - 6.7, gz - 5.7, gx + 6.7, gz - 5.3], [gx - 6.7, gz - 5.5, gx - 6.3, gz + 5.5], [gx + 6.3, gz - 5.5, gx + 6.7, gz + 5.5]];
    for (i = 0; i < 3; i++) this.solids.push({ x0:gs[i][0], z0:gs[i][1], x1:gs[i][2], z1:gs[i][3] });
    var gt = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.8), new THREE.MeshBasicMaterial({ map: this.signTexture('RESPRAY', '#141a26', '#4dd0e1') }));
    gt.position.set(gx, 3.6, gz + 5.62); this.scene.add(gt);

    for (i = 0; i < PROPERTIES.length; i++) {
      var pr = PROPERTIES[i];
      var bt = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.7), new THREE.MeshBasicMaterial({ map: this.signTexture(pr.name.toUpperCase() + ' ' + fmtMoney(pr.price), '#141a26', '#9dff57') }));
      bt.position.set(pr.x, 2.6, pr.z); bt.rotation.y = Math.PI / 4; this.scene.add(bt);
      this.box(0.25, 2.6, 0.25, 0x3a4048, pr.x, 1.3, pr.z, this.scene);
    }

    for (i = 0; i < TRANSMITTERS.length; i++) {
      var tp = TRANSMITTERS[i], tg = new THREE.Group(); tg.position.set(tp.x, 0, tp.z);
      var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 11, 6), this.mat(0x596270)); pole.position.y = 5.5; tg.add(pole);
      var dish = new THREE.Mesh(new THREE.SphereGeometry(1.5, 8, 5, 0, Math.PI), this.mat(0xd8dde2)); dish.position.y = 11; dish.rotation.x = -0.7; tg.add(dish);
      this.scene.add(tg); this.solids.push({ x0:tp.x - 0.6, z0:tp.z - 0.6, x1:tp.x + 0.6, z1:tp.z + 0.6 });
    }

    for (i = 0; i < RAMPS.length; i++) {
      var rp = RAMPS[i], rg = new THREE.Group(); rg.position.set(rp.x, 0, rp.z); rg.rotation.y = rp.h;
      var wedge = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.9, 5), this.mat(0x39424e)); wedge.position.set(0, 0.45, 0); wedge.rotation.x = -0.32; rg.add(wedge);
      var edge = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.14, 0.4), this.mat(0xff9f43, 0xcc5500)); edge.position.set(0, 1.05, -2.3); rg.add(edge);
      this.scene.add(rg);
    }

    this.box(13, 5, 11, 0x9fd4e8, SHOWROOM.x, 2.5, SHOWROOM.z, this.scene);
    this.solids.push({ x0:SHOWROOM.x - 6.5, z0:SHOWROOM.z - 5.5, x1:SHOWROOM.x + 6.5, z1:SHOWROOM.z + 5.5 });
    var st = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), new THREE.MeshBasicMaterial({ map: this.signTexture('SHOWROOM', '#141a26', '#ff8ac2') }));
    st.position.set(SHOWROOM.x, 4.2, SHOWROOM.z - 5.6); st.rotation.y = Math.PI; this.scene.add(st);

    for (i = 0; i < FENCES.length; i++) {
      var f = FENCES[i];
      var ft = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 2), new THREE.MeshBasicMaterial({ map: this.signTexture('CHOP SHOP', '#141a26', '#ff9f43') }));
      ft.position.set(f.x, 3.4, f.z - 6); ft.rotation.y = Math.PI; this.scene.add(ft);
      this.box(0.25, 3.4, 0.25, 0x3a4048, f.x - 3.6, 1.7, f.z - 6, this.scene);
      this.box(0.25, 3.4, 0.25, 0x3a4048, f.x + 3.6, 1.7, f.z - 6, this.scene);
    }
  },
  buildRain: function () {
    var n = 260, pos = new Float32Array(n * 3);
    for (var i = 0; i < n; i++) { pos[i * 3] = rand(-35, 35); pos[i * 3 + 1] = rand(0, 28); pos[i * 3 + 2] = rand(-35, 35); }
    var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rain = new THREE.Points(g, new THREE.PointsMaterial({ color:0xbcd8ff, size: 0.32, transparent: true, opacity: 0.65 }));
    this.rain.visible = false; this.rainCount = n; this.scene.add(this.rain);
  },
  setMarker: function (x, z, on) { this.marker.visible = !!on; if (on) this.marker.position.set(x, 17, z); },
  collide: function (x, z, r) {
    for (var i = 0; i < this.solids.length; i++) {
      var s = this.solids[i];
      if (x > s.x0 - r && x < s.x1 + r && z > s.z0 - r && z < s.z1 + r) {
        var dxl = x - (s.x0 - r), dxr = (s.x1 + r) - x, dzl = z - (s.z0 - r), dzr = (s.z1 + r) - z;
        var m = Math.min(dxl, dxr, dzl, dzr);
        if (m === dxl) x = s.x0 - r; else if (m === dxr) x = s.x1 + r; else if (m === dzl) z = s.z0 - r; else z = s.z1 + r;
      }
    }
    x = clamp(x, -WORLD_R, WORLD_R); z = clamp(z, -WORLD_R, WORLD_R);
    return { x:x, z:z };
  },
  burstHydrant: function (h) { h.burstT = 5; h.spray.visible = true; },
  update: function (dt) {
    if (this.marker.visible) this.marker.material.opacity = 0.26 + 0.12 * Math.sin(G.time * 4);
    if (this.rain.visible) {
      var p = this.rain.geometry.attributes.position, c = this.camera.position;
      this.rain.position.set(c.x, 0, c.z);
      for (var i = 0; i < this.rainCount; i++) { var y = p.getY(i) - 24 * dt; if (y < 0) y = 28; p.setY(i, y); }
      p.needsUpdate = true;
    }
    for (var j = 0; j < this.hydrants.length; j++) {
      var h = this.hydrants[j];
      if (h.burstT > 0) {
        h.burstT -= dt;
        var sp = h.spray.geometry.attributes.position;
        for (var k = 0; k < sp.count; k++) {
          sp.setXYZ(k, rand(-0.5, 0.5), rand(0.5, 4.5) * Math.min(1, h.burstT), rand(-0.5, 0.5));
        }
        sp.needsUpdate = true;
        if (h.burstT <= 0) h.spray.visible = false;
      }
    }
    if (this.vest && !this.vest.available) {
      this.vest.respawnT -= dt;
      if (this.vest.respawnT <= 0) { this.vest.available = true; this.vest.grp.visible = true; }
    }
  }
};
