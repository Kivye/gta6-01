'use strict';

var AUDIO = {
  ctx: null, master: null, muted: false, station: 0, step: 0, nextNote: 0,
  engOsc: null, engGain: null, sirOsc: null, sirGain: null, sirPan: null, driftGain: null,
  stations: [
    { name:'PALM 98.4', genre:'Island Pop', track:'Neon Palms', bass:[110, 0, 130.8, 0, 98, 0, 146.8, 164.8] },
    { name:'SOL 101.9', genre:'Sunset Groove', track:'Golden Hour Drive', bass:[87.3, 87.3, 0, 110, 0, 130.8, 0, 98] },
    { name:'REEF 88.1', genre:'Night Drive', track:'Midnight Causeway', bass:[73.4, 0, 73.4, 110, 0, 92.5, 0, 123.5] }
  ],
  init: function () {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      var c = this.ctx;
      this.engOsc = c.createOscillator(); this.engOsc.type = 'sawtooth';
      this.engGain = c.createGain(); this.engGain.gain.value = 0;
      var ef = c.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 700;
      this.engOsc.connect(ef); ef.connect(this.engGain); this.engGain.connect(this.master); this.engOsc.start();
      this.sirOsc = c.createOscillator(); this.sirOsc.type = 'triangle'; this.sirOsc.frequency.value = 800;
      this.sirGain = c.createGain(); this.sirGain.gain.value = 0;
      this.sirPan = (c.createStereoPanner) ? c.createStereoPanner() : null;
      if (this.sirPan) { this.sirOsc.connect(this.sirGain); this.sirGain.connect(this.sirPan); this.sirPan.connect(this.master); }
      else { this.sirOsc.connect(this.sirGain); this.sirGain.connect(this.master); }
      this.sirOsc.start();
      var nb = this.noiseBuffer();
      var ds = c.createBufferSource(); ds.buffer = nb; ds.loop = true;
      var df = c.createBiquadFilter(); df.type = 'bandpass'; df.frequency.value = 900; df.Q.value = 2;
      this.driftGain = c.createGain(); this.driftGain.gain.value = 0;
      ds.connect(df); df.connect(this.driftGain); this.driftGain.connect(this.master); ds.start();
      this.nextNote = c.currentTime + 0.1;
    } catch (e) { this.ctx = null; }
  },
  noiseBuffer: function () {
    var c = this.ctx, b = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  },
  stationInfo: function () { return this.stations[this.station]; },
  cycleStation: function () {
    this.station = (this.station + 1) % this.stations.length;
    if (this.ctx) { var t = this.ctx.currentTime; this.blip(1320, 0.06, 0.12); this.blipAt(1760, t + 0.07, 0.06, 0.1); }
    return this.stationInfo();
  },
  setMuted: function (m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.5; },
  blip: function (f, dur, vol) { if (this.ctx) this.blipAt(f, this.ctx.currentTime, dur, vol); },
  blipAt: function (f, t, dur, vol) {
    if (!this.ctx) return; var c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = 'square'; o.frequency.value = f; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  },
  tone: function (f, dur, vol, type) {
    if (!this.ctx) return; var c = this.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.value = f; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  },
  noiseHit: function (dur, vol, freq, type) {
    if (!this.ctx) return; var c = this.ctx, t = c.currentTime, s = c.createBufferSource();
    s.buffer = this.noiseBuffer(); var f = c.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.value = freq;
    var g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t); s.stop(t + dur + 0.02);
  },
  gun: function (kind) {
    if (!this.ctx) return;
    if (kind === 'pistol') { this.noiseHit(0.09, 0.5, 2600, 'highpass'); this.tone(150, 0.07, 0.4, 'square'); }
    else if (kind === 'smg') { this.noiseHit(0.05, 0.34, 3200, 'highpass'); this.tone(210, 0.04, 0.3, 'square'); }
    else { this.noiseHit(0.3, 0.8, 700, 'lowpass'); this.noiseHit(0.12, 0.5, 2400, 'highpass'); this.tone(70, 0.22, 0.6, 'sine'); }
  },
  update: function (dt) {
    if (!this.ctx) return; var c = this.ctx, t = c.currentTime;

    while (this.nextNote < t + 0.12) {
      var st = this.stations[this.station], f = st.bass[this.step % 8];
      if (f > 0 && !this.muted) {
        var o = c.createOscillator(), g = c.createGain();
        o.type = 'triangle'; o.frequency.value = f;
        g.gain.setValueAtTime(0.16, this.nextNote); g.gain.exponentialRampToValueAtTime(0.001, this.nextNote + 0.21);
        o.connect(g); g.connect(this.master); o.start(this.nextNote); o.stop(this.nextNote + 0.23);
      }
      this.step++; this.nextNote += 0.215;
    }

    var car = G.playerCar, rpm = 0, gear = 1;
    if (car) { var sp = Math.abs(car.speed); rpm = clamp(sp / car.def.top, 0, 1); gear = clamp(1 + Math.floor(rpm * 4), 1, 5); }
    var target = car ? 55 + rpm * 165 + gear * 6 : 0;
    this.engOsc.frequency.setTargetAtTime(target, t, 0.05);
    this.engGain.gain.setTargetAtTime(car && G.mode === 'play' ? 0.05 + rpm * 0.06 : 0, t, 0.08);

    var near = COPS.nearestUnit();
    if (near && effWanted() > 0) {
      var d = Math.max(near.d, 1), vol = clamp(1 - d / 90, 0, 1) * 0.14;
      this.sirGain.gain.setTargetAtTime(vol, t, 0.1);
      this.sirOsc.frequency.setTargetAtTime((Math.floor(G.time * 1.6) % 2 === 0) ? 720 : 990, t, 0.03);
      if (this.sirPan) this.sirPan.pan.setTargetAtTime(clamp(near.side, -1, 1), t, 0.1);
    } else this.sirGain.gain.setTargetAtTime(0, t, 0.1);

    var drifting = car && car.sliding && Math.abs(car.speed) > 6;
    this.driftGain.gain.setTargetAtTime(drifting ? 0.12 : 0, t, 0.06);
  }
};
