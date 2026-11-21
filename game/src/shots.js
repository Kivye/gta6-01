'use strict';

var SHOTS = {
  prep: function () {
    if (G.mode !== 'play') MAIN.startGame();
    G.frozen = true; G.paused = false;
    document.getElementById('pausePanel').style.display = 'none';
    document.getElementById('resumeBtn').style.display = 'none';
    COPS.setWanted(0); G.wantedLock = null; HUD.evUntil = -1; HUD.toastUntil = -1;
    for (var i = COPS.units.length - 1; i >= 0; i--) CARS.remove(COPS.units[i]);
    COPS.units = []; COPS.roadblock = null;
    if (COPS.swat) { CARS.remove(COPS.swat); COPS.swat = null; }
    G.playerCar = null; PLAYER.mesh.visible = true; G.dialogOverride = null;
    ULTRA.race = null; ULTRA.gate.visible = false;
  },
  cop: function (x, z, h) {
    var c = CARS.spawn('sedan', x, z, h, 'police');
    c.callsign = 'PALM-' + (++COPS.seq); c.role = 'PURSUIT'; COPS.units.push(c); return c;
  },
  cover: function () {
    this.prep();
    ULTRA.nightCur = 1; ULTRA.nightTarget = 1; WORLD.applyNight(1); WORLD.rain.visible = false;
    MSN.start(2); if (MSN.targetCar) { CARS.remove(MSN.targetCar); MSN.targetCar = null; }
    G.money = 2450; G.storyDone = 5; G.respect = 640;
    G.ownSmg = true; G.ownShotgun = true; G.ammoSmg = 120; G.ammoShot = 24; G.slot = 1; G.nitro = 65;
    var hero = CARS.spawn('sport', 0, 84, 0, 'player', 0xd64541);
    hero.health = Math.round(hero.maxHp * 0.88); hero.speed = 17; hero.stolen = true;
    G.playerCar = hero; PLAYER.mesh.visible = false; PLAYER.heading = 0;
    COPS.setWanted(5);
    this.cop(-3.6, 74, 0); this.cop(3.6, 75.5, 0);
    var hurt = this.cop(0, 64, 0); hurt.health = Math.round(hurt.maxHp * 0.3); hurt.refs.smoke.visible = true;
    this.cop(0, 28, 0);
    var rb = this.cop(7.5, 96, Math.PI / 2);
    COPS.roadblock = { car:rb, tx:7.5, tz:96, faceH:Math.PI / 2, since:G.time, set:true }; rb.role = 'ROADBLOCK';
    var sw = CARS.spawn('van', -7.5, 70, 0, 'swat', 0x14161c);
    sw.health = 280; sw.maxHp = 280; sw.callsign = 'SWAT-1'; COPS.swat = sw;
    COPS.heli.active = true; COPS.heli.grp.visible = true;
    COPS.heli.grp.position.set(2, 14, 90); COPS.heli.disc.visible = true; COPS.heli.disc.position.set(2, 0.12, 90);
    COPS.report('PALM-2', 'vehicle theft reported in Marina');
    G.dialogOverride = { name:'Juno Reyes', role:'Lookout', color:'#8e44ad', line: 'AIR-1 has eyes on us — break the light or own it.' };
    CARS.spawn('taxi', 26, 86, Math.PI / 2, 'traffic'); CARS.spawn('sedan', -26, 70, -Math.PI / 2, 'traffic'); CARS.spawn('cabrio', 52, 88, -Math.PI / 2, 'traffic');
    var pedSpots = [[-14, 68], [18, 68], [-30, 88.5], [24, 89], [-8, 67], [30, 67], [12, 89], [-20, 89], [8, 67]];
    for (var pi = 0; pi < pedSpots.length; pi++) PEDS.spawn(pedSpots[pi][0], pedSpots[pi][1]);
    MAIN.camOverride = { x:9.5, y:5.6, z:108, lx:2, ly: 4.2, lz: 84 };
  },
  race: function () {
    this.prep();
    ULTRA.nightCur = 0; ULTRA.nightTarget = 0; WORLD.applyNight(0);
    G.money = 2000; MSN.start(0); if (MSN.targetCar) { CARS.remove(MSN.targetCar); MSN.targetCar = null; }
    var car = CARS.spawn('cabrio', 0, 77, Math.PI / 2, 'player', 0xf2b134);
    G.playerCar = car; PLAYER.mesh.visible = false;
    ULTRA.startRace(0, 500);
    var r = ULTRA.race; r.idx = 1; r.t = 34.5;
    car.mesh.position.set(48, 0, 44); car.heading = 2.92; car.speed = 24;
    var rp = [[44, 47.5, 2.85], [52.5, 48, 3.0], [45.5, 37.5, 2.8]];
    for (var i = 0; i < 3; i++) {
      r.rivals[i].car.mesh.position.set(rp[i][0], 0, rp[i][1]);
      r.rivals[i].car.heading = rp[i][2]; r.rivals[i].idx = 1;
    }
    ULTRA.placeGate();
    G.nitro = 55; G.slot = 1;
    HUD.showToast('NEAR MISS ×2', '+10 RESPECT'); HUD.flashSpeedo();
    MAIN.camOverride = { x:28, y:7.2, z:58, lx: 48, ly: 1.4, lz: 43 };
  },
  onfoot: function () {
    this.prep();
    ULTRA.nightCur = 0; ULTRA.nightTarget = 0; WORLD.applyNight(0);
    MSN.start(0); if (MSN.targetCar) { CARS.remove(MSN.targetCar); MSN.targetCar = null; }
    G.ownSmg = true; G.ownShotgun = true; G.ammoSmg = 120; G.ammoShot = 24; G.slot = 3; G.armour = 60;
    PLAYER.mesh.position.set(8.5, 0, 82); PLAYER.heading = 0.72; MAIN.camYaw = 0.72;
    COPS.setWanted(2);
    this.cop(26, 80, -Math.PI / 2); this.cop(-14, 78, Math.PI / 2);
    COPS.report('PALM-1', 'shots fired in Marina');
    PEDS.scatter(3, 16, 74, 8);
    MAIN.camOverride = { x:1.5, y:2.6, z:74.5, lx: 9, ly: 1.3, lz: 84 };
  },
  stats: function () {
    this.prep();
    ULTRA.nightCur = 0; ULTRA.nightTarget = 0; WORLD.applyNight(0);
    MSN.current = 8; MSN.stage = 0; WORLD.setMarker(0, 0, false);
    G.storyDone = 8; G.respect = 1240; G.money = 12840;
    G.standing = { 'Marina': 85, 'Old Town': 78, 'The Heights': 92 };
    G.props = ['pier', 'yard', 'pent'];
    G.stats = { stolen:14, sold: 9, distKm: 412.5, topKmh: 148, escapes: 6, shots: 233, earned: 48650, crew: 17, nearMiss: 31, stunts: 8, racesWon: 3 };
    var hero = CARS.spawn('cabrio', 54, -30, Math.PI / 2, 'player', 0xec7f2d);
    hero.health = Math.round(hero.maxHp * 0.76); hero.speed = 31;
    G.playerCar = hero; PLAYER.mesh.visible = false;
    COPS.setWanted(4);
    this.cop(43, -27.5, Math.PI / 2);
    var rb = this.cop(78, -31, 0);
    COPS.roadblock = { car:rb, tx:78, tz:-31, faceH:0, since:G.time, set:true }; rb.role = 'ROADBLOCK';
    MAIN.camOverride = { x:36, y:4.2, z:-25, lx: 66, ly: 1.5, lz: -28 };
    MAIN.setPaused(true);
  }
};
window.PS = {
  G: G, CARS: CARS, COPS: COPS, MSN: MSN, CREW: CREW, ULTRA: ULTRA, GUNS: GUNS,
  PLAYER: PLAYER, WORLD: WORLD, AUDIO: AUDIO,
  start: function () { MAIN.startGame(); },
  stage: function (name) { SHOTS[name](); },
  teleport: function (x, z) {
    if (G.playerCar) { G.playerCar.mesh.position.set(x, 0, z); G.playerCar.speed = 0; }
    else PLAYER.mesh.position.set(x, 0, z);
  },
  key: function (code) { MAIN.onKey(code); },
  errors: function () { return window.__errors || []; }
};
