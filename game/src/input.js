'use strict';

var INPUT = {
  keys: {}, mouseDown: false,
  init: function () {
    addEventListener('keydown', function (ev) {
      if (ev.repeat) { INPUT.keys[ev.code] = true; return; }
      INPUT.keys[ev.code] = true;
      MAIN.onKey(ev.code);
    });
    addEventListener('keyup', function (ev) { INPUT.keys[ev.code] = false; });
    addEventListener('mousedown', function (ev) { if (ev.target.tagName === 'CANVAS') INPUT.mouseDown = true; });
    addEventListener('mouseup', function () { INPUT.mouseDown = false; });
    addEventListener('wheel', function (ev) {
      if (G.mode !== 'play') return;
      var owned = [1, 2, 3].filter(function (s) { return GUNS.owned(s); });
      var i = owned.indexOf(G.slot);
      i = (i + (ev.deltaY > 0 ? 1 : -1) + owned.length) % owned.length;
      GUNS.select(owned[i]);
    }, { passive: true });
    addEventListener('mousemove', function (ev) {
      if (document.pointerLockElement && G.mode === 'play') {
        MAIN.camYaw -= ev.movementX * 0.0032;
        MAIN.camPitch = clamp(MAIN.camPitch + ev.movementY * 0.002, -0.15, 0.55);
      }
    });
  }
};
