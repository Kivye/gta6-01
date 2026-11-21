'use strict';

var MARA = {name:'Mara Vale', role:'Fence',color:'#8e2434' };
var DARIO = {name:'Dario Sol', role:'Marina Courier',color:'#0e7a6d' };
var SABLE = {name:'Sable Ortiz', role:'Heights Insider',color:'#6c3483' };
var MSN = {
  current: 0, stage: 0, targetCar: null, escorts: [], holdT: 0, timerLeft: 0, sellCd: 0,
  defs: [
    {name:'Regent Run',giver:MARA,reward:600,stages:[
      {k:'steal',o:'Steal the Regent Limo',n:'Take it to West Chop Shop',l:'That limo is money on wheels, Rio. Lift it clean.',car:'limo',x:-26.5,z:-3 },
      {k:'deliver',o:'Deliver the limo to West Chop Shop',n:'Final stage — park in the bay',l:'Bay is open. Bring her in gentle, every scratch is cash.',fence:0 } ] },
    {name:'Marina Courier',giver:DARIO,reward:500,stages:[
      {k:'reach',o:'Pick up the package on the boulevard',n:'Drop it at the pier end',l:'Package waits on the boulevard. No names, no questions.',x:10,z:70 },
      {k:'reach',o:'Drop the package at the pier',n:'Final stage',l:'West end of the boulevard. Hand it off and walk away.',x:-38,z:80 } ] },
    {name:'Rival Colours',giver:MARA,reward:900,stages:[
      {k:'steal',o:'Steal the rival Solana Cabrio',n:'Deliver it to Marina Chop Shop',l:'Their cabrio, our paint by tonight. Take it.',car:'cabrio',x:26,z:33,color:0xd63384 },
      {k:'deliver',o:'Deliver the cabrio to Marina Chop Shop',n:'Then cool off at the lookout',l:'Marina bay, quick hands, no speeches.',fence:1 },
      {k:'reach',o:'Cool off at the north lookout',n:'Final stage',l:'Lie low at the lookout until I call it done.',x:-52,z:52 } ] },
    {name:'Showroom Shine',giver:SABLE,reward:1100,stages:[
      {k:'reach',o:'Case the Heights showroom',n:'Take the Vesper GT out front',l:'The GT sits out front after close. Window shopping, Rio.',x:70,z:38 },
      {k:'steal',o:'Steal the showroom Vesper GT',n:'Deliver it to Heights Customs',l:'Alarms are theatre. Drive like you own it — you do now.',car:'sport',x:62,z:44 },
      {k:'deliver',o:'Deliver the GT to Heights Customs',n:'Final stage — park in the bay',l:'My bay at Heights Customs. Keep the shine on it.',fence:2 } ] },
    {name:'Long Haul',giver:MARA,reward:1300,stages:[
      {k:'steal',o:'Steal the Bastion SUV in the south-west',n:'Haul it to West Chop Shop, fast',l:'One SUV, one long haul. Clock is part of the deal.',car:'suv',x:-78,z:-60 },
      {k:'deliver',o:'Haul the SUV to West Chop Shop',n:'Final stage — beat the clock',l:'West bay. Every second you save is respect.',fence:0,timer:150 } ] },
    {name:'Harbor Heist',giver:DARIO,reward:2200,stages:[
      {k:'disable',o:'Disable the armoured cargo truck',n:'Take the truck once it is crippled',l:'Armoured truck, two rival escorts. Cripple it, do not cook it.', truck: true },
      {k:'take',o:'Take the cargo truck',n:'Haul it to Marina Chop Shop',l:'It is yours. Heavy, slow, and worth a fortune.', truck: true },
      {k:'deliver',o:'Haul the truck to Marina Chop Shop',n:'Final stage — park in the bay',l:'Marina bay takes trucks. Bring my fortune home.',fence:1, truck: true } ] },
    {name:'Midnight Blackout',giver:SABLE,reward:1800,stages:[
      {k:'hold',o:'Sabotage transmitter one',n:'Then transmitter two',l:'Hold at the mast base while the charge cooks. Heat is locked on.',x:44,z:-40,hold:6 },
      {k:'hold',o:'Sabotage transmitter two',n:'Then transmitter three',l:'Two more masts and the Heights go dark.',x:66,z:-8,hold:6 },
      {k:'hold',o:'Sabotage transmitter three',n:'Final stage',l:'Last mast. Then we own the night.',x:58,z:34,hold:6 } ] },
    {name:'Palmshade Takeover',giver:MARA,reward:3500,stages:[
      {k:'disable',o:'Cripple Commander Rex Calloway\u2019s SUV',n:'Then run — five stars, locked',l:'Calloway runs PSPD\u2019s dirty squad from a black SUV. End his patrol.', commander: true },
      {k:'escape',o:'Reach the pier extraction',n:'Final stage — beat the clock',l:'Five stars and nowhere to hide. The pier boat is your only door.',x:-16,z:100,timer:120 } ] }
  ],
  fenceValue: function (car) { return Math.round(car.def.base * clamp(car.health, 4, 100) / 100); },
  stageDef: function () { return this.current < 8 ? this.defs[this.current].stages[this.stage] : null; },
  flow: function () {
    if (this.current >= 8) return null;
    var def = this.defs[this.current], sd = def.stages[this.stage];
    return { num: this.current + 1, total: 8, name:def.name, stage: this.stage,stages:def.stages.length,
      next: this.stage < def.stages.length - 1 ? sd.n : 'FINAL STAGE',giver:def.giver, line: sd.l,
      reward: def.reward,timer:sd.timer ? this.timerLeft : null, obj: sd.o };
  },
  start: function (idx) {
    this.current = idx; this.stage = 0;
    this.beginStage();
  },
  clearEntities: function () {
    if (this.targetCar && this.targetCar.kind === 'mission') { CARS.remove(this.targetCar); this.targetCar = null; }
    for (var i = 0; i < this.escorts.length; i++) if (!this.escorts[i].dead) CARS.remove(this.escorts[i]);
    this.escorts = [];
  },
  beginStage: function () {
    this.clearEntities();
    this.holdT = 0;
    var sd = this.stageDef(); if (!sd) { WORLD.setMarker(0, 0, false); return; }
    this.timerLeft = sd.timer || 0;
    if (this.current === 6 && this.stage === 0) G.wantedLock = 4;
    if (sd.car) {
      this.targetCar = CARS.spawn(sd.car, sd.x, sd.z, rand(0, 6.28), 'mission', sd.color);
      this.targetCar.kind = 'parked';
    }
    if (sd.truck && this.current === 5 && this.stage === 0) {
      this.targetCar = CARS.spawn('truck', 52, 71, -Math.PI / 2, 'mission', 0x707a52);
      this.targetCar.health = 220; this.targetCar.maxHp = 220; this.targetCar.loopWp = 0;
      for (var i = 0; i < 2; i++) {
        var e = CARS.spawn('suv', 46 - i * 7, 71, -Math.PI / 2, 'mission', 0x30363f);
        e.guardOf = this.targetCar; this.escorts.push(e);
      }
    }
    if (sd.truck && this.current === 5 && this.stage > 0) {

      this.targetCar = this._truckRef || null;
    }
    if (sd.commander) {
      this.targetCar = CARS.spawn('suv', 66, -26, Math.PI / 2, 'mission', 0x0c0d10);
      this.targetCar.health = 260; this.targetCar.maxHp = 260;
      this.targetCar.def = Object.assign({}, MODELS.suv, { top: 35, accel: 15 });
      this.targetCar.loopWp = 0; this.targetCar.commander = true;
      var g = CARS.spawn('suv', 60, -26, Math.PI / 2, 'mission', 0x30363f);
      g.guardOf = this.targetCar; this.escorts.push(g);
    }
    this.refreshMarker();
  },
  refreshMarker: function () {
    var sd = this.stageDef(); if (!sd) { WORLD.setMarker(0, 0, false); return; }
    if (this.targetCar && (sd.k === 'steal' || sd.k === 'disable' || sd.k === 'take')) {
      WORLD.setMarker(this.targetCar.mesh.position.x, this.targetCar.mesh.position.z, true);
    } else if (sd.k === 'deliver') {
      var f = FENCES[sd.fence]; WORLD.setMarker(f.x, f.z, true);
    } else if (sd.x !== undefined) WORLD.setMarker(sd.x, sd.z, true);
    else WORLD.setMarker(0, 0, false);
  },
  markerPos: function () {
    var sd = this.stageDef(); if (!sd) return null;
    if (this.targetCar && (sd.k === 'steal' || sd.k === 'disable' || sd.k === 'take')) return { x:this.targetCar.mesh.position.x,z:this.targetCar.mesh.position.z };
    if (sd.k === 'deliver') { var f = FENCES[sd.fence]; return { x:f.x,z:f.z }; }
    if (sd.x !== undefined) return { x:sd.x,z:sd.z };
    return null;
  },
  onEnterCar: function (car) {
    var sd = this.stageDef(); if (!sd) return;
    if ((sd.k === 'steal' || sd.k === 'take') && car === this.targetCar) this.completeStage();
  },
  onTargetDown: function (car) {
    var sd = this.stageDef(); if (!sd) return;
    if (sd.k === 'disable' && car === this.targetCar) this.completeStage();
  },
  completeStage: function () {
    var sd = this.stageDef(); if (!sd) return;
    if (sd.k === 'deliver' && this.targetCar) this.sellCar(this.targetCar, true);
    if (this.current === 5) this._truckRef = this.targetCar;
    AUDIO.blip(1318, 0.12, 0.15);
    this.stage++;
    if (this.stage >= this.defs[this.current].stages.length) this.completeMission();
    else { HUD.showEvent('OBJECTIVE DONE', this.stageDef().o); this.beginStage(); }
  },
  completeMission: function () {
    var def = this.defs[this.current];
    G.money += def.reward; G.stats.earned += def.reward;
    addRespect(120);
    var pp = PLAYER.pos(), dn = districtAt(pp.x, pp.z);
    G.standing[dn] = clamp(G.standing[dn] + 10, 0, 100);
    G.storyDone = Math.max(G.storyDone, this.current + 1);
    if (this.current === 6 || this.current === 7) G.wantedLock = null;
    if (this.current === 7) { G.respect = Math.max(G.respect, 1200); HUD.showEvent('PALMSHADE LEGEND', 'Story complete — 8 of 8'); }
    else HUD.showEvent('MISSION COMPLETE', def.name + ' — ' + fmtMoney(def.reward));
    this.current++; this.stage = 0;
    this.beginStage();
    SAVE.persist();
  },
  failStage: function () {
    HUD.showEvent('OBJECTIVE FAILED', 'The stage resets — try again');
    if (this.current === 7 && this.stage === 1) G.wantedLock = 5;
    this.beginStage();
  },
  sellCar: function (car, byMission) {
    var v = this.fenceValue(car);
    G.money += v; G.stats.sold++; G.stats.earned += v;
    addRespect(30);
    var dn = districtAt(car.mesh.position.x, car.mesh.position.z);
    G.standing[dn] = clamp(G.standing[dn] + 5, 0, 100);
    if (G.playerCar === car) PLAYER.exitCar();
    CARS.remove(car);
    if (this.targetCar === car) this.targetCar = null;
    HUD.showEvent('SOLD', car.def.name + ' — ' + fmtMoney(v));
    SAVE.persist();
    return v;
  },
  checkFence: function (dt) {
    this.sellCd -= dt;
    var car = G.playerCar; if (!car || !car.stolen || this.sellCd > 0) return;
    if (Math.abs(car.speed) > 0.8) return;
    var sd = this.stageDef();
    if (sd && sd.k === 'deliver' && car === this.targetCar) return;
    for (var i = 0; i < FENCES.length; i++) {
      var f = FENCES[i];
      if (dist2d(car.mesh.position.x, car.mesh.position.z, f.x, f.z) < 6.5) {
        this.sellCd = 2; this.sellCar(car, false); return;
      }
    }
  },
  driveAI: function (car, tx, tz, dt, mul) { COPS.steerTo(car, tx, tz, dt, mul || 1); },
  update: function (dt) {
    var sd = this.stageDef(); if (!sd) { WORLD.setMarker(0, 0, false); return; }
    this.refreshMarker();
    var pp = PLAYER.pos();
    if (sd.timer) {
      this.timerLeft -= dt;
      if (this.timerLeft <= 0) { this.failStage(); return; }
    }

    if (this.targetCar && !this.targetCar.dead && this.targetCar !== G.playerCar) {
      var tc = this.targetCar;
      if (this.current === 5 && sd.truck) {
        var wps = [[52, 71], [-52, 71], [-52, 84], [52, 84]];
        var wp = wps[tc.loopWp % 4];
        if (dist2d(tc.mesh.position.x, tc.mesh.position.z, wp[0], wp[1]) < 6) tc.loopWp++;
        this.driveAI(tc, wp[0], wp[1], dt, tc.health < 110 ? 1.05 : 0.8);
      } else if (tc.commander) {
        var cw = [[52, -26], [78, -26], [78, 26], [52, 26]];
        var cp = cw[tc.loopWp % 4];
        if (dist2d(tc.mesh.position.x, tc.mesh.position.z, cp[0], cp[1]) < 6) tc.loopWp++;
        this.driveAI(tc, cp[0], cp[1], dt, 1.05);
      }
    }
    for (var i = 0; i < this.escorts.length; i++) {
      var e = this.escorts[i]; if (e.dead) continue;
      var anchor = e.guardOf && !e.guardOf.dead ? e.guardOf : null;
      if (anchor && e !== G.playerCar) {
        var ax = anchor.mesh.position.x - Math.sin(anchor.heading) * 8, az = anchor.mesh.position.z - Math.cos(anchor.heading) * 8;
        this.driveAI(e, ax, az, dt, 1.1);
      }
      e.shootCd -= dt;
      if (e.shootCd <= 0 && dist2d(pp.x, pp.z, e.mesh.position.x, e.mesh.position.z) < 27) {
        e.shootCd = 1.15; GUNS.enemyShoot(e.mesh.position.x, e.mesh.position.z, 5);
      }
    }
    switch (sd.k) {
      case 'reach': if (dist2d(pp.x, pp.z, sd.x, sd.z) < 4.5) this.completeStage(); break;
      case 'escape': if (dist2d(pp.x, pp.z, sd.x, sd.z) < 6) this.completeStage(); break;
      case 'disable': if (this.targetCar && this.targetCar.health <= 30 && !this.targetCar.dead) this.completeStage(); break;
      case 'hold':
        if (dist2d(pp.x, pp.z, sd.x, sd.z) < 6.5) { this.holdT += dt; if (this.holdT >= (sd.hold || 6)) this.completeStage(); }
        else this.holdT = Math.max(0, this.holdT - dt);
        break;
      case 'deliver':
        if (G.playerCar === this.targetCar && this.targetCar) {
          var f = FENCES[sd.fence];
          if (dist2d(pp.x, pp.z, f.x, f.z) < 6.5 && Math.abs(G.playerCar.speed) < 0.8) this.completeStage();
        }
        break;
    }
    if (this.current === 7 && this.stage === 1) G.wantedLock = 5;
  }
};
