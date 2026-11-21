'use strict';

var HUD = {
  el: {}, mm: null, evUntil: 0, toastUntil: 0, flashUntil: 0, _t: 0,
  init: function () {
    var ids = ['districtLbl', 'standingLbl', 'standingFill', 'missionPanel', 'msnHead', 'msnPips', 'msnStage', 'msnObj', 'msnNext', 'dispatchPanel', 'dspHead', 'dspRows', 'dspIncident', 'vehiclePanel', 'vehName', 'vehCondFill', 'vehSpeed', 'vehGear', 'vehFlat', 'nitroFill', 'rankLbl', 'storyLbl', 'storyFill', 'clockLbl', 'moneyLbl', 'starsLbl', 'sightChip', 'crewPanel', 'racePanel', 'radioTxt', 'eventBanner', 'evTitle', 'evSub', 'toast', 'toastTitle', 'toastSub', 'fencePanel', 'fenceTxt', 'dialogBox', 'dlgPortrait', 'dlgName', 'dlgLine', 'shopPanel', 'shopTxt', 'garagePanel', 'garageTxt', 'pausePanel', 'pauseTxt', 'promptLbl', 'armourFill', 'healthFill', 'crosshair', 'mmap'];
    for (var i = 0; i < ids.length; i++) this.el[ids[i]] = document.getElementById(ids[i]);
    this.mm = this.el.mmap.getContext('2d');
  },
  showEvent: function (title, sub) {
    this.el.evTitle.textContent = title; this.el.evSub.textContent = sub || '';
    this.el.eventBanner.style.display = 'block'; this.evUntil = G.time + 3.5;
    G.lastEvent = title;
  },
  showToast: function (title, sub) {
    this.el.toastTitle.textContent = title; this.el.toastSub.textContent = sub || '';
    this.el.toast.style.display = 'block'; this.toastUntil = G.time + 1.6;
    G.lastToast = title;
  },
  flashSpeedo: function () { this.flashUntil = G.time + 1.5; },
  update: function (dt) {
    this._t -= dt;
    this.drawMinimap();
    if (this._t > 0) return;
    this._t = 0.12;
    var e = this.el, pp = PLAYER.pos();
    if (this.evUntil < G.time) e.eventBanner.style.display = 'none';
    if (this.toastUntil < G.time) e.toast.style.display = 'none';
    var dn = districtAt(pp.x, pp.z), st = G.standing[dn];
    e.districtLbl.textContent = dn.toUpperCase();
    e.standingLbl.textContent = standingBand(st) + ' · ' + st;
    e.standingFill.style.width = st + '%';
    e.moneyLbl.textContent = fmtMoney(G.money);
    var w = effWanted(), stars = '';
    for (var i = 0; i < 5; i++) stars += i < w ? '★' : '☆';
    e.starsLbl.textContent = stars;
    e.rankLbl.textContent = respectTitle(G.respect).toUpperCase() + ' · ' + G.respect + ' RESPECT';
    e.storyLbl.textContent = 'STORY ' + G.storyDone + '/8 · ' + Math.round(G.storyDone / 8 * 100) + '%';
    e.storyFill.style.width = (G.storyDone / 8 * 100) + '%';
    var ps = Math.floor(G.playSeconds);
    e.clockLbl.textContent = Math.floor(ps / 60) + ':' + ('0' + (ps % 60)).slice(-2);
    var si = AUDIO.stationInfo();
    e.radioTxt.textContent = si.name + ' · ' + si.genre + ' · "' + si.track + '"' + (AUDIO.muted ? ' · MUTED' : '') + '  [R]';

    var flow = MSN.flow(), dlg = G.dialogOverride;
    if (flow) {
      e.missionPanel.style.display = 'block';
      e.msnHead.textContent = 'M' + flow.num + '/' + flow.total + ' · ' + flow.name.toUpperCase() + ' · ' + fmtMoney(flow.reward);
      var pips = '';
      for (i = 0; i < flow.stages; i++) pips += '<span class="pip ' + (i < flow.stage ? 'done' : i === flow.stage ? 'cur' : '') + '">●</span>';
      e.msnPips.innerHTML = pips;
      e.msnStage.textContent = 'Stage ' + (flow.stage + 1) + ' of ' + flow.stages + (flow.timer !== null && flow.timer !== undefined ? ' · ⏱ ' + Math.ceil(flow.timer) + 's' : '') + (MSN.holdT > 0 ? ' · HOLD ' + Math.floor(MSN.holdT) + 's' : '');
      e.msnObj.textContent = flow.obj;
      e.msnNext.textContent = 'NEXT: ' + flow.next;
    } else e.missionPanel.style.display = 'none';
    var gv = dlg ? dlg : (flow ? flow.giver : null), line = dlg ? dlg.line : (flow ? flow.line : '');
    if (gv) {
      e.dialogBox.style.display = 'flex';
      e.dlgPortrait.textContent = gv.name.split(' ').map(function (s) { return s[0]; }).join('');
      e.dlgPortrait.style.background = gv.color;
      e.dlgName.textContent = gv.name + ' — ' + gv.role;
      e.dlgLine.textContent = '\u201C' + line + '\u201D';
    } else e.dialogBox.style.display = 'none';

    var rows = COPS.dispatchRows();
    if (rows.length) {
      e.dispatchPanel.style.display = 'block';
      e.dspHead.textContent = 'PSPD DISPATCH · ' + rows.length + ' UNITS · ' + w + '★';
      var html = '';
      var cruisers = rows.filter(function (r) { return r.callsign !== 'AIR-1'; });
      var heliRow = rows.filter(function (r) { return r.callsign === 'AIR-1'; });
      if (heliRow.length) html += '<div class="drow"><b>AIR-1</b> SPOTLIGHT · ' + Math.round(heliRow[0].d) + 'm</div>';
      for (i = 0; i < Math.min(4, cruisers.length); i++) html += '<div class="drow"><b>' + cruisers[i].callsign + '</b> ' + cruisers[i].role + ' · ' + Math.round(cruisers[i].d) + 'm</div>';
      if (cruisers.length > 4) html += '<div class="drow dim">+' + (cruisers.length - 4) + ' MORE UNITS</div>';
      e.dspRows.innerHTML = html;
      if (G.incident && G.time < G.incident.until) { e.dspIncident.style.display = 'block'; e.dspIncident.textContent = G.incident.callsign + ': ' + G.incident.text; }
      else e.dspIncident.style.display = 'none';
    } else e.dispatchPanel.style.display = 'none';

    if (w > 0) {
      e.sightChip.style.display = 'block';
      if (G.sight.seen) { e.sightChip.textContent = 'IN SIGHT'; e.sightChip.className = 'chip seen'; }
      else {
        var pct = Math.round(clamp(G.sight.decayT / 9, 0, 1) * 100);
        e.sightChip.textContent = 'LOSING THEM · ' + pct + '%'; e.sightChip.className = 'chip losing';
      }
    } else e.sightChip.style.display = 'none';

    if (ULTRA.race) {
      e.crewPanel.style.display = 'none'; e.racePanel.style.display = 'block';
      var r = ULTRA.race;
      e.racePanel.innerHTML = '<div class="rpHead">' + r.def.name.toUpperCase() + '</div>' +
        '<div class="rpBig">POS ' + ULTRA.playerPos() + '/4</div>' +
        '<div>CHECKPOINT ' + Math.min(r.idx + 1, r.def.pts.length) + '/' + r.def.pts.length + '</div>' +
        '<div>TIME ' + r.t.toFixed(1) + 's · BET ' + fmtMoney(r.bet) + '</div>';
    } else {
      e.racePanel.style.display = 'none'; e.crewPanel.style.display = 'block';
      var ch = '';
      for (i = 0; i < 3; i++) {
        var m = CREW.members[i], lab = CREW.stateLabel(i);
        ch += '<div class="crewCard"><div class="portrait" style="background:' + m.color + '">' + m.name.split(' ').map(function (s) { return s[0]; }).join('') + '</div>' +
          '<div class="crewMid"><b>' + m.ability + '</b><span>' + m.name + ' · ' + m.role + '</span></div>' +
          '<div class="crewState ' + (lab === 'READY' ? 'ready' : '') + '">' + lab + '</div><div class="keyChip">' + m.key.replace('Key', '') + '</div></div>';
      }
      e.crewPanel.innerHTML = ch;
    }

    var car = G.playerCar;
    if (car) {
      e.vehiclePanel.style.display = 'block';
      var hp = Math.round(car.health / car.maxHp * 100);
      e.vehName.textContent = car.def.name + ' · ' + hp + '%';
      e.vehCondFill.style.width = hp + '%';
      e.vehCondFill.style.background = hp < 35 ? '#e33' : '#3c6';
      e.vehSpeed.textContent = Math.round(Math.abs(car.speed) * 3.6);
      e.vehGear.textContent = car.speed > 0.5 ? 'D' : car.speed < -0.5 ? 'R' : 'N';
      e.vehFlat.style.display = G.flatTyre ? 'block' : 'none';
      e.nitroFill.style.width = G.nitro + '%';
      e.vehiclePanel.className = this.flashUntil > G.time ? 'panel goldflash' : 'panel';
    } else e.vehiclePanel.style.display = 'none';

    for (i = 1; i <= 3; i++) {
      var slotEl = document.getElementById('slot' + i);
      var ammo = GUNS.ammo(i);
      slotEl.className = 'slot' + (i === G.slot ? ' active' : '');
      slotEl.querySelector('.wname').textContent = GUNS.defs[i].name;
      slotEl.querySelector('.wammo').textContent = ammo === Infinity ? '∞' : ammo;
      slotEl.querySelector('.wstate').textContent = GUNS.state(i);
    }
    e.armourFill.style.width = G.armour + '%';
    e.healthFill.style.width = Math.max(0, G.health) + '%';
    e.crosshair.style.display = !car && G.mode === 'play' ? 'block' : 'none';

    var showFence = false;
    if (car && car.stolen && car.kind !== 'police') {
      var nf = null, nd = 25;
      for (i = 0; i < FENCES.length; i++) { var d = dist2d(pp.x, pp.z, FENCES[i].x, FENCES[i].z); if (d < nd) { nd = d; nf = FENCES[i]; } }
      if (nf) {
        showFence = true;
        e.fenceTxt.innerHTML = '<b>' + nf.name + '</b> · ' + Math.round(nd) + 'm<br>' + car.def.name + ' · ' + Math.round(car.health / car.maxHp * 100) + '%<br>FENCE VALUE <b>' + fmtMoney(MSN.fenceValue(car)) + '</b>';
      }
    }
    e.fencePanel.style.display = showFence ? 'block' : 'none';

    if (G.shopOpen) {
      e.shopPanel.style.display = 'block';
      e.shopTxt.innerHTML = '<b>GUN VAN — ARMORY</b><br>[1] Micro SMG ' + fmtMoney(800) + (G.ownSmg ? ' · OWNED' : '') + '<br>[2] Pump Shotgun ' + fmtMoney(1200) + (G.ownShotgun ? ' · OWNED' : '') + '<br>[3] Full Refill ' + fmtMoney(150) + '<br>[4] Kevlar Vest ' + fmtMoney(300);
    } else e.shopPanel.style.display = 'none';
    if (ULTRA.inGarage()) {
      e.garagePanel.style.display = 'block';
      e.garageTxt.innerHTML = car ? '<b>RESPRAY GARAGE</b><br>[Y] Respray ' + fmtMoney(100) + ' · fixes flat tyre<br>[U] Store as favourite' :
        '<b>RESPRAY GARAGE</b>' + (G.fav ? '<br>[U] Take favourite: ' + MODELS[G.fav.key].name : '<br>No favourite stored');
    } else e.garagePanel.style.display = 'none';
    e.promptLbl.textContent = this.promptText();
    if (G.paused) this.fillPause();
  },
  promptText: function () {
    if (G.mode !== 'play' || G.paused) return '';
    var pp = PLAYER.pos();
    if (ULTRA.cashVan && !G.playerCar && (ULTRA.cashVan.dead || ULTRA.cashVan.health <= 40)) {
      if (dist2d(pp.x, pp.z, ULTRA.cashVan.mesh.position.x, ULTRA.cashVan.mesh.position.z) < 3.4) return 'E — Loot the cash van';
    }
    if (!G.playerCar) {
      var near = PLAYER.nearestCar();
      if (near) return 'E — Enter ' + near.car.def.name;
      var prop = ULTRA.propertyAt(pp.x, pp.z);
      if (prop && G.props.indexOf(prop.id) < 0) return 'B — Buy ' + prop.name + ' · ' + fmtMoney(prop.price);
      return '';
    }
    var ri = ULTRA.raceAt(pp.x, pp.z);
    if (ri >= 0 && !ULTRA.race) return 'T — Start ' + RACES[ri].name + ' · bet ' + fmtMoney(500);
    var prop2 = ULTRA.propertyAt(pp.x, pp.z);
    if (prop2 && G.props.indexOf(prop2.id) < 0) return 'B — Buy ' + prop2.name + ' · ' + fmtMoney(prop2.price);
    return '';
  },
  fillPause: function () {
    var s = G.stats, rows = [
      ['Story', G.storyDone + '/8 missions'], ['Respect', G.respect + ' · ' + respectTitle(G.respect)],
      ['Cars stolen', s.stolen], ['Cars sold to fences', s.sold], ['Distance driven', s.distKm.toFixed(1) + ' km'],
      ['Top speed', s.topKmh + ' km/h'], ['Police escapes', s.escapes], ['Shots fired', s.shots],
      ['Near misses', s.nearMiss], ['Stunt jumps', s.stunts], ['Races won', s.racesWon],
      ['Crew assists', s.crew], ['Total earned', fmtMoney(s.earned)], ['Properties', G.props.length + '/3']
    ];
    var h = '<div class="ppHead">PAUSED — ' + completionPct() + '% COMPLETE</div>';
    for (var i = 0; i < rows.length; i++) h += '<div class="ppRow"><span>' + rows[i][0] + '</span><b>' + rows[i][1] + '</b></div>';
    h += '<div class="ppSub">DISTRICT STANDING</div>';
    for (i = 0; i < DISTRICTS.length; i++) h += '<div class="ppRow"><span>' + DISTRICTS[i] + '</span><b>' + standingBand(G.standing[DISTRICTS[i]]) + ' · ' + G.standing[DISTRICTS[i]] + '</b></div>';
    h += '<div class="ppSub">CREW</div>';
    for (i = 0; i < 3; i++) h += '<div class="ppRow"><span>' + CREW.members[i].ability + '</span><b>' + CREW.stateLabel(i) + '</b></div>';
    this.el.pauseTxt.innerHTML = h;
  },
  drawMinimap: function () {
    var ctx = this.mm; if (!ctx) return;
    var pp = PLAYER.pos(), S = 0.62, C = 75;
    ctx.clearRect(0, 0, 150, 150);
    ctx.save();
    ctx.beginPath(); ctx.arc(C, C, 73, 0, 6.29); ctx.clip();
    ctx.fillStyle = '#20262e'; ctx.fillRect(0, 0, 150, 150);
    ctx.fillStyle = '#274b63'; ctx.fillRect(0, C + (40 - pp.z) * S, 150, 200);
    ctx.fillStyle = '#3d4454'; ctx.fillRect(C + (34 - pp.x) * S, 0, 200, C + (40 - pp.z) * S);
    ctx.strokeStyle = '#4a5058'; ctx.lineWidth = ROAD_W * S;
    ctx.beginPath();
    for (var i = 0; i < ROADS.length; i++) {
      ctx.moveTo(C + (ROADS[i] - pp.x) * S, 0); ctx.lineTo(C + (ROADS[i] - pp.x) * S, 150);
      ctx.moveTo(0, C + (ROADS[i] - pp.z) * S); ctx.lineTo(150, C + (ROADS[i] - pp.z) * S);
    }
    ctx.stroke();
    function blip(x, z, color, r) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(C + (x - pp.x) * S, C + (z - pp.z) * S, r, 0, 6.29); ctx.fill(); }
    for (i = 0; i < FENCES.length; i++) blip(FENCES[i].x, FENCES[i].z, '#ff9f43', 3);
    blip(GUNVAN.x, GUNVAN.z, '#ffc93c', 3);
    var mp = MSN.markerPos(); if (mp) blip(mp.x, mp.z, '#ffd700', 3.6);
    if (ULTRA.race) { var cp = ULTRA.race.def.pts[ULTRA.race.idx]; if (cp) blip(cp[0], cp[1], '#22d3ee', 3.6); }
    if (effWanted() > 0) {
      ctx.strokeStyle = 'rgba(255,80,80,0.8)'; ctx.lineWidth = 1.4; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.arc(C, C, 55 * S, 0, 6.29); ctx.stroke(); ctx.setLineDash([]);
    }
    var eyes = G.time < G.eyesOutUntil;
    for (i = 0; i < COPS.units.length; i++) {
      var u = COPS.units[i]; if (u.dead) continue;
      var ux = u.mesh.position.x, uz = u.mesh.position.z;
      if (COPS.roadblock && COPS.roadblock.car === u) {
        var bx = C + (ux - pp.x) * S, bz = C + (uz - pp.z) * S;
        ctx.fillStyle = '#ff9f43'; ctx.fillRect(bx - 3.4, bz - 3.4, 6.8, 6.8);
        ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(bx - 2.6, bz - 2.6); ctx.lineTo(bx + 2.6, bz + 2.6);
        ctx.moveTo(bx + 2.6, bz - 2.6); ctx.lineTo(bx - 2.6, bz + 2.6);
        ctx.stroke();
      } else {
        blip(ux, uz, '#3d7bff', 2.8);
        if (eyes) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(C + (ux - pp.x) * S, C + (uz - pp.z) * S, 5.4, 0, 6.29); ctx.stroke(); }
      }
    }
    if (COPS.swat && !COPS.swat.dead) blip(COPS.swat.mesh.position.x, COPS.swat.mesh.position.z, '#b04dff', 3.2);
    if (COPS.heli && COPS.heli.active) {
      var hx = COPS.heli.grp.position.x, hz = COPS.heli.grp.position.z;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(C + (hx - pp.x) * S, C + (hz - pp.z) * S, 4, 0, 6.29); ctx.stroke();
      blip(hx, hz, '#3d7bff', 1.8);
    }

    ctx.translate(C, C); ctx.rotate(Math.PI - PLAYER.heading);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4, 5); ctx.lineTo(-4, 5); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
};
