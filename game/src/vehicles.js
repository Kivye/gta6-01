'use strict';

var CARS = {
  list: [], seq: 0, glowTex: null, smokeTex: null,
  tex: function (inner, outer) {
    var cv = document.createElement('canvas'); cv.width = cv.height = 64;
    var g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
    gr.addColorStop(0, inner); gr.addColorStop(1, outer); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(cv);
  },
  _box: function (grp, w, h, d, col, x, y, z) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), WORLD.mat(col));
    m.position.set(x, y, z); grp.add(m); return m;
  },
  buildMesh: function (key, color, kind) {
    var def = MODELS[key], grp = new THREE.Group();
    var L = def.len, W = def.wid;
    this._box(grp, W, 0.62, L, color, 0, 0.62, 0);
    if (key === 'truck' || key === 'van') {
      this._box(grp, W, 1.5, L * 0.62, key === 'van' ? 0x232830 : color, 0, 1.45, -L * 0.14);
      this._box(grp, W * 0.96, 0.7, L * 0.24, 0x1c2733, 0, 1.15, L * 0.36);
    } else if (key !== 'cabrio') {
      var cs = key === 'limo' ? [W * 0.9, 0.55, L * 0.55, 0x14181f, -0.2] : [W * 0.84, 0.52, L * 0.42, 0x1c2733, -0.15];
      this._box(grp, cs[0], cs[1], cs[2], cs[3], 0, 1.14, cs[4]);
    }
    if (key === 'taxi') this._box(grp, 0.7, 0.22, 0.34, 0xffc93c, 0, 1.5, -0.15);
    var wg = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 9), wm = WORLD.mat(0x14161a);
    var wpos = [[-W / 2, L / 2 - 0.8], [W / 2, L / 2 - 0.8], [-W / 2, -L / 2 + 0.8], [W / 2, -L / 2 + 0.8]];
    for (var i = 0; i < 4; i++) {
      var wh = new THREE.Mesh(wg, wm); wh.rotation.z = Math.PI / 2;
      wh.position.set(wpos[i][0], 0.36, wpos[i][1]); grp.add(wh);
    }

    var hl = new THREE.Mesh(new THREE.BoxGeometry(W * 0.86, 0.14, 0.08), WORLD.mat(0xfff6cf, 0x77704a));
    hl.position.set(0, 0.72, L / 2 + 0.02); grp.add(hl);
    var tl = new THREE.Mesh(new THREE.BoxGeometry(W * 0.86, 0.12, 0.08), WORLD.mat(0xd82e2e, 0x550000));
    tl.position.set(0, 0.74, -L / 2 - 0.02); grp.add(tl);

    if (!this.glowTex) { this.glowTex = this.tex('rgba(255,230,170,0.9)', 'rgba(255,230,170,0)'); this.smokeTex = this.tex('rgba(70,70,70,0.75)', 'rgba(70,70,70,0)'); }
    var sm = new THREE.SpriteMaterial({ map: this.glowTex, transparent: true, opacity: 0.55, depthWrite: false });
    var glowF = new THREE.Sprite(sm); glowF.scale.set(2.6, 1.3, 1); glowF.position.set(0, 0.7, L / 2 + 0.5); grp.add(glowF);
    var glowR = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color:0xff4444, transparent: true, opacity: 0.4, depthWrite: false }));
    glowR.scale.set(1.5, 0.8, 1); glowR.position.set(0, 0.72, -L / 2 - 0.4); grp.add(glowR);
    var pool = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.7, 4.6),
      new THREE.MeshBasicMaterial({ map: this.glowTex, transparent: true, opacity: 0.16, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(0, 0.06, L / 2 + 2.2); grp.add(pool);

    var smkM = new THREE.SpriteMaterial({ map: this.smokeTex, transparent: true, opacity: 0.55, depthWrite: false });
    var smoke = new THREE.Sprite(smkM); smoke.scale.set(2.4, 2.4, 1); smoke.position.set(0, 1.7, L * 0.28); smoke.visible = false; grp.add(smoke);
    var refs = { smoke:smoke, pool:pool };
    if (kind === 'police' || kind === 'swat') {
      var bar = new THREE.Group(); bar.position.set(0, 1.52, -0.15);
      var lr = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.3), WORLD.mat(0xff2222, 0xaa0000)); lr.position.x = -0.3; bar.add(lr);
      var lb = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.3), WORLD.mat(0x2266ff, 0x0022aa)); lb.position.x = 0.3; bar.add(lb);
      grp.add(bar);
      var sg = new THREE.Mesh(new THREE.CircleGeometry(3.4, 14),
        new THREE.MeshBasicMaterial({ color:0xff3333, transparent: true, opacity: 0.3, depthWrite: false }));
      sg.rotation.x = -Math.PI / 2; sg.position.y = 0.05; grp.add(sg);
      refs.barL = lr; refs.barR = lb; refs.sirenGlow = sg;
    }
    WORLD.scene.add(grp);
    refs.grp = grp;
    return refs;
  },
  spawn: function (key, x, z, heading, kind, color) {
    var def = MODELS[key];
    var col = color !== undefined ? color : (kind === 'police' ? 0xf0f2f5 : kind === 'swat' ? 0x14161c : key === 'taxi' ? 0xf2b134 : pick(CAR_COLORS));
    var refs = this.buildMesh(key, col, kind);
    refs.grp.position.set(x, 0, z); refs.grp.rotation.y = heading;
    var car = { id: ++this.seq, key:key, def:def, mesh:refs.grp, refs: refs, color:col,
      heading: heading, speed:0, health:def.hp, maxHp:def.hp, kind:kind || 'traffic',
      stolen: false, dead:false, node:null, cruise:rand(9, 13), callsign:null,
      role: null, airY: 0, airVy: 0, nmMark: false, nmFar: true, shootCd: 0, flash: rand(0, 6) };
    if (kind === 'police') { car.bodyColor = 0x24407c; var stripe = new THREE.Mesh(new THREE.BoxGeometry(def.wid + 0.04, 0.3, def.len * 0.9), WORLD.mat(0x24407c)); stripe.position.y = 0.62; refs.grp.add(stripe); }
    this.list.push(car);
    return car;
  },
  remove: function (car) {
    var i = this.list.indexOf(car); if (i >= 0) this.list.splice(i, 1);
    WORLD.scene.remove(car.mesh);
  },
  damage: function (car, amt) {
    if (car.dead) return;
    car.health -= amt;
    if (car.health <= 35 && car.health > 0) car.refs.smoke.visible = true;
    if (car.health <= 0) {
      car.health = 0; car.dead = true; car.speed = 0; car.refs.smoke.visible = true;
      if (car.kind === 'police' || car.kind === 'swat') COPS.unitDown(car);
      if (car.kind === 'mission' && MSN.onTargetDown) MSN.onTargetDown(car);
      if (chance(0.6)) GUNS.dropPickup(car.mesh.position.x, car.mesh.position.z);
    }
  },
  nearest: function (x, z, maxD, filter) {
    var best = null, bd = maxD;
    for (var i = 0; i < this.list.length; i++) {
      var c = this.list[i]; if (filter && !filter(c)) continue;
      var d = dist2d(x, z, c.mesh.position.x, c.mesh.position.z);
      if (d < bd) { bd = d; best = c; }
    }
    return best ? { car:best, d: bd } : null;
  },
  stepCar: function (car, throttle, steer, dt, handbrake) {
    var def = car.def, top = def.top * (G.flatTyre && car === G.playerCar ? 0.5 : 1);
    if (car.dead) throttle = 0;
    if (throttle > 0) car.speed += def.accel * throttle * dt * (car.speed < 0 ? 2.2 : 1);
    else if (throttle < 0) car.speed += def.accel * 1.4 * throttle * dt * (car.speed > 0 ? 2.2 : 0.7);
    else car.speed -= car.speed * 0.6 * dt;
    var nitroOn = car === G.playerCar && INPUT.keys['ShiftLeft'] && G.nitro > 0 && !G.flatTyre && car.speed > 2;
    if (nitroOn) { car.speed += 16 * dt; G.nitro = Math.max(0, G.nitro - 34 * dt); }
    var cap = nitroOn ? top * 1.3 : top;
    car.speed = clamp(car.speed, -9, cap);
    car.sliding = !!(handbrake && Math.abs(car.speed) > 7);
    if (car.sliding) { car.speed -= car.speed * 0.55 * dt; if (car === G.playerCar) G.nitro = Math.min(100, G.nitro + 9 * dt); }
    var wobble = (G.flatTyre && car === G.playerCar) ? Math.sin(G.time * 9) * 0.12 : 0;
    car.heading += (steer * (car.sliding ? 2.6 : 1.9) * clamp(car.speed / 9, -1, 1) + wobble * clamp(car.speed / 10, -1, 1)) * dt;
    var ox = car.mesh.position.x, oz = car.mesh.position.z;
    car.mesh.position.x += Math.sin(car.heading) * car.speed * dt;
    car.mesh.position.z += Math.cos(car.heading) * car.speed * dt;

    if (car.airVy !== 0 || car.airY > 0) {
      car.airY += car.airVy * dt; car.airVy -= 22 * dt;
      if (car.airY <= 0) { car.airY = 0; car.airVy = 0; if (car === G.playerCar) ULTRA.onStuntLand(car); }
      car.mesh.position.y = car.airY;
    }
    var fixed = WORLD.collide(car.mesh.position.x, car.mesh.position.z, 1.35);
    if ((fixed.x !== car.mesh.position.x || fixed.z !== car.mesh.position.z) && Math.abs(car.speed) > 8) {
      this.damage(car, Math.abs(car.speed) * 0.55);
      if (car === G.playerCar) PLAYER.hurt(Math.abs(car.speed) * 0.22);
      car.speed *= -0.25;
    }
    car.mesh.position.x = fixed.x; car.mesh.position.z = fixed.z;
    car.mesh.rotation.y = car.heading;
    if (car === G.playerCar) {
      var moved = dist2d(ox, oz, fixed.x, fixed.z);
      G.stats.distKm += moved / 1000;
      var kmh = Math.abs(car.speed) * 3.6; if (kmh > G.stats.topKmh) G.stats.topKmh = Math.round(kmh);
      for (var hi = 0; hi < WORLD.hydrants.length; hi++) {
        var h = WORLD.hydrants[hi];
        if (h.burstT <= 0 && Math.abs(car.speed) > 4 && dist2d(fixed.x, fixed.z, h.x, h.z) < 1.4) WORLD.burstHydrant(h);
      }
    }
  },
  trafficThink: function (car, dt) {
    var p = car.mesh.position;
    if (!car.node) car.node = { x:Math.round((p.x + 26) / 26) * 26 - 26, z:Math.round((p.z + 26) / 26) * 26 - 26 };
    var dx = car.node.x - p.x, dz = car.node.z - p.z, d = Math.sqrt(dx * dx + dz * dz);
    if (d < 4) {
      var opts = [];
      for (var i = 0; i < ROADS.length; i++) { opts.push({ x:ROADS[i], z:car.node.z }); opts.push({ x:car.node.x, z:ROADS[i] }); }
      car.node = pick(opts);
      if (dist2d(car.node.x, car.node.z, p.x, p.z) < 6) car.node = { x:pick(ROADS), z:pick(ROADS) };
      dx = car.node.x - p.x; dz = car.node.z - p.z; d = Math.sqrt(dx * dx + dz * dz) || 1;
    }
    var lane = 3.4, tx = car.node.x + (Math.abs(dz) > Math.abs(dx) ? lane * Math.sign(dx || 1) : 0), tz = car.node.z + (Math.abs(dx) > Math.abs(dz) ? -lane * Math.sign(dz || 1) : 0);
    var want = Math.atan2(tx - p.x, tz - p.z);
    var diff = want - car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
    var steer = clamp(diff * 1.6, -1, 1);
    var blocked = false;
    var ahead = this.nearest(p.x + Math.sin(car.heading) * 5, p.z + Math.cos(car.heading) * 5, 3.4, function (c) { return c !== car; });
    if (ahead) blocked = true;
    this.stepCar(car, blocked ? -0.4 : 0.55, steer, dt, false);
    if (Math.abs(car.speed) > car.cruise) car.speed = car.cruise * Math.sign(car.speed);
  },
  update: function (dt) {
    for (var i = 0; i < this.list.length; i++) {
      var c = this.list[i];
      c.flash += dt * 7;
      if (c.refs.barL) {
        var on = Math.sin(c.flash) > 0;
        c.refs.barL.material = WORLD.mat(on ? 0xff2222 : 0x551111, on ? 0xcc0000 : 0);
        c.refs.barR.material = WORLD.mat(on ? 0x113377 : 0x2266ff, on ? 0 : 0x0022cc);
        c.refs.sirenGlow.material.color.setHex(on ? 0xff3333 : 0x3366ff);
        c.refs.sirenGlow.material.opacity = 0.16 + WORLD.nightF * 0.22;
      }
      if (c.refs.smoke.visible) {
        var s = 2.1 + Math.sin(G.time * 6 + c.id) * 0.5 + (35 - Math.max(c.health, 0)) * 0.045;
        c.refs.smoke.scale.set(s, s * 1.25, 1);
      }
      if (c.kind === 'traffic' && !c.dead && c !== G.playerCar && !G.frozen) this.trafficThink(c, dt);
    }

    for (var a = 0; a < this.list.length; a++) for (var b = a + 1; b < this.list.length; b++) {
      var A = this.list[a], B = this.list[b];
      var d = dist2d(A.mesh.position.x, A.mesh.position.z, B.mesh.position.x, B.mesh.position.z);
      var min = (A.def.len + B.def.len) / 4 + 1.1;
      if (d > 0.01 && d < min) {
        var push = (min - d) / 2, ang = Math.atan2(B.mesh.position.x - A.mesh.position.x, B.mesh.position.z - A.mesh.position.z);
        if (!A.dead) { A.mesh.position.x -= Math.sin(ang) * push; A.mesh.position.z -= Math.cos(ang) * push; }
        if (!B.dead) { B.mesh.position.x += Math.sin(ang) * push; B.mesh.position.z += Math.cos(ang) * push; }
        var rel = Math.abs(A.speed - B.speed);
        if (rel > 6) { this.damage(A, rel * 0.5); this.damage(B, rel * 0.5); if (A === G.playerCar || B === G.playerCar) PLAYER.hurt(rel * 0.18); }
        A.speed *= 0.6; B.speed *= 0.6;
      }
    }

    this._popT = (this._popT || 0) - dt;
    if (this._popT <= 0 && !G.frozen) {
      this._popT = 2.5;
      var traffic = 0, pp = PLAYER.pos(), k, tc;
      for (k = 0; k < this.list.length; k++) if (this.list[k].kind === 'traffic') traffic++;
      if (traffic < 13) {
        var ang = rand(0, Math.PI * 2), dd = rand(55, 85);
        var sx = clamp(pp.x + Math.sin(ang) * dd, -105, 105), sz = clamp(pp.z + Math.cos(ang) * dd, -105, 105);
        sx = ROADS.reduce(function (p, c) { return Math.abs(c - sx) < Math.abs(p - sx) ? c : p; });
        var nc = this.spawn(pick(['compact', 'sedan', 'taxi', 'cabrio', 'suv', 'sedan']), sx, sz, rand(0, 6.28), 'traffic');
        nc.node = { x:pick(ROADS), z:pick(ROADS) };
      }
      for (k = this.list.length - 1; k >= 0; k--) {
        tc = this.list[k];
        if (tc.kind === 'traffic' && !tc.dead && dist2d(pp.x, pp.z, tc.mesh.position.x, tc.mesh.position.z) > 130) this.remove(tc);
      }
    }
  }
};
