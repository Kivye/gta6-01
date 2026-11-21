// Seeded randomness (mulberry32) and the small numeric helpers every
// module shares. The seed matters: staged screenshots must come out the
// same on every run, so world generation draws from this, never from
// Math.random.
export function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function rngRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
export function rngInt(rng, lo, hi) { return Math.floor(rngRange(rng, lo, hi + 1)); }
export function rngPick(rng, arr) { return arr[Math.floor(rng() * arr.length) % arr.length]; }
export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
// Distance on the ground plane; y never matters in Palmshade.
export function dist2d(ax, az, bx, bz) { return Math.hypot(ax - bx, az - bz); }
// Shortest-path angle blend, safe across the -PI/+PI seam.
export function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
