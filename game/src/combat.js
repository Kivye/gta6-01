'use strict';

var GUNS = {
  cd: 0, rejectT: 0, shotReportT: 0, pickups: [], tracers: [],
  defs: {
    1: { name:'PISTOL', kind:'pistol', dmg:34, rate:0.34, range:65, spread:0.03 },
    2: { name:'MICRO SMG', kind:'smg', dmg:15, rate:0.095, range:55, spread:0.07 },
    3: { name:'PUMP SHOTGUN', kind:'shotgun', dmg:11, pellets:5, rate:0.95, range:38, spread:0.16 }
  },
  owned: function (slot) { return slot === 1 || (slot === 2 ? G.ownSmg : G.ownShotgun); },
  ammo: function (slot) { return slot === 1 ? Infinity : (slot === 2 ? G.ammoSmg : G.ammoShot); },
  state: function (slot) {
    if (!this.owned(slot)) return 'LOCKED';
    if (slot !== G.slot) return 'HOLSTERED';
    return this.cd > 0 ? 'CYCLING' : 'READY';
  },
  damageAt: function (slot, d) {
    var def = this.defs[slot];
    if (slot === 3) { if (d <= 8) return def.dmg; return def.dmg * clamp(1 - (d - 8) / 30 * 0.75, 0.25, 1); }
    return def.dmg;
  },
  select: function (slot) {
    if (!this.owned(slot)) { HUD.showToast('LOCKED', 'Buy it at the Gun Van'); return; }
    G.slot = slot; AUDIO.blip(660, 0.05, 0.08);
  },
  muzzlePos: function () {
    var pp = PLAYER.pos();
    if (G.playerCar) return { x:pp.x + Math.sin(G.playerCar.heading) * 2.2, y: 1.1, z:pp.z + Math.cos(G.playerCar.heading) * 2.2 };
    return { x:pp.x + Math.sin(PLAYER.heading) * 0.6, y: 1.25, z:pp.z + Math.cos(PLAYER.heading) * 0.6 };
  },
  tracer: function (x1, y1, z1, x2, y2, z2) {
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([x1, y1, z1, x2, y2, z2]), 3));
    var line = new THREE.Line(g, new THREE.LineBasicMaterial({ color:0xffe9a8, transparent: true, opacity: 0.9 }));
    WORLD.scene.add(line); this.tracers.push({ line: line, life:0.06 });
  },
  bestTarget: function (ox, oz, dir, range, spread) {
    var best = null, bd = range, ba = spread;
    function consider(x, z, obj, kind) {
      var dx = x - ox, dz = z - oz, d = Math.sqrt(dx * dx + dz * dz);
      if (d > range || d < 0.5) return;
      var a = Math.abs(Math.atan2(dx, dz) - dir);
      while (a > Math.PI) a = Math.abs(a - Math.PI * 2);
      if (a < ba + (kind === 'car' ? 0.05 : 0)) { if (d < bd || a < ba) { bd = d; ba = a; best = { obj: obj, kind:kind, d: d, x:x, z:z }; } }
    }
    for (var i = 0; i < CARS.list.length; i++) { var c = CARS.list[i]; if (!c.dead && c !== G.playerCar) consider(c.mesh.position.x, c.mesh.position.z, c, 'car'); }
    for (i = 0; i < PEDS.list.length; i++) { var p = PEDS.list[i]; if (p.state !== 'down') consider(p.mesh.position.x, p.mesh.position.z, p, 'ped'); }
    return best;
  },
  fire: function () {
    var slot = G.slot, def = this.defs[slot];
    if (G.playerCar && slot !== 2) {
      if (G.time > this.rejectT) { this.rejectT = G.time + 1.6; HUD.showEvent('NO DRIVE-BY', 'Only the Micro SMG fires from a car'); }
      this.cd = 0.25; return;
    }
    if (this.ammo(slot) <= 0) { AUDIO.blip(220, 0.05, 0.1); this.cd = 0.3; return; }
    if (slot === 2) G.ammoSmg--; else if (slot === 3) G.ammoShot--;
    this.cd = def.rate;
    G.stats.shots++;
    AUDIO.gun(def.kind);
    var pp = PLAYER.pos(), mp = this.muzzlePos();
    var dir = G.playerCar ? G.playerCar.heading : PLAYER.heading;
    var pellets = def.pellets || 1;
    for (var i = 0; i < pellets; i++) {
      var pdir = dir + rand(-def.spread, def.spread);
      var hit = this.bestTarget(pp.x, pp.z, pdir, def.range, def.spread + 0.05);
      if (hit) {
        this.tracer(mp.x, mp.y, mp.z, hit.x, 1.0, hit.z);
        if (hit.kind === 'car') CARS.damage(hit.obj, this.damageAt(slot, hit.d));
        else PEDS.hurt(hit.obj, this.damageAt(slot, hit.d) * 2);
      } else {
        this.tracer(mp.x, mp.y, mp.z, pp.x + Math.sin(pdir) * def.range, 1.1, pp.z + Math.cos(pdir) * def.range);
      }
    }
    G.danger = { x:pp.x, z:pp.z, t: G.time };

    if (effWanted() > 0 && G.time > this.shotReportT) {
      this.shotReportT = G.time + 6;
      var near = COPS.nearestUnit();
      if (near && near.unit !== 'heli' && near.unit) COPS.report(near.unit.callsign || 'AIR-1', 'shots fired in ' + districtAt(pp.x, pp.z));
    }
    if (!G.wantedLock && effWanted() < 5) {
      var wit = COPS.nearestUnit();
      if (wit && wit.d < 55) COPS.setWanted(G.wanted + 1);
    }
  },
  enemyShoot: function (x, z, dmg) {
    var pp = PLAYER.pos(), d = dist2d(x, z, pp.x, pp.z);
    if (d > 32 || COPS.segBlocked(x, z, pp.x, pp.z)) return;
    AUDIO.gun('smg');
    if (G.playerCar) CARS.damage(G.playerCar, dmg * 0.6);
    PLAYER.hurt(dmg);
  },
  dropPickup: function (x, z) {
    var kind = pick(['smg', 'smg', 'shotgun', 'cash']);
    var col = kind === 'smg' ? 0xff9f43 : kind === 'shotgun' ? 0xd64541 : 0x39b56a;
    var mesh = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.35, 0.55), WORLD.mat(col, 0x333333));
    mesh.position.set(x, 0.7, z); WORLD.scene.add(mesh);
    this.pickups.push({ mesh:mesh, kind:kind, x:x, z:z });
  },
  collect: function (pk) {
    var gained;
    if (pk.kind === 'smg' && G.ownSmg && G.ammoSmg < 120) { G.ammoSmg = Math.min(120, G.ammoSmg + 30); gained = 'SMG AMMO +30'; }
    else if (pk.kind === 'shotgun' && G.ownShotgun && G.ammoShot < 24) { G.ammoShot = Math.min(24, G.ammoShot + 8); gained = 'SHELLS +8'; }
    else { G.money += 25; gained = 'CASH +$25'; }
    HUD.showToast('PICKUP', gained); AUDIO.blip(990, 0.07, 0.12);
    WORLD.scene.remove(pk.mesh);
    this.pickups.splice(this.pickups.indexOf(pk), 1);
    SAVE.persist();
  },
  prices: { smg: 800, shotgun: 1200, refill: 150, kevlar: 300 },
  buy: function (item) {
    var price = this.prices[item];
    if (G.money < price) { HUD.showToast('ARMORY', 'Not enough cash'); return false; }
    if (item === 'smg' && G.ownSmg) { HUD.showToast('ARMORY', 'Already owned'); return false; }
    if (item === 'shotgun' && G.ownShotgun) { HUD.showToast('ARMORY', 'Already owned'); return false; }
    G.money -= price;
    if (item === 'smg') { G.ownSmg = true; G.ammoSmg = 120; }
    if (item === 'shotgun') { G.ownShotgun = true; G.ammoShot = 24; }
    if (item === 'refill') { if (G.ownSmg) G.ammoSmg = 120; if (G.ownShotgun) G.ammoShot = 24; }
    if (item === 'kevlar') G.armour = 100;
    HUD.showToast('ARMORY', 'Bought: ' + item.toUpperCase());
    AUDIO.blip(1180, 0.1, 0.14);
    SAVE.persist();
    return true;
  },
  update: function (dt) {
    this.cd -= dt;
    if (firing() && this.cd <= 0 && G.mode === 'play' && !G.paused) this.fire();
    for (var i = this.tracers.length - 1; i >= 0; i--) {
      var t = this.tracers[i]; t.life -= dt;
      if (t.life <= 0) { WORLD.scene.remove(t.line); this.tracers.splice(i, 1); }
    }
    var pp = PLAYER.pos();
    for (i = this.pickups.length - 1; i >= 0; i--) {
      var pk = this.pickups[i];
      pk.mesh.rotation.y += dt * 3; pk.mesh.position.y = 0.7 + Math.sin(G.time * 3 + i) * 0.12;
      if (dist2d(pp.x, pp.z, pk.x, pk.z) < (G.playerCar ? 3 : 1.7)) this.collect(pk);
    }
  }
};
