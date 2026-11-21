'use strict';

var SAVE_KEY = 'palmshade-heat-v3';
var SAVE = {
  persist: function () {
    try {
      var d = { money:G.money, respect:G.respect, standing:G.standing, storyDone:G.storyDone,
        armour: G.armour, ownSmg:G.ownSmg, ownShotgun:G.ownShotgun, ammoSmg:G.ammoSmg, ammoShot:G.ammoShot,
        props: G.props, fav:G.fav, stats:G.stats, mission:(typeof MSN !== 'undefined' && MSN.current) || 0 };
      localStorage.setItem(SAVE_KEY, JSON.stringify(d));
    } catch (e) {  }
  },
  load: function () {
    try {
      var raw = localStorage.getItem(SAVE_KEY); if (!raw) return false;
      var d = JSON.parse(raw); if (!d) return false;
      G.money = d.money; G.respect = d.respect; G.standing = d.standing; G.storyDone = d.storyDone;
      G.armour = d.armour; G.ownSmg = d.ownSmg; G.ownShotgun = d.ownShotgun;
      G.ammoSmg = d.ammoSmg; G.ammoShot = d.ammoShot; G.props = d.props || []; G.fav = d.fav || null;
      G.stats = d.stats; G._savedMission = d.mission || 0;
      return true;
    } catch (e) { return false; }
  },
  wipe: function () { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }
};
