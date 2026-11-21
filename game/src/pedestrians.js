'use strict';

var PEDS = {
  list: [],
  buildMesh: function (shirt) {
    var grp = new THREE.Group();
    var legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, 0.2), WORLD.mat(0x2c3242)); legL.position.set(-0.13, 0.38, 0); grp.add(legL);
    var legR = legL.clone(); legR.position.x = 0.13; grp.add(legR);
    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.28), WORLD.mat(shirt)); torso.position.y = 1.06; grp.add(torso);
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.3), WORLD.mat(0xd9a066)); head.position.y = 1.55; grp.add(head);
    WORLD.scene.add(grp);
    return { grp:grp, legL: legL, legR: legR };
  },
  spawn: function (x, z) {
    var refs = this.buildMesh(pick(CAR_COLORS));
    refs.grp.position.set(x, 0, z);
    var ped = { mesh:refs.grp, refs: refs, heading:rand(0, 6.28), speed:rand(1.1, 1.9), health:50, state: 'walk', tx:x, tz:z, legPh: rand(0, 6) };
    this.list.push(ped); return ped;
  },
  scatter: function (n, cx, cz, r) {
    for (var i = 0; i < n; i++) {
      var road = pick(ROADS), off = chance(0.5) ? 9.6 : -9.6;
      var x = cx !== undefined ? cx + rand(-r, r) : (chance(0.5) ? road + off : rand(-100, 100));
      var z = cz !== undefined ? cz + rand(-r, r) : (chance(0.5) ? rand(-100, 100) : road + off);
      this.spawn(clamp(x, -105, 105), clamp(z, -105, 105));
    }
  },
  hurt: function (ped, amt) {
    if (ped.state === 'down') return;
    ped.health -= amt;
    if (ped.health <= 0) { ped.state = 'down'; ped.mesh.rotation.x = -Math.PI / 2; ped.mesh.position.y = 0.25; }
    else { ped.state = 'flee'; ped.fleeT = 4; }
  },
  nearest: function (x, z, maxD) {
    var best = null, bd = maxD;
    for (var i = 0; i < this.list.length; i++) {
      var p = this.list[i]; if (p.state === 'down') continue;
      var d = dist2d(x, z, p.mesh.position.x, p.mesh.position.z);
      if (d < bd) { bd = d; best = p; }
    }
    return best ? { ped: best, d: bd } : null;
  },
  update: function (dt) {
    for (var i = 0; i < this.list.length; i++) {
      var p = this.list[i]; if (p.state === 'down') continue;
      var pos = p.mesh.position;
      if (p.state === 'flee') {
        p.fleeT -= dt;
        var src = G.danger && G.time - G.danger.t < 3 ? G.danger : { x:pos.x + 10, z:pos.z };
        var away = Math.atan2(pos.x - src.x, pos.z - src.z);
        p.heading = away; p.speed = 5.2;
        if (p.fleeT <= 0) p.state = 'walk';
      } else {
        if (dist2d(pos.x, pos.z, p.tx, p.tz) < 2) {
          var road = pick(ROADS), off = chance(0.5) ? 9.6 : -9.6;
          if (chance(0.5)) { p.tx = clamp(pos.x + rand(-40, 40), -105, 105); p.tz = road + off; }
          else { p.tx = road + off; p.tz = clamp(pos.z + rand(-40, 40), -105, 105); }
        }
        var want = Math.atan2(p.tx - pos.x, p.tz - pos.z), diff = want - p.heading;
        while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
        p.heading += clamp(diff, -2.4 * dt, 2.4 * dt); p.speed = 1.5;
      }
      pos.x += Math.sin(p.heading) * p.speed * dt;
      pos.z += Math.cos(p.heading) * p.speed * dt;
      var f = WORLD.collide(pos.x, pos.z, 0.4); pos.x = f.x; pos.z = f.z;
      p.mesh.rotation.y = p.heading;
      p.legPh += dt * p.speed * 3.4;
      p.refs.legL.rotation.x = Math.sin(p.legPh) * 0.55;
      p.refs.legR.rotation.x = -Math.sin(p.legPh) * 0.55;
    }
    if (!G.frozen && this.list.length < 16) this.scatter(2);
  }
};
