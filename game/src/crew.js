// Rio's crew: three named members with active abilities on real
// cooldowns. An ability fires only when its conditions hold; a refused
// call explains itself on the small event banner and starts no cooldown.
// Every successful assist is counted in the career stats and pays a
// little respect — the crew is a system, not a portrait row.
import { setWanted } from './police.js';

export const CREW = [
  { id: 'plates', name: 'SWAP PLATES', member: 'Nia Ferrer', role: 'Driver', key: 'Z', cd: 90, color: '#ffb020' },
  { id: 'fix', name: 'QUICK FIX', member: 'Bo Castellano', role: 'Mechanic', key: 'X', cd: 60, color: '#2ec4c6' },
  { id: 'eyes', name: 'EYES OUT', member: 'Juno Reyes', role: 'Lookout', key: 'C', cd: 75, color: '#b388ff' },
];
export const CREW_BY_ID = Object.fromEntries(CREW.map((c) => [c.id, c]));

export function initCrew(G) {
  G.crew = { cds: { plates: 0, fix: 0, eyes: 0 }, eyesUntil: 0 };
}
export function crewReadyIn(G, id) {
  return Math.max(0, (G.crew.cds[id] || 0) - G.time);
}
function deny(G, def, why) {
  G.hud.showEvent(def.name, why);
}
export function useCrew(G, id) {
  const def = CREW_BY_ID[id];
  if (!def || G.state !== 'playing') return false;
  if (crewReadyIn(G, id) > 0) { deny(G, def, `${def.member} needs ${Math.ceil(crewReadyIn(G, id))}s more.`); return false; }
  const P = G.player;
  if (id === 'plates') {
    if (!P.car) { deny(G, def, 'Nia needs Rio behind a wheel.'); return false; }
    if (G.wanted <= 0) { deny(G, def, 'No heat to cool — plates stay on.'); return false; }
    setWanted(G, G.wanted - 1);
    G.hud.showEvent('SWAP PLATES', 'Fresh plates — one star gone.');
  } else if (id === 'fix') {
    if (!P.car) { deny(G, def, 'Bo needs a car under Rio first.'); return false; }
    if (P.car.health >= 100) { deny(G, def, 'This ride is already whole.'); return false; }
    P.car.health = Math.min(100, P.car.health + 45);
    G.hud.showEvent('QUICK FIX', `${P.car.model.name} patched to ${Math.round(P.car.health)}%.`);
  } else if (id === 'eyes') {
    G.crew.eyesUntil = G.time + 20;
    G.hud.showEvent('EYES OUT', 'Juno is watching the cruisers — 20s.');
  }
  G.crew.cds[id] = G.time + def.cd;
  G.stats.crewUsed++;
  G.respect += 5;
  G.audio.blip(660, 0.1, 'triangle', 0.1);
  return true;
}
