// localStorage save: cash, story progress, respect, district standing,
// career statistics and armour. Every field is optional on load — a save
// written by an older build still loads, with the missing pieces at
// their fresh-game defaults.
const KEY = 'palmshade-heat-save-v1';
export function freshStats() {
  return { stolen: 0, fenced: 0, distKm: 0, topSpeed: 0, escapes: 0, shots: 0, earned: 0, crewUsed: 0, nearMiss: 0 };
}
export function freshStanding() { return { 'Marina': 50, 'Old Town': 50, 'The Heights': 50 }; }
export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (typeof d.cash !== 'number' || typeof d.mission !== 'number') return null;
    const standing = freshStanding();
    if (d.standing) for (const k of Object.keys(standing)) if (typeof d.standing[k] === 'number') standing[k] = d.standing[k];
    return {
      cash: d.cash, mission: d.mission, completed: d.completed | 0,
      respect: d.respect | 0, armour: typeof d.armour === 'number' ? d.armour : 0,
      standing, stats: { ...freshStats(), ...(d.stats || {}) },
    };
  } catch { return null; }
}
export function writeSave(G) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      cash: Math.round(G.cash), mission: G.missionIndex, completed: G.completed,
      respect: G.respect | 0, armour: Math.round(G.player ? G.player.armour || 0 : 0),
      standing: G.standing, stats: G.stats,
    }));
  } catch { /* storage unavailable: play on without saving */ }
}
export function clearSave() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
export function hasSave() { return loadSave() !== null; }
