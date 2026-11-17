// localStorage save: cash, story progress, completed mission count.
const KEY = 'palmshade-heat-save-v1';
export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (typeof d.cash !== 'number' || typeof d.mission !== 'number') return null;
    return { cash: d.cash, mission: d.mission, completed: d.completed | 0 };
  } catch { return null; }
}
export function writeSave(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ cash: Math.round(state.cash), mission: state.missionIndex, completed: state.completed }));
  } catch { /* storage unavailable: play on without saving */ }
}
export function clearSave() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
export function hasSave() { return loadSave() !== null; }
