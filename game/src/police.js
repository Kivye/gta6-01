'use strict';

var COPS = {
  units: [], swat: null, heli: null, spikes: [], roadblock: null,
  seq: 0, spawnCd: 0, lastBlock: -99, lastSpike: 0, heliWasUp: false,
  init: function () {
    var grp = new THREE.Group();
    function B(w, h, d, c, x, y, z) { var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), WORLD.mat(c)); m.position.set(x, y, z); grp.add(m); return m; }
    B(2.3, 1.5, 4.8, 0x1d2f57, 0, 0, 0);
    B(1.9, 1.0, 1.1, 0x9fd4e8, 0, -0.15, 2.7);
    B(0.5, 0.5, 4.6, 0x1d2f57, 0, 0.25, -4.4);
    B(0.16, 1.3, 0.9, 0x1d2f57, 0, 0.8, -6.4);
    var tr = B(1.6, 0.08, 0.3, 0x222222, 0.35, 0.8, -6.4);
    var rotor = B(10.5, 0.07, 0.55, 0x222222, 0, 1.0, 0);
    B(0.14, 0.14, 3.6, 0x333333, -1.0, -1.15, 0);
    B(0.14, 0.14, 3.6, 0x333333, 1.0, -1.15, 0);
    var cone = new THREE.Mesh(new THREE.ConeGeometry(4.4, 14, 12, 1, true),
      new THREE.MeshBasicMaterial({ color:0xfff2a8, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }));
    cone.position.y = -7.6; grp.add(cone);
    var disc = new THREE.Mesh(new THREE.CircleGeometry(4.3, 14),
      new THREE.MeshBasicMaterial({ color:0xfff2a8, transparent: true, opacity: 0.22, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2; WORLD.scene.add(disc);
    grp.visible = false; WORLD.scene.add(grp);
    this.heli = { grp:grp, rotor: rotor, tailRotor: tr, disc: disc, active: false, ang: 0 };
  },
  setWanted: function (n) {
    G.wanted = clamp(Math.round(n), 0, 5);
    if (effWanted() >= 2) G._wasHigh = true;
    SAVE.persist();
  },
  report: function (callsign, text) { G.incident = { callsign:callsign, text: text, until:G.time + 12 }; },
  segBlocked: function (x1, z1, x2, z2) {
    var d = dist2d(x1, z1, x2, z2), steps = Math.max(1, Math.floor(d / 6));
    for (var i = 1; i < steps; i++) {
      var x = lerp(x1, x2, i / steps), z = lerp(z1, z2, i / steps);
      for (var j = 0; j < WORLD.solids.length; j++) {
        var s = WORLD.solids[j];
        if (x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1) return true;
      }
    }
    return false;
  },
  spawnPoint: function () {
    var pp = PLAYER.pos(), ang = rand(0, Math.PI * 2), d = rand(58, 78);
    var x = clamp(pp.x + Math.sin(ang) * d, -104, 104), z = clamp(pp.z + Math.cos(ang) * d, -104, 104);
    x = ROADS.reduce(function (p, c) { return Math.abs(c - x) < Math.abs(p - x) ? c : p; });
    return { x:x, z:z };
  },
  addUnit: function () {
    var sp = this.spawnPoint();
    var car = CARS.spawn('sedan', sp.x, sp.z, rand(0, 6.28), 'police');
    car.callsign = 'PALM-' + (++this.seq);
    car.role = 'PURSUIT';
    this.units.push(car); return car;
  },
  nearestUnit: function () {
    var pp = PLAYER.pos(), best = null, bd = 1e9;
    var all = this.units.concat(this.swat ? [this.swat] : []);
    for (var i = 0; i < all.length; i++) {
      var c = all[i]; if (c.dead) continue;
      var d = dist2d(pp.x, pp.z, c.mesh.position.x, c.mesh.position.z);
      if (d < bd) { bd = d; best = c; }
    }
    if (this.heli && this.heli.active) { var hd = dist2d(pp.x, pp.z, this.heli.grp.position.x, this.heli.grp.position.z); if (hd < bd) { bd = hd; best = 'heli'; } }
    if (!best) return null;
    var bx = best === 'heli' ? this.heli.grp.position.x : best.mesh.position.x;
    var side = clamp((bx - pp.x) / 20, -1, 1);
    return { d: bd, side: side, unit: best };
  },
  roleFor: function (car) {
    if (car === (this.roadblock && this.roadblock.car)) return 'ROADBLOCK';
    if (car === this.swat) return 'TACTICAL';
    var pp = PLAYER.pos(), d = dist2d(pp.x, pp.z, car.mesh.position.x, car.mesh.position.z);
    if (G.playerCar && d < 16) return 'RAMMING';
    if (d > 55) return 'RESPONDING';
    return 'PURSUIT';
  },
  dispatchRows: function () {
    var pp = PLAYER.pos(), rows = [];
    if (this.heli && this.heli.active) rows.push({ callsign:'AIR-1', role:'SPOTLIGHT', d: dist2d(pp.x, pp.z, this.heli.grp.position.x, this.heli.grp.position.z) });
    var all = this.units.concat(this.swat ? [this.swat] : []);
    var self = this;
    all = all.filter(function (c) { return !c.dead; });
    all.sort(function (a, b) { return dist2d(pp.x, pp.z, a.mesh.position.x, a.mesh.position.z) - dist2d(pp.x, pp.z, b.mesh.position.x, b.mesh.position.z); });
    for (var i = 0; i < all.length; i++) {
      var c = all[i];
      rows.push({ callsign:c === this.swat ? 'SWAT-1' : c.callsign, role:self.roleFor(c), d: dist2d(pp.x, pp.z, c.mesh.position.x, c.mesh.position.z) });
    }
    return rows;
  },
  unitDown: function (car) {
    var i = this.units.indexOf(car); if (i >= 0) this.units.splice(i, 1);
    if (car === this.swat) this.swat = null;
    if (this.roadblock && this.roadblock.car === car) this.roadblock = null;
    if (!G.wantedLock) this.setWanted(Math.min(5, G.wanted + 1));
  },
  steerTo: function (car, tx, tz, dt, speedMul) {
    var p = car.mesh.position;
    var want = Math.atan2(tx - p.x, tz - p.z), diff = want - car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
    var steer = clamp(diff * 1.8, -1, 1);
    var th = Math.abs(diff) > 2.2 ? -0.5 : clamp(1 - Math.abs(diff) * 0.4, 0.35, 1) * (speedMul || 1);
    CARS.stepCar(car, th, steer, dt, false);
  },
  update: function (dt) {
    if (G.frozen) { this.updateHeli(dt, PLAYER.pos(), effWanted()); return; }
    var w = effWanted(), pp = PLAYER.pos();
    this.spawnCd -= dt;
    var desired = [0, 1, 2, 3, 4, 4][w];
    this.units = this.units.filter(function (c) { return !c.dead; });
    if (this.units.length < desired && this.spawnCd <= 0 && !G.frozen) { this.addUnit(); this.spawnCd = 1.2; }
    while (this.units.length > desired) {
      var far = null, fd = -1;
      for (var i = 0; i < this.units.length; i++) {
        var d = dist2d(pp.x, pp.z, this.units[i].mesh.position.x, this.units[i].mesh.position.z);
        if (d > fd && this.units[i] !== (this.roadblock && this.roadblock.car)) { fd = d; far = this.units[i]; }
      }
      if (!far) break;
      CARS.remove(far); this.units.splice(this.units.indexOf(far), 1);
    }

    if (w >= 5 && !this.swat && !G.frozen) {
      var sp = this.spawnPoint();
      this.swat = CARS.spawn('van', sp.x, sp.z, 0, 'swat', 0x14161c);
      this.swat.health = 280; this.swat.maxHp = 280;
      this.swat.def = Object.assign({}, MODELS.van, { top: 39, accel: 17 });
      this.swat.callsign = 'SWAT-1';
    }
    if (w < 5 && this.swat) { CARS.remove(this.swat); this.swat = null; }

    var seen = false;
    var all = this.units.concat(this.swat ? [this.swat] : []);
    for (i = 0; i < all.length; i++) {
      var c = all[i], cp = c.mesh.position;
      if (dist2d(pp.x, pp.z, cp.x, cp.z) < 55 && !this.segBlocked(pp.x, pp.z, cp.x, cp.z)) { seen = true; break; }
    }
    if (this.heli && this.heli.active && dist2d(pp.x, pp.z, this.heli.grp.position.x, this.heli.grp.position.z) < 60) seen = true;
    G.sight.seen = seen;
    if (seen) { G.sight.hideT = 0; G.sight.decayT = 0; }
    else if (w > 0) {
      G.sight.hideT += dt;
      if (G.sight.hideT > 5 && !G.wantedLock) {
        G.sight.decayT += dt;
        if (G.sight.decayT >= 9) {
          G.sight.decayT = 0;
          this.setWanted(G.wanted - 1);
          if (G.wanted === 0 && G._wasHigh) { G.stats.escapes++; addRespect(60); G._wasHigh = false; HUD.showEvent('YOU LOST THEM', 'Escaped the PSPD'); SAVE.persist(); }
        }
      }
    }

    var pv = G.playerCar ? { x:G.playerCar.mesh.position.x + Math.sin(G.playerCar.heading) * G.playerCar.speed * 0.55, z:G.playerCar.mesh.position.z + Math.cos(G.playerCar.heading) * G.playerCar.speed * 0.55 } : pp;
    for (i = 0; i < this.units.length; i++) {
      var u = this.units[i];
      if (this.roadblock && this.roadblock.car === u) continue;
      var dd = dist2d(pp.x, pp.z, u.mesh.position.x, u.mesh.position.z);
      if (!G.playerCar && dd < 5.5) { CARS.stepCar(u, 0, 0, dt, false); continue; }
      var ram = dd < 16 && G.playerCar;
      this.steerTo(u, ram ? pv.x : pp.x, ram ? pv.z : pp.z, dt, w >= 4 ? 1.12 : 1);
    }
    if (this.swat && !this.swat.dead) this.steerTo(this.swat, pv.x, pv.z, dt, 1.15);
    this.updateRoadblock(dt, pp);
    this.updateHeli(dt, pp, w);
    this.updateSpikes(dt);
  },
  updateRoadblock: function (dt, pp) {
    var w = effWanted();
    if (this.roadblock) {
      var rb = this.roadblock, car = rb.car;
      if (car.dead || w < 4 || G.time - rb.since > 25 || (rb.set && dist2d(pp.x, pp.z, car.mesh.position.x, car.mesh.position.z) < 13)) {
        if (!car.dead) car.role = 'PURSUIT';
        this.roadblock = null; this.lastBlock = G.time;
      } else if (!rb.set) {
        var d = dist2d(rb.tx, rb.tz, car.mesh.position.x, car.mesh.position.z);
        if (d < 4) { rb.set = true; car.speed = 0; car.heading = rb.faceH; car.mesh.rotation.y = rb.faceH; }
        else this.steerTo(car, rb.tx, rb.tz, dt, 1.15);
      } else { car.speed = 0; car.mesh.rotation.y = rb.faceH; }
      return;
    }
    if (w >= 4 && G.time - this.lastBlock > 30 && !G.frozen) {
      var best = null, bd = 35;
      for (var i = 0; i < this.units.length; i++) {
        var c = this.units[i], d2 = dist2d(pp.x, pp.z, c.mesh.position.x, c.mesh.position.z);
        if (d2 > bd) { bd = d2; best = c; }
      }
      if (best) {
        var h = G.playerCar ? G.playerCar.heading : PLAYER.heading;
        this.roadblock = { car:best, tx:pp.x + Math.sin(h) * 55, tz:pp.z + Math.cos(h) * 55, faceH:h + Math.PI / 2, since:G.time, set:false };
        best.role = 'ROADBLOCK';
        this.report(best.callsign, 'roadblock moving into position');
      }
    }
  },
  updateHeli: function (dt, pp, w) {
    var h = this.heli; if (!h) return;
    if (w >= 3) {
      if (!h.active) {
        h.active = true; h.grp.visible = true;
        if (!this.heliWasUp) { this.heliWasUp = true; HUD.showEvent('AIR UNIT DEPLOYED', 'AIR-1 has you in the light'); this.report('AIR-1', 'spotlight on the suspect'); }
      }
      h.ang += dt * 0.35;
      var hx = pp.x + Math.sin(h.ang) * 7, hz = pp.z + Math.cos(h.ang) * 7;
      h.grp.position.set(hx, 14, hz);
      h.grp.rotation.y = PLAYER.heading;
      h.rotor.rotation.y += dt * 28; h.tailRotor.rotation.x += dt * 30;
      h.disc.position.set(hx, 0.12, hz); h.disc.visible = true;
    } else if (h.active) { h.active = false; h.grp.visible = false; h.disc.visible = false; }
  },
  updateSpikes: function (dt) {
    var w = effWanted(), car = G.playerCar;
    if (w >= 5 && car && Math.abs(car.speed) > 10 && G.time - this.lastSpike > 16 && !G.frozen) {
      this.lastSpike = G.time;
      var sx = car.mesh.position.x + Math.sin(car.heading) * 26, sz = car.mesh.position.z + Math.cos(car.heading) * 26;
      var mesh = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.12, 0.8), WORLD.mat(0x22262c));
      mesh.position.set(sx, 0.08, sz); mesh.rotation.y = car.heading; WORLD.scene.add(mesh);
      this.spikes.push({ x:sx, z:sz, mesh:mesh, until:G.time + 40 });
    }
    for (var i = this.spikes.length - 1; i >= 0; i--) {
      var s = this.spikes[i];
      if (G.time > s.until) { WORLD.scene.remove(s.mesh); this.spikes.splice(i, 1); continue; }
      if (car && !G.flatTyre && Math.abs(car.speed) > 5 && dist2d(car.mesh.position.x, car.mesh.position.z, s.x, s.z) < 2.3) {
        G.flatTyre = true; HUD.showEvent('TYRE SHREDDED', 'Spike strip — fix it with Bo or a respray');
        AUDIO.noiseHit(0.3, 0.5, 900, 'lowpass');
        WORLD.scene.remove(s.mesh); this.spikes.splice(i, 1);
      }
    }
  }
};
