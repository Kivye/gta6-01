'use strict';

var CREW = {
  members: [
    { name:'Nia Ferrer', role:'Driver', ability:'SWAP PLATES', key:'KeyZ', cd:90, color:'#d64541', cdUntil:0 },
    { name:'Bo Castellano', role:'Mechanic', ability:'QUICK FIX', key:'KeyX', cd:60, color:'#2bb3a3', cdUntil:0 },
    { name:'Juno Reyes', role:'Lookout', ability:'EYES OUT', key:'KeyC', cd:75, color:'#8e44ad', cdUntil:0 }
  ],
  ready: function (i) { return G.time >= this.members[i].cdUntil; },
  stateLabel: function (i) {
    var m = this.members[i];
    if (i === 2 && G.time < G.eyesOutUntil) return 'ACTIVE ' + Math.ceil(G.eyesOutUntil - G.time);
    if (!this.ready(i)) return Math.ceil(m.cdUntil - G.time) + 's';
    return 'READY';
  },
  reject: function (why) { HUD.showEvent('CREW', why); AUDIO.blip(180, 0.12, 0.12); },
  use: function (i) {
    var m = this.members[i];
    if (!this.ready(i)) { this.reject(m.ability + ' is on cooldown'); return; }
    if (i === 0) {
      if (!G.playerCar) return this.reject('Swap Plates needs you driving');
      if (effWanted() <= 0) return this.reject('No heat to shake right now');
      if (G.wantedLock) return this.reject('Locked-on heat ignores plates');
      COPS.setWanted(G.wanted - 1);
      HUD.showEvent('SWAP PLATES', 'Fresh plates — one star gone');
    } else if (i === 1) {
      if (!G.playerCar) return this.reject('Quick Fix needs you in the car');
      if (G.playerCar.health >= 100 && !G.flatTyre) return this.reject('This ride needs no fixing');
      G.playerCar.health = Math.min(100, G.playerCar.health + 45);
      if (G.playerCar.health > 35) G.playerCar.refs.smoke.visible = false;
      G.flatTyre = false;
      HUD.showEvent('QUICK FIX', 'Bo patched the ride +45');
    } else {
      G.eyesOutUntil = G.time + 20;
      HUD.showEvent('EYES OUT', 'Juno is watching every cruiser');
    }
    m.cdUntil = G.time + m.cd;
    G.stats.crew++; addRespect(5);
    AUDIO.blip(1040, 0.09, 0.13);
    SAVE.persist();
  }
};
