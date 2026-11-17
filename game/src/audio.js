// Procedural WebAudio: engine, siren, shots, thuds, horns, jingles, ambient loop.
// Nothing starts until unlock() is called from a user gesture.
export class GameAudio {
  constructor() { this.ctx = null; this.muted = false; this.musicTimer = 0; this.sirenPhase = 0; }
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.5; this.master.connect(this.ctx.destination);
      // Engine: sawtooth through a lowpass, pitch follows speed.
      this.engOsc = this.ctx.createOscillator(); this.engOsc.type = 'sawtooth'; this.engOsc.frequency.value = 55;
      this.engFil = this.ctx.createBiquadFilter(); this.engFil.type = 'lowpass'; this.engFil.frequency.value = 300;
      this.engGain = this.ctx.createGain(); this.engGain.gain.value = 0;
      this.engOsc.connect(this.engFil).connect(this.engGain).connect(this.master); this.engOsc.start();
      // Siren: triangle wave flipped between two tones.
      this.sirOsc = this.ctx.createOscillator(); this.sirOsc.type = 'triangle'; this.sirOsc.frequency.value = 700;
      this.sirGain = this.ctx.createGain(); this.sirGain.gain.value = 0;
      this.sirOsc.connect(this.sirGain).connect(this.master); this.sirOsc.start();
    } catch { this.ctx = null; }
  }
  toggleMute() { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : 0.5; return this.muted; }
  setEngine(on, speedRatio) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engGain.gain.setTargetAtTime(on && !this.muted ? 0.05 + speedRatio * 0.05 : 0, t, 0.1);
    this.engOsc.frequency.setTargetAtTime(55 + speedRatio * 165, t, 0.08);
  }
  setSiren(on, dt) {
    if (!this.ctx) return;
    this.sirenPhase += dt * 2.4;
    const tone = (Math.sin(this.sirenPhase * Math.PI) > 0) ? 940 : 680;
    this.sirOsc.frequency.setTargetAtTime(tone, this.ctx.currentTime, 0.03);
    this.sirGain.gain.setTargetAtTime(on && !this.muted ? 0.018 : 0, this.ctx.currentTime, 0.1);
  }
  blip(freq, dur, type = 'square', vol = 0.12, when = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }
  noise(dur, vol, freq) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime, len = Math.max(1, (dur * this.ctx.sampleRate) | 0);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(f).connect(g).connect(this.master); src.start(t);
  }
  shot() { this.noise(0.14, 0.5, 2600); this.blip(160, 0.08, 'square', 0.2); }
  enemyShot() { this.noise(0.11, 0.25, 2000); }
  thud(strength = 1) { this.noise(0.16, 0.3 * strength, 300); this.blip(70, 0.14, 'sine', 0.3 * strength); }
  horn() { this.blip(370, 0.28, 'square', 0.1); this.blip(466, 0.28, 'square', 0.08); }
  success() { [523, 659, 784, 1046].forEach((f, i) => this.blip(f, 0.22, 'triangle', 0.14, i * 0.11)); }
  fail() { [392, 330, 262, 196].forEach((f, i) => this.blip(f, 0.26, 'triangle', 0.13, i * 0.13)); }
  cashSound() { this.blip(1320, 0.09, 'square', 0.1); this.blip(1760, 0.14, 'square', 0.1, 0.07); }
  updateMusic(dt, active) {
    if (!this.ctx || this.muted || !active) return;
    this.musicTimer -= dt;
    if (this.musicTimer <= 0) {
      this.musicTimer = 0.5;
      const bass = [55, 55, 65.4, 49][(Math.random() * 4) | 0];
      this.blip(bass, 0.42, 'sine', 0.16);
      if (Math.random() < 0.4) this.blip(bass * 4, 0.5, 'triangle', 0.03);
    }
  }
}
