'use strict';

var ULTRA = {
  race: null, gate: null, slowmo: 0, stuntPending: false, incomeT: 0,
  nightTarget: 0, nightCur: 0, rainOn: false, rainT: 20, cashVan: null, cashT: 90, wasInGarage: false,
  init: function () {
    var gate = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.22, 8, 20), WORLD.mat(0x22d3ee, 0x0e7490));
    gate.visible = false; WORLD.scene.add(gate); this.gate = gate;
  },
  raceAt: function (x, z) {
    for (var i = 0; i < RACES.length; i++) if (dist2d(x, z, RACES[i].start.x, RACES[i].start.z) < 7) return i;
    return -1;
  },
  startRace: function (i, bet) {
    var def = RACES[i];
    if (!G.playerCar) { HUD.showEvent('STREET RACE', 'You need a car to race'); return false; }
    if (G.money < bet) { HUD.showEvent('STREET RACE', 'Not enough cash for that bet'); return false; }
    G.money -= bet;
    var names = ['Vex Marlowe', 'Kiko Tanaka', 'Dre Callahan'], rivals = [];
    for (var k = 0; k < 3; k++) {
      var rc = CARS.spawn(pick(['sport', 'cabrio', 'suv']), def.start.x + (k - 1) * 4.5, def.start.z - 5 - k * 2, def.start.h, 'race');
      rivals.push({ car:rc, name:names[k], idx:0, done:false });
    }
    G.playerCar.mesh.position.set(def.start.x, 0, def.start.z - 1); G.playerCar.heading = def.start.h; G.playerCar.speed = 0;
    this.race = { def:def, idx:0, t: 0, bet:bet, rivals:rivals, finishedCount: 0, over: false };
    this.placeGate();
    HUD.showEvent('STREET RACE', def.name + ' — bet ' + fmtMoney(bet));
    return true;
  },
  placeGate: function () {
    if (!this.race) { this.gate.visible = false; return; }
    var cp = this.race.def.pts[this.race.idx];
    if (!cp) { this.gate.visible = false; return; }
    this.gate.position.set(cp[0], 3.4, cp[1]); this.gate.visible = true;
  },
  progOf: function (idx, x, z, def) {
    var cp = def.pts[Math.min(idx, def.pts.length - 1)];
    return idx * 1000 - dist2d(x, z, cp[0], cp[1]);
  },
  playerPos: function () {
    var r = this.race; if (!r) return 1;
    var pp = PLAYER.pos(), mine = this.progOf(r.idx, pp.x, pp.z, r.def), pos = 1;
    for (var i = 0; i < r.rivals.length; i++) {
      var rv = r.rivals[i];
      if (rv.done || this.progOf(rv.idx, rv.car.mesh.position.x, rv.car.mesh.position.z, r.def) > mine) pos++;
    }
    return pos;
  },
  endRace: function () {
    var r = this.race, pos = this.playerPos();
    if (pos === 1) {
      var pay = r.bet * 2;
      G.money += pay; G.stats.earned += pay; G.stats.racesWon++; addRespect(80);
      HUD.showEvent('RACE WON', r.def.name + ' — paid ' + fmtMoney(pay));
    } else HUD.showEvent('RACE LOST', r.def.name + ' — finished P' + pos);
    for (var i = 0; i < r.rivals.length; i++) { r.rivals[i].car.kind = 'traffic'; r.rivals[i].car.node = null; }
    this.race = null; this.gate.visible = false;
    SAVE.persist();
  },
  updateRace: function (dt) {
    var r = this.race; if (!r) return;
    r.t += dt;
    var pp = PLAYER.pos(), cp = r.def.pts[r.idx];
    if (cp && dist2d(pp.x, pp.z, cp[0], cp[1]) < 7) {
      r.idx++;
      if (r.idx >= r.def.pts.length) { this.endRace(); return; }
      this.placeGate();
    }
    var myProg = this.progOf(r.idx, pp.x, pp.z, r.def);
    for (var i = 0; i < r.rivals.length; i++) {
      var rv = r.rivals[i]; if (rv.done || rv.car.dead) continue;
      var rcp = r.def.pts[rv.idx];
      if (rcp && dist2d(rv.car.mesh.position.x, rv.car.mesh.position.z, rcp[0], rcp[1]) < 7) {
        rv.idx++;
        if (rv.idx >= r.def.pts.length) { rv.done = true; r.finishedCount++; continue; }
        rcp = r.def.pts[rv.idx];
      }
      var rp = this.progOf(rv.idx, rv.car.mesh.position.x, rv.car.mesh.position.z, r.def);
      var rubber = clamp(1 + (myProg - rp) * 0.004, 0.8, 1.16);
      COPS.steerTo(rv.car, rcp[0], rcp[1], dt, rubber);
    }
  },
  nearMissUpdate: function () {
    var car = G.playerCar; if (!car || Math.abs(car.speed) <= 14) return;
    var pp = car.mesh.position;
    for (var i = 0; i < CARS.list.length; i++) {
      var c = CARS.list[i];
      if (c === car || c.kind === 'police' || c.kind === 'swat') continue;
      var d = dist2d(pp.x, pp.z, c.mesh.position.x, c.mesh.position.z);
      if (!c.nmMark && d >= 2.7 && d <= 5.4) c.nmMark = true;
      else if (c.nmMark && d > 6.5 && d < 26) {
        c.nmMark = false;
        G.stats.nearMiss++;
        G.nmChain = (G.time - G.lastNearMiss < 4) ? G.nmChain + 1 : 1;
        G.lastNearMiss = G.time;
        addRespect(10); G.nitro = Math.min(100, G.nitro + 15);
        HUD.showToast('NEAR MISS' + (G.nmChain > 1 ? ' ×' + G.nmChain : ''), '+10 RESPECT');
        HUD.flashSpeedo();
      } else if (d > 26) c.nmMark = false;
    }
  },
  checkRamps: function () {
    var car = G.playerCar; if (!car || car.airY > 0 || Math.abs(car.speed) < 12) return;
    for (var i = 0; i < RAMPS.length; i++) {
      var rp = RAMPS[i];
      if (dist2d(car.mesh.position.x, car.mesh.position.z, rp.x, rp.z) < 3) {
        var diff = Math.abs(car.heading - rp.h); while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);
        if (diff < 0.6) {
          car.airVy = 8.5; car.airY = 0.01; this.slowmo = 1.5; this.stuntPending = true;
          AUDIO.tone(520, 0.3, 0.12, 'sine');
        }
      }
    }
  },
  onStuntLand: function (car) {
    if (!this.stuntPending) return;
    this.stuntPending = false;
    if (car.dead || car.health <= 10) return;
    G.money += 150; G.stats.earned += 150; G.stats.stunts++; addRespect(25);
    HUD.showToast('INSANE STUNT BONUS', '$150 +25 RESPECT');
    AUDIO.blip(1560, 0.14, 0.15);
    SAVE.persist();
  },
  inGarage: function () {
    var pp = PLAYER.pos();
    return Math.abs(pp.x - GARAGE.x) < 6.2 && Math.abs(pp.z - GARAGE.z) < 5.2;
  },
  respray: function () {
    var car = G.playerCar;
    if (!car || !this.inGarage()) return false;
    if (G.money < 100) { HUD.showToast('RESPRAY', 'Needs $100'); return false; }
    G.money -= 100;
    var col = pick(CAR_COLORS);
    car.mesh.children[0].material = new THREE.MeshLambertMaterial({ color:col });
    car.color = col;
    G.flatTyre = false;
    var msg = 'Fresh paint — ' + fmtMoney(100);
    if (!G.sight.seen && !G.garageTrimUsed && G.wanted > 0 && !G.wantedLock) {
      COPS.setWanted(G.wanted - 1); G.garageTrimUsed = true; msg += ' — heat trimmed';
    }
    HUD.showToast('RESPRAY', msg);
    AUDIO.blip(760, 0.1, 0.12);
    SAVE.persist();
    return true;
  },
  saveFav: function () {
    if (!G.playerCar || !this.inGarage()) return false;
    G.fav = { key:G.playerCar.key, color:G.playerCar.color };
    HUD.showToast('GARAGE', 'Favourite stored: ' + G.playerCar.def.name);
    SAVE.persist();
    return true;
  },
  takeFav: function () {
    if (G.playerCar || !G.fav || !this.inGarage()) return false;
    var car = CARS.spawn(G.fav.key, GARAGE.x, GARAGE.z + 8, Math.PI, 'fav', G.fav.color);
    car.ownedByPlayer = true;
    HUD.showToast('GARAGE', 'Favourite rolled out');
    return true;
  },
  buyProperty: function (p) {
    if (G.props.indexOf(p.id) >= 0) { HUD.showToast(p.name, 'Already yours'); return false; }
    if (G.money < p.price) { HUD.showToast(p.name, 'Needs ' + fmtMoney(p.price)); return false; }
    G.money -= p.price; G.props.push(p.id);
    HUD.showEvent('PROPERTY BOUGHT', p.name + ' — ' + fmtMoney(p.income) + ' every minute');
    SAVE.persist();
    return true;
  },
  propertyAt: function (x, z) {
    for (var i = 0; i < PROPERTIES.length; i++) if (dist2d(x, z, PROPERTIES[i].x, PROPERTIES[i].z) < 6) return PROPERTIES[i];
    return null;
  },
  spawnCashVan: function () {
    var sp = COPS.spawnPoint();
    var car = CARS.spawn('van', sp.x, sp.z, rand(0, 6.28), 'cashvan', 0x3a4149);
    car.node = { x:pick(ROADS), z:pick(ROADS) };
    this.cashVan = car;
    HUD.showEvent('ARMORED CASH VAN', 'A fat target rolls through Palmshade');
    return car;
  },
  lootCashVan: function () {
    var v = this.cashVan; if (!v) return false;
    var pp = PLAYER.pos();
    if (G.playerCar || dist2d(pp.x, pp.z, v.mesh.position.x, v.mesh.position.z) > 3.4 || (!v.dead && v.health > 40)) return false;
    var take = randi(700, 1200);
    G.money += take; G.stats.earned += take;
    if (!G.wantedLock) COPS.setWanted(Math.min(5, G.wanted + 2));
    HUD.showEvent('CASH VAN HIT', 'Took ' + fmtMoney(take) + ' — heat +2');
    CARS.remove(v); this.cashVan = null; this.cashT = 140;
    SAVE.persist();
    return true;
  },
  update: function (dt) {
    this.updateRace(dt);
    this.nearMissUpdate();
    this.checkRamps();
    if (this.slowmo > 0) this.slowmo -= dt;
    G.timeScale = this.slowmo > 0 ? 0.35 : 1;

    this.incomeT += dt;
    if (this.incomeT >= 60) {
      this.incomeT = 0;
      var sum = 0;
      for (var i = 0; i < PROPERTIES.length; i++) if (G.props.indexOf(PROPERTIES[i].id) >= 0) sum += PROPERTIES[i].income;
      if (sum > 0) { G.money += sum; G.stats.earned += sum; HUD.showToast('PROPERTY INCOME', '+' + fmtMoney(sum)); SAVE.persist(); }
    }
    var inG = this.inGarage();
    if (this.wasInGarage && !inG) G.garageTrimUsed = false;
    this.wasInGarage = inG;

    if (Math.abs(this.nightCur - this.nightTarget) > 0.002) {
      this.nightCur += clamp(this.nightTarget - this.nightCur, -dt * 0.4, dt * 0.4);
      WORLD.applyNight(this.nightCur);
    }
    this.rainT -= dt;
    if (this.rainT <= 0) { this.rainT = rand(18, 46); this.rainOn = chance(0.45); WORLD.rain.visible = this.rainOn; }

    if (!this.cashVan && !G.frozen) {
      this.cashT -= dt;
      if (this.cashT <= 0) this.spawnCashVan();
    }
    if (this.cashVan) {
      if (this.cashVan.dead || this.cashVan.health <= 40) this.cashVan.speed = 0;
      else CARS.trafficThink(this.cashVan, dt);
    }
  }
};
