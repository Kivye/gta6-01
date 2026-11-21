'use strict';

var PLAYER = {
  mesh: null, refs: null, heading:0, speedNow: 0,
  build: function () {
    var grp = new THREE.Group();
    var legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.22), WORLD.mat(0x27324a)); legL.position.set(-0.14, 0.4, 0); grp.add(legL);
    var legR = legL.clone(); legR.position.x = 0.14; grp.add(legR);
    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.66, 0.3), WORLD.mat(0xd8622a)); torso.position.y = 1.13; grp.add(torso);
    var armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.16), WORLD.mat(0xd8622a)); armL.position.set(-0.38, 1.1, 0); grp.add(armL);
    var armR = armL.clone(); armR.position.x = 0.38; grp.add(armR);
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 0.32), WORLD.mat(0xb97a4a)); head.position.y = 1.66; grp.add(head);
    var gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.85), WORLD.mat(0x14161a)); gun.position.set(0.38, 1.05, 0.45); gun.visible = false; grp.add(gun);
    grp.position.set(-20, 0, 26);
    WORLD.scene.add(grp);
    this.mesh = grp; this.refs = { legL: legL, legR: legR, armR: armR, gun: gun }; this.legPh = 0;
  },
  pos: function () {
    if (G.playerCar) return { x:G.playerCar.mesh.position.x, z:G.playerCar.mesh.position.z };
    return { x:this.mesh.position.x, z:this.mesh.position.z };
  },
  hurt: function (amt) {
    if (G.mode !== 'play' || G.frozen) return;
    var absorbed = Math.min(G.armour, amt); G.armour -= absorbed; amt -= absorbed;
    G.health -= amt;
    if (G.health <= 0) this.die();
  },
  die: function () {
    this.exitCar(true);
    G.health = 100; G.armour = 40;
    COPS.setWanted(0);
    this.mesh.position.set(HOSPITAL.x, 0, HOSPITAL.z);
    HUD.showEvent('WASTED', 'Patched up at Palmshade General — armour restored');
    SAVE.persist();
  },
  nearestCar: function () { return CARS.nearest(this.mesh.position.x, this.mesh.position.z, 3.6, function (c) { return !c.dead; }); },
  enterCar: function (car) {
    var wasOwned = car.kind === 'fav' || car.ownedByPlayer;
    G.playerCar = car; car.kind = car.kind === 'traffic' || car.kind === 'parked' ? 'player' : car.kind;
    this.mesh.visible = false;
    if (!wasOwned && !car.countedStolen) {
      car.countedStolen = true; car.stolen = true;
      G.stats.stolen++;
      HUD.showEvent('VEHICLE STOLEN', car.def.name);
      var pp = car.mesh.position, witness = null, wd = 70;
      for (var i = 0; i < COPS.units.length; i++) {
        var u = COPS.units[i], d = dist2d(pp.x, pp.z, u.mesh.position.x, u.mesh.position.z);
        if (d < wd && !COPS.segBlocked(pp.x, pp.z, u.mesh.position.x, u.mesh.position.z)) { wd = d; witness = u; }
      }
      if (witness) {
        var dName = districtAt(pp.x, pp.z);
        G.standing[dName] = clamp(G.standing[dName] - 2, 0, 100);
        COPS.report(witness.callsign, 'vehicle theft reported in ' + dName);
        if (!G.wantedLock) COPS.setWanted(G.wanted + 1);
      }
      SAVE.persist();
    }
    if (MSN.onEnterCar) MSN.onEnterCar(car);
  },
  exitCar: function (silent) {
    var car = G.playerCar; if (!car) return;
    G.playerCar = null;
    if (car.kind === 'player') car.kind = 'parked';
    this.mesh.position.set(car.mesh.position.x + Math.cos(car.heading) * 2.2, 0, car.mesh.position.z - Math.sin(car.heading) * 2.2);
    this.mesh.visible = true;
    G.flatTyre = false;
  },
  toggleCar: function () {
    if (G.playerCar) { if (Math.abs(G.playerCar.speed) < 1.5) this.exitCar(); return; }
    var near = this.nearestCar();
    if (near) this.enterCar(near.car);
  },
  update: function (dt) {
    if (G.playerCar) {
      var car = G.playerCar;
      var th = (INPUT.keys['KeyW'] ? 1 : 0) + (INPUT.keys['KeyS'] ? -1 : 0);
      var st = (INPUT.keys['KeyA'] ? 1 : 0) + (INPUT.keys['KeyD'] ? -1 : 0);
      if (G.flatTyre) st += Math.sin(G.time * 7) * 0.04;
      CARS.stepCar(car, th, st, dt, !!INPUT.keys['Space']);
      this.heading = car.heading;
      this.mesh.position.set(car.mesh.position.x, -3, car.mesh.position.z);
      G.shopOpen = false;
      return;
    }
    var mx = (INPUT.keys['KeyD'] ? 1 : 0) - (INPUT.keys['KeyA'] ? 1 : 0);
    var mz = (INPUT.keys['KeyS'] ? 1 : 0) - (INPUT.keys['KeyW'] ? 1 : 0);
    var moving = (mx !== 0 || mz !== 0);
    var run = INPUT.keys['ShiftLeft'] ? 8.2 : 5.2;
    if (moving) {
      var cy = MAIN.camYaw;
      var wx = mx * Math.cos(cy) - mz * Math.sin(cy), wz = -mx * Math.sin(cy) - mz * Math.cos(cy);
      var want = Math.atan2(wx, wz), diff = want - this.heading;
      while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
      this.heading += clamp(diff, -10 * dt, 10 * dt);
      var sp = firing() ? run * 0.45 : run;
      this.mesh.position.x += Math.sin(this.heading) * sp * dt;
      this.mesh.position.z += Math.cos(this.heading) * sp * dt;
      var f = WORLD.collide(this.mesh.position.x, this.mesh.position.z, 0.45);
      this.mesh.position.x = f.x; this.mesh.position.z = f.z;
      this.legPh += dt * sp * 2.2;
    }
    if (firing()) this.heading = MAIN.camYaw;
    this.mesh.rotation.y = this.heading;
    this.refs.legL.rotation.x = moving ? Math.sin(this.legPh) * 0.6 : 0;
    this.refs.legR.rotation.x = moving ? -Math.sin(this.legPh) * 0.6 : 0;
    this.refs.gun.visible = G.slot > 1;
    this.refs.gun.scale.z = G.slot === 3 ? 1.25 : 0.7;

    var vp = this.mesh.position;
    if (WORLD.vest.available && dist2d(vp.x, vp.z, VEST_POS.x, VEST_POS.z) < 1.6) {
      G.armour = 100; WORLD.vest.available = false; WORLD.vest.grp.visible = false; WORLD.vest.respawnT = 60;
      HUD.showToast('KEVLAR VEST', 'Armour 100'); AUDIO.blip(880, 0.1, 0.15);
    }
    G.shopOpen = dist2d(vp.x, vp.z, GUNVAN.x, GUNVAN.z) < 5;
  }
};
function firing() { return INPUT.mouseDown || INPUT.keys['Space']; }
