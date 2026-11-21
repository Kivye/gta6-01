'use strict';

var MAIN = {
  camYaw: 0, camPitch: 0.22, camOverride: null, lastTs: 0,
  boot: function () {
    window.__errors = [];
    addEventListener('error', function (ev) { window.__errors.push(String(ev.message || ev.error)); });
    WORLD.build();
    PLAYER.build();
    COPS.init();
    ULTRA.init();
    HUD.init();
    INPUT.init();
    SAVE.load();
    MSN.start(clamp(G._savedMission || 0, 0, 7));

    var spots = [[-52, 20, 'sedan'], [0, -33, 'compact'], [26, -59, 'suv'], [52, 59, 'taxi'], [-26, 59, 'sedan'], [78, -52, 'compact'], [-78, 26, 'cabrio'], [0, 45, 'sedan'], [33, 0, 'compact'], [-33, -26, 'suv']];
    for (var i = 0; i < spots.length; i++) {
      var c = CARS.spawn(spots[i][2], spots[i][0] + 3.5, spots[i][1], Math.PI / 2, 'parked');
      c.kind = 'parked';
    }
    PEDS.scatter(16);
    document.getElementById('startBtn').addEventListener('click', function () { MAIN.startGame(); });
    document.getElementById('resumeBtn').addEventListener('click', function () { MAIN.setPaused(false); });
    WORLD.renderer.domElement.addEventListener('click', function () {
      if (G.mode === 'play' && !G.paused && document.body.requestPointerLock) { try { WORLD.renderer.domElement.requestPointerLock(); } catch (e) {} }
    });
    requestAnimationFrame(function (ts) { MAIN.frame(ts); });
  },
  startGame: function () {
    if (G.mode === 'play') return;
    AUDIO.init();
    if (AUDIO.ctx && AUDIO.ctx.resume) AUDIO.ctx.resume();
    G.mode = 'play';
    document.getElementById('title').style.display = 'none';
  },
  setPaused: function (b) {
    if (G.mode !== 'play') return;
    G.paused = b;
    document.getElementById('pausePanel').style.display = b ? 'block' : 'none';
    document.getElementById('resumeBtn').style.display = b ? 'inline-block' : 'none';
    if (b) HUD.fillPause();
    if (document.exitPointerLock && document.pointerLockElement) document.exitPointerLock();
  },
  onKey: function (code) {
    if (G.mode === 'title') { if (code === 'Enter') this.startGame(); return; }
    if (code === 'KeyP' || code === 'Escape') { this.setPaused(!G.paused); return; }
    if (G.paused || G.frozen) return;
    var pp = PLAYER.pos();
    switch (code) {
      case 'KeyR': { var si = AUDIO.cycleStation(); HUD.showToast(si.name, si.genre + ' · "' + si.track + '"'); break; }
      case 'KeyM': AUDIO.setMuted(!AUDIO.muted); break;
      case 'KeyN': ULTRA.nightTarget = ULTRA.nightTarget > 0.5 ? 0 : 1; HUD.showToast('NEON NIGHT', ULTRA.nightTarget ? 'Preset on' : 'Preset off'); break;
      case 'KeyZ': CREW.use(0); break;
      case 'KeyX': CREW.use(1); break;
      case 'KeyC': CREW.use(2); break;
      case 'KeyE': if (!ULTRA.lootCashVan()) PLAYER.toggleCar(); break;
      case 'KeyT': { var ri = ULTRA.raceAt(pp.x, pp.z); if (ri >= 0 && !ULTRA.race) ULTRA.startRace(ri, G.money >= 500 ? 500 : 250); break; }
      case 'KeyB': { var prop = ULTRA.propertyAt(pp.x, pp.z); if (prop) ULTRA.buyProperty(prop); break; }
      case 'KeyY': ULTRA.respray(); break;
      case 'KeyU': if (!ULTRA.saveFav()) ULTRA.takeFav(); break;
      case 'Digit1': if (G.shopOpen) GUNS.buy('smg'); else GUNS.select(1); break;
      case 'Digit2': if (G.shopOpen) GUNS.buy('shotgun'); else GUNS.select(2); break;
      case 'Digit3': if (G.shopOpen) GUNS.buy('refill'); else GUNS.select(3); break;
      case 'Digit4': if (G.shopOpen) GUNS.buy('kevlar'); break;
    }
  },
  frame: function (ts) {
    requestAnimationFrame(function (t) { MAIN.frame(t); });
    var dt = Math.min(0.35, (ts - this.lastTs) / 1000 || 0.016);
    this.lastTs = ts;
    if (G.mode === 'play' && !G.paused) {
      if (G.frozen) {
        COPS.updateHeli(dt, PLAYER.pos(), effWanted());
        CARS.update(0);
        WORLD.update(dt);
      } else {
        var gdt = dt * G.timeScale;
        G.time += gdt; G.playSeconds += gdt;
        PLAYER.update(gdt);
        CARS.update(gdt);
        COPS.update(gdt);
        PEDS.update(gdt);
        MSN.update(gdt);
        ULTRA.update(gdt);
        GUNS.update(gdt);
        WORLD.update(gdt);
        AUDIO.update(dt);
      }
    } else if (G.mode === 'title') {
      WORLD.update(dt);
      if (COPS.heli) COPS.heli.rotor.rotation.y += dt * 10;
    }
    this.updateCamera(dt);
    HUD.update(dt);
    WORLD.renderer.render(WORLD.scene, WORLD.camera);
  },
  updateCamera: function (dt) {
    var cam = WORLD.camera;
    if (this.camOverride) {
      cam.position.set(this.camOverride.x, this.camOverride.y, this.camOverride.z);
      cam.lookAt(this.camOverride.lx, this.camOverride.ly, this.camOverride.lz);
      return;
    }
    if (G.mode === 'title') {
      var t = performance.now() * 0.00005;
      cam.position.set(Math.sin(t) * 85, 30, Math.cos(t) * 85);
      cam.lookAt(0, 4, 60);
      return;
    }
    var car = G.playerCar;
    if (car) {
      var p = car.mesh.position, h = car.heading;
      var bx = p.x - Math.sin(h) * 10.5, bz = p.z - Math.cos(h) * 10.5;
      cam.position.lerp(new THREE.Vector3(bx, 4.4, bz), 1 - Math.pow(0.001, dt));
      cam.lookAt(p.x + Math.sin(h) * 7, 1.6, p.z + Math.cos(h) * 7);
      this.camYaw = h;
    } else {
      var pp = PLAYER.mesh.position;
      if (!document.pointerLockElement) {
        var diff = PLAYER.heading - this.camYaw;
        while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
        this.camYaw += diff * Math.min(1, dt * 3.5);
      }
      var fx = Math.sin(this.camYaw), fz = Math.cos(this.camYaw);
      cam.position.lerp(new THREE.Vector3(pp.x - fx * 6.4, 2.4 + this.camPitch * 4, pp.z - fz * 6.4), 1 - Math.pow(0.0001, dt));
      cam.lookAt(pp.x + fx * 5, 1.5, pp.z + fz * 5);
    }
  }
};
document.addEventListener('DOMContentLoaded', function () { MAIN.boot(); });
