// HUD: DOM readouts (stars, cash, health, objective, prompts) + canvas minimap.
import { CHOP_SHOPS, districtAt } from './config.js';
import { dist2d } from './random.js';

const $ = (id) => document.getElementById(id);
export class Hud {
  constructor(G) {
    this.G = G;
    this.els = {
      hud: $('hud'), stars: $('stars'), cash: $('cash'), rank: $('rank'), district: $('district'),
      objective: $('objective'), health: $('healthbar'), vehicle: $('vehicleinfo'), carname: $('carname'),
      speedo: $('speedo'), prompt: $('prompt'), timer: $('timer'), banner: $('banner'),
      crosshair: $('crosshair'), muzzle: $('muzzle'), minimap: $('minimap'),
    };
    this.bannerT = 0; this.lastDistrict = ''; this.objective = null; this.objectiveText = '';
    this.mm = this.els.minimap.getContext('2d');
  }
  show() { this.els.hud.classList.remove('hidden'); }
  hide() { this.els.hud.classList.add('hidden'); }
  setObjective(text, marker, keepText = false) {
    if (text !== null && text !== undefined) this.objectiveText = text;
    if (marker !== undefined) this.objective = marker;
    if (this.G) {
      this.G.objectiveColumn.visible = !!this.objective;
      this.G.objectiveRing.visible = !!this.objective;
      if (this.objective) {
        this.G.objectiveColumn.position.x = this.objective.x;
        this.G.objectiveColumn.position.z = this.objective.z;
        this.G.objectiveRing.position.x = this.objective.x;
        this.G.objectiveRing.position.z = this.objective.z;
      }
    }
  }
  banner(title, sub, secs = 4) {
    this.els.banner.textContent = sub ? `${title}\n${sub}` : title;
    this.els.banner.classList.remove('hidden');
    this.bannerT = secs;
  }
  hitmarker() { this.els.crosshair.style.color = '#ff5544'; setTimeout(() => { this.els.crosshair.style.color = '#fff'; }, 90); }
  flashMuzzle() { this.els.muzzle.style.opacity = 1; setTimeout(() => { this.els.muzzle.style.opacity = 0; }, 45); }
  setTimer(sec) {
    if (sec < 0) { this.els.timer.textContent = ''; return; }
    const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    this.els.timer.textContent = `${m}:${String(s).padStart(2, '0')}`;
    this.els.timer.style.color = sec < 20 ? '#ff5544' : '#ffd23f';
  }
  showVehicle(car) {
    this.els.vehicle.classList.remove('hidden');
    this.els.carname.textContent = car.model.name + (car.health < 35 ? ' — smoking!' : '');
  }
  hideVehicle() { this.els.vehicle.classList.add('hidden'); }
  update(dt) {
    const G = this.G, P = G.player;
    if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) this.els.banner.classList.add('hidden'); }
    // Wanted stars.
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < G.wanted ? '★' : '<span class="off">★</span>';
    this.els.stars.innerHTML = stars;
    this.els.stars.classList.toggle('blink', !!G.wantedBlinking && G.wanted > 0);
    this.els.cash.textContent = '$' + Math.round(G.cash).toLocaleString('en-US');
    this.els.rank.textContent = 'Rank: ' + G.rankName();
    this.els.health.style.width = Math.max(0, P.health) + '%';
    this.els.health.style.background = P.health < 30 ? '#e33' : 'linear-gradient(90deg,#e33,#f66)';
    const dist = districtAt(P.x, P.z);
    if (dist !== this.lastDistrict) { this.lastDistrict = dist; this.els.district.textContent = dist; }
    // Objective text + distance.
    let obj = this.objectiveText;
    if (this.objective) {
      const d = Math.round(dist2d(P.x, P.z, this.objective.x, this.objective.z));
      obj = obj ? `${obj} (${d}m)` : `${d}m`;
      G.objectiveRing.rotation.z += dt * 1.5;
    }
    if (this.els.objective.textContent !== obj) this.els.objective.textContent = obj;
    // Vehicle readouts.
    if (P.car) {
      this.els.speedo.textContent = Math.round(Math.abs(P.car.speed) * 3.6);
      if ((this.frame = (this.frame || 0) + 1) % 20 === 0) this.showVehicle(P.car);
    }
    this.els.crosshair.classList.toggle('hidden', !!P.car);
    // Interaction prompt.
    let prompt = '';
    if (!P.car && G.nearCar) prompt = G.nearCar.model.id === 'police' ? 'E — steal the cruiser (bad idea)' : `E — steal the ${G.nearCar.model.name}`;
    else if (P.car && Math.abs(P.car.speed) < 4) prompt = 'E — get out';
    if (G.bustT > 0.2) prompt = '⚠ THE HEAT IS GRABBING YOU — MOVE!';
    if (prompt) { this.els.prompt.textContent = prompt; this.els.prompt.classList.remove('hidden'); }
    else this.els.prompt.classList.add('hidden');
    // The minimap is a full 2D-canvas redraw; every second frame is plenty
    // for a navigation aid and halves that cost.
    this.mmTick = (this.mmTick || 0) + 1;
    if (this.mmTick % 2 === 0) this.drawMinimap();
  }
  drawMinimap() {
    const ctx = this.mm, G = this.G, P = G.player;
    const S = 180, scale = S / 280; // whole city + sea in frame
    const px = (x) => S / 2 + x * scale, pz = (z) => S / 2 + z * scale;
    ctx.fillStyle = '#d9b380'; ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = '#2e9db8'; ctx.fillRect(0, pz(118), S, S - pz(118));
    ctx.fillStyle = '#ffd9e8'; ctx.fillRect(0, pz(34), S, pz(118) - pz(34));
    ctx.fillStyle = '#bcd9f2'; ctx.fillRect(px(30), 0, S - px(30), pz(-22));
    ctx.fillStyle = '#3d3a40';
    for (let i = -4; i <= 4; i++) {
      ctx.fillRect(px(i * 26) - 2, 0, 4, S);
      ctx.fillRect(0, pz(i * 26) - 2, S, 4);
    }
    const blip = (x, z, color, r = 3) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(px(x), pz(z), r, 0, 6.29); ctx.fill(); };
    for (const shop of CHOP_SHOPS) blip(shop.x, shop.z + 7, '#ffb020', 4);
    if (this.objective) blip(this.objective.x, this.objective.z, '#ffd23f', 4.5);
    for (const car of G.cars) if (car.model.id === 'police') blip(car.mesh.position.x, car.mesh.position.z, '#3a6fd8', 3);
    // Player arrow.
    ctx.save();
    ctx.translate(px(P.x), pz(P.z)); ctx.rotate(-(P.car ? P.car.angle : P.angle) + Math.PI);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4, 5); ctx.lineTo(-4, 5); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}
