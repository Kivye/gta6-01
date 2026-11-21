// The HUD: every readout is a live window onto game state — wanted
// stars, cash, respect rank, story progress and the play clock, the
// mission panel with its stage pips and NEXT line, the PSPD dispatch
// panel with named units, roles, distances and the latest incident, the
// sight chip, crew cards, the fence quote panel, the giver's dialogue
// box, the weapon strip, armour and health bars, the pause career-stats
// panel, and the round canvas minimap with real roads, the 55 m search
// ring and the roadblock barricade marker. Nothing here invents a
// number: each figure is read from the state that owns it.
import { CHOP_SHOPS, TUNING, districtAt, roadCentres, standingBand, respectRank } from './config.js';
import { clamp, dist2d } from './random.js';
import { fenceValue } from './missions.js';
import { policeCars, ensureCallsign } from './police.js';
import { CREW, crewReadyIn } from './crew.js';

const $ = (id) => document.getElementById(id);
const initials = (name) => name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

export class Hud {
  constructor(G) {
    this.G = G;
    this.els = {
      hud: $('hud'), stars: $('stars'), cash: $('cash'), rank: $('rank'),
      storyline: $('storyline'), progressbar: $('progressbar'), playclock: $('playclock'),
      district: $('district'), standing: $('standing'),
      missionpanel: $('missionpanel'), missionhead: $('missionhead'), missionpips: $('missionpips'),
      missionobj: $('missionobj'), missionnext: $('missionnext'),
      dispatchpanel: $('dispatchpanel'), dispatchhead: $('dispatchhead'), dispatchrows: $('dispatchrows'),
      dispatchincident: $('dispatchincident'),
      radiobar: $('radiobar'), eventbanner: $('eventbanner'), nmtoast: $('nmtoast'), sightchip: $('sightchip'),
      crewpanel: $('crewpanel'), fencepanel: $('fencepanel'),
      dialogbox: $('dialogbox'), dialogportrait: $('dialogportrait'), dialogname: $('dialogname'), dialogline: $('dialogline'),
      health: $('healthbar'), armourbar: $('armourbar'),
      vehicle: $('vehicleinfo'), carname: $('carname'), condbar: $('condbar'), speedo: $('speedo'), gear: $('gear'),
      wslot1: $('wslot1'), prompt: $('prompt'), timer: $('timer'), banner: $('banner'),
      crosshair: $('crosshair'), muzzle: $('muzzle'), minimap: $('minimap'), statspanel: $('statspanel'),
    };
    this.bannerT = 0; this.eventT = 0; this.nmT = 0;
    this.lastDistrict = ''; this.objective = null; this.objectiveText = '';
    this.mm = this.els.minimap.getContext('2d');
    this.rbMark = false;
    // Crew cards are static shells; update() fills their state words.
    this.crewEls = CREW.map((def) => {
      const card = document.createElement('div');
      card.className = 'crewcard';
      card.innerHTML = `<div class="portrait" style="background:${def.color}">${initials(def.member)}</div>` +
        `<div class="crewbody"><div class="crewname">${def.name}</div>` +
        `<div class="crewmember">${def.member} · ${def.role}</div></div>` +
        `<div class="crewstate"></div><div class="crewkey">${def.key}</div>`;
      this.els.crewpanel.appendChild(card);
      return { def, state: card.querySelector('.crewstate') };
    });
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
  // The small event banner under the radio bar: short factual flashes
  // (a theft, the heli arriving, a crew assist) for about 3.5 seconds.
  showEvent(title, sub = '') {
    this.els.eventbanner.textContent = sub ? `${title}\n${sub}` : title;
    this.els.eventbanner.classList.remove('hidden');
    this.eventT = 3.5;
  }
  nearMissToast(chain) {
    this.els.nmtoast.textContent = `NEAR MISS${chain > 1 ? ` ×${chain}` : ''} · +10 RESPECT`;
    this.els.nmtoast.classList.remove('hidden');
    this.els.vehicle.classList.add('flash');
    this.nmT = 1.6;
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
  showStats(G) {
    const st = G.stats, pct = G.completionPct();
    const rows = [
      ['Story missions', `${G.completed} / 5`], ['Cars stolen', `${st.stolen}`], ['Cars fenced', `${st.fenced}`],
      ['Distance driven', `${st.distKm.toFixed(1)} km`], ['Top speed', `${Math.round(st.topSpeed)} km/h`],
      ['Cops escaped', `${st.escapes}`], ['Shots fired', `${st.shots}`], ['Crew assists', `${st.crewUsed}`],
      ['Cash earned', `$${Math.round(st.earned).toLocaleString('en-US')}`],
      ['Near misses', `${st.nearMiss || 0}`], ['Respect', `${G.respect || 0} · ${respectRank(G.respect || 0)}`],
    ];
    const stand = Object.entries(G.standing).map(([d, v]) =>
      `<div class="statrow"><span>${d}</span><b>${standingBand(v)} · ${Math.round(v)}</b></div>`).join('');
    const crew = CREW.map((def) => {
      const cd = crewReadyIn(G, def.id);
      const state = def.id === 'eyes' && G.time < G.crew.eyesUntil ? 'ACTIVE' : cd > 0 ? `${Math.ceil(cd)}s` : 'READY';
      return `<div class="statrow"><span>${def.name} — ${def.member}</span><b>${state}</b></div>`;
    }).join('');
    this.els.statspanel.innerHTML = `<div class="statshead">PAUSED · CAREER · ${pct.toFixed(1)}% COMPLETE</div>` +
      rows.map(([k, v]) => `<div class="statrow"><span>${k}</span><b>${v}</b></div>`).join('') +
      `<div class="statshead">DISTRICT STANDING</div>${stand}<div class="statshead">CREW</div>${crew}`;
    this.els.statspanel.classList.remove('hidden');
  }
  hideStats() { this.els.statspanel.classList.add('hidden'); }
  update(dt) {
    const G = this.G, P = G.player;
    if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) this.els.banner.classList.add('hidden'); }
    if (this.eventT > 0) { this.eventT -= dt; if (this.eventT <= 0) this.els.eventbanner.classList.add('hidden'); }
    if (this.nmT > 0) { this.nmT -= dt; if (this.nmT <= 0) { this.els.nmtoast.classList.add('hidden'); this.els.vehicle.classList.remove('flash'); } }
    // Wanted stars, cash, respect rank.
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < G.wanted ? '★' : '<span class="off">★</span>';
    this.els.stars.innerHTML = stars;
    this.els.stars.classList.toggle('blink', !!G.wantedBlinking && G.wanted > 0);
    this.els.cash.textContent = '$' + Math.round(G.cash).toLocaleString('en-US');
    this.els.rank.textContent = 'Respect: ' + respectRank(G.respect || 0) + ' · ' + (G.respect || 0);
    // Story progress: text, a bar that also counts the running stage,
    // and the play clock off total game time.
    const info = G.missions && G.missions.stageInfo ? G.missions.stageInfo() : null;
    this.els.storyline.textContent = `STORY ${G.completed}/5 · ${G.completed * 20}%`;
    const frac = info ? (info.stage - 1) / info.total : 0;
    this.els.progressbar.style.width = clamp((G.completed + frac) / 5 * 100, 0, 100) + '%';
    const gt = Math.floor(G.time);
    this.els.playclock.textContent = `PLAY ${Math.floor(gt / 60)}:${String(gt % 60).padStart(2, '0')}`;
    // Health and armour bars.
    this.els.health.style.width = Math.max(0, P.health) + '%';
    this.els.health.style.background = P.health < 30 ? '#e33' : 'linear-gradient(90deg,#e33,#f66)';
    this.els.armourbar.style.width = clamp(P.armour || 0, 0, 100) + '%';
    // District name and its standing line.
    const dist = districtAt(P.x, P.z);
    if (dist !== this.lastDistrict) { this.lastDistrict = dist; this.els.district.textContent = dist; }
    const sv = G.standing[dist];
    this.els.standing.innerHTML = `${standingBand(sv)} · ${Math.round(sv)} <span class="standbar"><i style="width:${sv}%"></i></span>`;
    this.updateMissionPanel(info);
    this.updateDispatch();
    this.updateSightChip();
    this.updateCrewCards();
    this.updateFencePanel();
    this.updateDialog(info);
    // Radio bar: the tuned station, its genre and its one looping track.
    const st = G.audio.station;
    this.els.radiobar.textContent = st ? `♪ ${st.name} · ${st.genre} — "${st.track}"${G.audio.muted ? ' · MUTED' : ''} · R to change` : '';
    // Vehicle readouts: condition bar + percent, speed, gear from the
    // sign of the speed.
    if (P.car) {
      this.els.speedo.textContent = Math.round(Math.abs(P.car.speed) * 3.6);
      this.els.condbar.style.width = clamp(P.car.health, 0, 100) + '%';
      this.els.condbar.style.background = P.car.health < 35 ? '#e33' : '#7dff8a';
      this.els.gear.textContent = 'GEAR ' + (P.car.speed > 0.5 ? 'D' : P.car.speed < -0.5 ? 'R' : 'N');
      if ((this.frame = (this.frame || 0) + 1) % 20 === 0) this.showVehicle(P.car);
    }
    this.els.crosshair.classList.toggle('hidden', !!P.car);
    // Weapon strip: the one honest pistol, two honestly empty slots.
    const wstate = P.car ? 'HOLSTERED' : G.fireCd > 0 ? 'CYCLING' : 'READY';
    this.els.wslot1.textContent = `1 · PISTOL · ∞ · ${wstate}`;
    // Interaction prompt.
    let prompt = '';
    if (!P.car && G.nearCar) prompt = G.nearCar.model.id === 'police' ? 'E — steal the cruiser (bad idea)' : `E — steal the ${G.nearCar.model.name}`;
    else if (P.car && Math.abs(P.car.speed) < 4) prompt = 'E — get out';
    if (G.bustT > 0.2) prompt = '⚠ THE HEAT IS GRABBING YOU — MOVE!';
    if (prompt) { this.els.prompt.textContent = prompt; this.els.prompt.classList.remove('hidden'); }
    else this.els.prompt.classList.add('hidden');
    // The minimap is a full canvas redraw; every second frame is plenty.
    this.mmTick = (this.mmTick || 0) + 1;
    if (this.mmTick % 2 === 0) this.drawMinimap();
  }
  updateMissionPanel(info) {
    const G = this.G;
    if (!info && !this.objectiveText) { this.els.missionpanel.classList.add('hidden'); return; }
    this.els.missionpanel.classList.remove('hidden');
    if (!info) {
      this.els.missionhead.textContent = 'FREE ROAM';
      this.els.missionpips.textContent = '';
      this.els.missionnext.textContent = '';
    } else {
      this.els.missionhead.textContent = `MISSION ${info.num}/${info.of} — ${info.name.toUpperCase()} · $${info.reward}`;
      let pips = '';
      for (let i = 0; i < info.total; i++) pips += i < info.stage - 1 ? '●' : i === info.stage - 1 ? '◉' : '<span class="off">○</span>';
      this.els.missionpips.innerHTML = `${pips}  STAGE ${info.stage}/${info.total}`;
      this.els.missionnext.textContent = info.next ? `NEXT: ${info.next}` : 'FINAL STAGE — finish it to complete the mission.';
    }
    let obj = this.objectiveText;
    if (this.objective) {
      const d = Math.round(dist2d(this.G.player.x, this.G.player.z, this.objective.x, this.objective.z));
      obj = obj ? `${obj} (${d}m)` : `${d}m`;
      this.G.objectiveRing.rotation.z += 0.016;
    }
    if (this.els.missionobj.textContent !== obj) this.els.missionobj.textContent = obj;
  }
  updateDispatch() {
    const G = this.G, P = G.player;
    const cops = policeCars(G);
    if (!cops.length && !G.heli) { this.els.dispatchpanel.classList.add('hidden'); return; }
    this.els.dispatchpanel.classList.remove('hidden');
    const total = cops.length + (G.heli ? 1 : 0);
    this.els.dispatchhead.textContent = `PSPD DISPATCH · ${total} UNIT${total === 1 ? '' : 'S'} · WANTED ${G.wanted}★`;
    const rows = [];
    if (G.heli) rows.push(`<div class="drow"><b>AIR-1</b><span>SPOTLIGHT</span><i>${Math.round(dist2d(P.x, P.z, G.heli.group.position.x, G.heli.group.position.z))} m</i></div>`);
    const sorted = [...cops].sort((a, b) =>
      dist2d(P.x, P.z, a.mesh.position.x, a.mesh.position.z) - dist2d(P.x, P.z, b.mesh.position.x, b.mesh.position.z));
    for (const car of sorted.slice(0, 4)) {
      const d = dist2d(P.x, P.z, car.mesh.position.x, car.mesh.position.z);
      const role = car.roadblock ? 'ROADBLOCK' : (P.car && d < 16 ? 'RAMMING' : d > 55 ? 'RESPONDING' : 'PURSUIT');
      rows.push(`<div class="drow"><b>${ensureCallsign(G, car)}</b><span>${role}</span><i>${Math.round(d)} m</i></div>`);
    }
    if (sorted.length > 4) rows.push(`<div class="drow more">+${sorted.length - 4} more unit${sorted.length - 4 === 1 ? '' : 's'}</div>`);
    this.els.dispatchrows.innerHTML = rows.join('');
    const inc = G.incident;
    this.els.dispatchincident.textContent = inc && G.time - inc.t < 12 ? `${inc.by}: ${inc.text}` : '';
  }
  updateSightChip() {
    const G = this.G;
    if (G.wanted <= 0) { this.els.sightchip.classList.add('hidden'); return; }
    this.els.sightchip.classList.remove('hidden');
    if (G.sightSeen) {
      this.els.sightchip.textContent = 'IN SIGHT';
      this.els.sightchip.className = 'seen';
    } else {
      const pct = Math.round(clamp((Math.min(G.hiddenT, TUNING.decayDelay) + G.decayT) / (TUNING.decayDelay + TUNING.decayStep), 0, 1) * 100);
      this.els.sightchip.textContent = `LOSING THEM · ${pct}%`;
      this.els.sightchip.className = 'losing';
    }
  }
  updateCrewCards() {
    const G = this.G;
    for (const { def, state } of this.crewEls) {
      if (def.id === 'eyes' && G.time < G.crew.eyesUntil) state.textContent = `ACTIVE ${Math.ceil(G.crew.eyesUntil - G.time)}s`;
      else {
        const cd = crewReadyIn(G, def.id);
        state.textContent = cd > 0 ? `${Math.ceil(cd)}s` : 'READY';
      }
      state.classList.toggle('ready', state.textContent.startsWith('READY'));
    }
  }
  updateFencePanel() {
    const G = this.G, P = G.player, car = P.car;
    if (!car || !car.stolen || car.model.id === 'police') { this.els.fencepanel.classList.add('hidden'); return; }
    let shop = null, bd = 25;
    for (const s of CHOP_SHOPS) {
      const d = dist2d(car.mesh.position.x, car.mesh.position.z, s.x, s.z + 7);
      if (d < bd) { bd = d; shop = s; }
    }
    if (!shop) { this.els.fencepanel.classList.add('hidden'); return; }
    this.els.fencepanel.classList.remove('hidden');
    this.els.fencepanel.innerHTML =
      `<div class="fencehead">🚪 ${shop.name} · ${Math.round(bd)} m</div>` +
      `<div>${car.model.name} · ${Math.round(clamp(car.health, 0, 100))}% condition</div>` +
      `<div class="fencevalue">FENCE VALUE $${fenceValue(car).toLocaleString('en-US')}</div>`;
  }
  updateDialog(info) {
    if (!info) { this.els.dialogbox.classList.add('hidden'); return; }
    this.els.dialogbox.classList.remove('hidden');
    const g = info.giver;
    this.els.dialogportrait.textContent = initials(g.name);
    this.els.dialogportrait.style.background = g.color;
    this.els.dialogname.textContent = `${g.name.toUpperCase()} · ${g.role}`;
    this.els.dialogline.textContent = `"${info.line}"`;
  }
  drawMinimap() {
    const ctx = this.mm, G = this.G, P = G.player;
    const S = 180, scale = S / 280; // the whole city plus the sea in frame
    const px = (x) => S / 2 + x * scale, pz = (z) => S / 2 + z * scale;
    ctx.save();
    // Round scope: clip everything to the disc, like a real GPS unit.
    ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - 2, 0, 6.29); ctx.clip();
    ctx.fillStyle = '#d9b380'; ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = '#2e9db8'; ctx.fillRect(0, pz(118), S, S - pz(118));
    ctx.fillStyle = '#ffd9e8'; ctx.fillRect(0, pz(34), S, pz(118) - pz(34));
    ctx.fillStyle = '#bcd9f2'; ctx.fillRect(px(30), 0, S - px(30), pz(-22));
    // Streets as they are: a line at road width on every real centreline.
    ctx.strokeStyle = '#3d3a40'; ctx.lineWidth = 4;
    for (const c of roadCentres()) {
      ctx.beginPath(); ctx.moveTo(px(c), 0); ctx.lineTo(px(c), S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, pz(c)); ctx.lineTo(S, pz(c)); ctx.stroke();
    }
    // The 55 m search ring: the same radius the police LOS check uses.
    if (G.wanted > 0) {
      ctx.strokeStyle = 'rgba(255,60,60,.85)'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.arc(px(P.x), pz(P.z), 55 * scale, 0, 6.29); ctx.stroke();
      ctx.setLineDash([]);
    }
    const blip = (x, z, color, r = 3) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(px(x), pz(z), r, 0, 6.29); ctx.fill(); };
    for (const shop of CHOP_SHOPS) blip(shop.x, shop.z + 7, '#ffb020', 4);
    if (this.objective) blip(this.objective.x, this.objective.z, '#ffd23f', 4.5);
    for (const car of G.cars) if (car.model.id === 'police') blip(car.mesh.position.x, car.mesh.position.z, '#3a6fd8', 3);
    // EYES OUT: Juno's halo rings around every cruiser blip.
    if (G.crew && G.time < G.crew.eyesUntil) {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.4;
      for (const car of G.cars) if (car.model.id === 'police') {
        ctx.beginPath(); ctx.arc(px(car.mesh.position.x), pz(car.mesh.position.z), 6.5, 0, 6.29); ctx.stroke();
      }
    }
    // Roadblock marker: an orange barricade glyph with a dark cross on
    // the unit holding the block, so it can be routed around by map.
    this.rbMark = false;
    for (const car of G.cars) if (car.roadblock) {
      this.rbMark = true;
      const bx = px(car.mesh.position.x), bz = pz(car.mesh.position.z);
      ctx.fillStyle = '#ff8c1a'; ctx.fillRect(bx - 4, bz - 4, 8, 8);
      ctx.strokeStyle = '#1a1a22'; ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(bx - 4, bz - 4); ctx.lineTo(bx + 4, bz + 4);
      ctx.moveTo(bx + 4, bz - 4); ctx.lineTo(bx - 4, bz + 4);
      ctx.stroke();
    }
    if (G.heli) {
      const hp = G.heli.group.position;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(px(hp.x), pz(hp.z), 5, 0, 6.29); ctx.stroke();
      blip(hp.x, hp.z, '#2255ff', 2.2);
    }
    // Player arrow.
    ctx.save();
    ctx.translate(px(P.x), pz(P.z)); ctx.rotate(-(P.car ? P.car.angle : P.angle) + Math.PI);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4, 5); ctx.lineTo(-4, 5); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.restore();
  }
}
