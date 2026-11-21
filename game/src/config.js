// Palmshade Heat — shared constants: the city grid, the car catalogue,
// district palettes, pursuit tuning, and the two progression ladders
// (story rank by missions, respect rank by deeds). Everything numeric
// that more than one module needs lives here so the numbers cannot drift.
export const WORLD = {
  step: 26,          // metres between neighbouring road centrelines
  roadHalf: 4.2,     // half the width of a road surface
  walkHalf: 6.4,     // half the road + sidewalk band
  halfRoads: 4,      // centrelines run -4..+4 on both axes (9 x 9)
  seaZ: 118,         // the sea plane begins past this z
  blockInset: 8.2,   // building plots start this far from a centreline
};
export const CITY_EDGE = WORLD.step * WORLD.halfRoads; // 104
export function roadCentres() {
  const out = [];
  for (let i = -WORLD.halfRoads; i <= WORLD.halfRoads; i++) out.push(i * WORLD.step);
  return out;
}
// The Marina hugs the sea (high z), The Heights is the north-east glass
// quarter, and Old Town fills the middle and the west.
export function districtAt(x, z) {
  if (z > 34) return 'Marina';
  if (x > 30 && z < -22) return 'The Heights';
  return 'Old Town';
}
export const DISTRICT_PALETTES = {
  'Marina':    { wall: [0xffd9e8, 0xbfefff, 0xfff3b0, 0xc8ffd8, 0xffe0c2, 0xf3d1ff], roof: 0xe2607a, minH: 6, maxH: 16 },
  'Old Town':  { wall: [0xf2e3c6, 0xe8c39e, 0xd98d68, 0xf7ead1, 0xcbb59a, 0xe5b8a2], roof: 0x9c5a3c, minH: 5, maxH: 13 },
  'The Heights': { wall: [0x9fc6e8, 0x7fb2d9, 0xbcd9f2, 0x8fd0d8, 0xa8bce0], roof: 0x51606e, minH: 14, maxH: 30 },
};
export const CHOP_SHOPS = [
  { x: -52, z: -52, name: 'West Chop Shop' },
  { x: 78, z: 52, name: 'Marina Chop Shop' },
];
export const HOSPITAL = { x: -78, z: 78 };
export const STATION = { x: 26, z: -78 };
export const PIER = { x: 0, z: 132 };
// Twelve car models. value is the clean fence price; a chop shop pays
// value scaled by the condition the car arrives in.
export const CAR_MODELS = [
  { id: 'compact',     name: 'Pigeon Compact',    value: 400,  color: 0xe86a5e, len: 3.4, wid: 1.7, hgt: 1.25, top: 26, accel: 11 },
  { id: 'sedan',       name: 'Meridian Sedan',    value: 650,  color: 0x5e7fe8, len: 4.3, wid: 1.8, hgt: 1.3,  top: 30, accel: 12 },
  { id: 'suv',         name: 'Trailboss SUV',     value: 900,  color: 0x3f9e63, len: 4.5, wid: 2.0, hgt: 1.8,  top: 28, accel: 11 },
  { id: 'pickup',      name: 'Dune Pickup',       value: 800,  color: 0xd8a03c, len: 4.8, wid: 1.95, hgt: 1.7, top: 27, accel: 11 },
  { id: 'sports',      name: 'Vesper GT',         value: 2400, color: 0xd81f4e, len: 4.2, wid: 1.9, hgt: 1.05, top: 44, accel: 19 },
  { id: 'convertible', name: 'Solana Cabrio',     value: 1500, color: 0x2ec4c6, len: 4.1, wid: 1.85, hgt: 1.0, top: 36, accel: 15 },
  { id: 'van',         name: 'Cargo Van',         value: 700,  color: 0xd9d9d9, len: 4.9, wid: 2.0, hgt: 2.1,  top: 25, accel: 9 },
  { id: 'truck',       name: 'Hauler Truck',      value: 1100, color: 0x8a6fd8, len: 6.2, wid: 2.3, hgt: 2.4,  top: 24, accel: 8 },
  { id: 'taxi',        name: 'Palm Cab',          value: 600,  color: 0xffc21f, len: 4.3, wid: 1.8, hgt: 1.45, top: 29, accel: 12 },
  { id: 'police',      name: 'Palmshade Cruiser', value: 0,    color: 0xf2f2f2, len: 4.5, wid: 1.9, hgt: 1.5,  top: 40, accel: 17 },
  { id: 'limo',        name: 'Regent Limo',       value: 1900, color: 0x22242c, len: 6.4, wid: 1.95, hgt: 1.4, top: 30, accel: 10 },
  { id: 'golden',      name: 'Aurum One',         value: 6000, color: 0xffc400, len: 4.4, wid: 1.95, hgt: 1.1, top: 46, accel: 20 },
];
export const MODEL_BY_ID = Object.fromEntries(CAR_MODELS.map((m) => [m.id, m]));
export const TRAFFIC_MODELS = ['compact', 'sedan', 'suv', 'pickup', 'convertible', 'van', 'truck', 'taxi', 'limo'];
export const TUNING = {
  maxCars: 18, maxPeds: 40, maxPolice: 6,
  playerSpeed: 5.2, runSpeed: 8.6, playerHealth: 100,
  bustRadius: 3.2, bustTime: 2.2,
  decayDelay: 7,       // seconds hidden before stars start to fall
  decayStep: 6,        // seconds of hiding per star removed
};
// Story rank: a title per completed mission, kept for mission banners.
export const RANKS = ['Nobody', 'Runner', 'Wheelman', 'Fence Friend', 'Shot Caller', 'Palmshade Legend'];
export function rankFor(completed) { return RANKS[Math.min(RANKS.length - 1, completed)]; }
// Respect: points earned only from real deeds (missions, fences, clean
// escapes, near misses, crew assists), and the title ladder they climb.
export const RESPECT_LADDER = [
  [0, 'Nobody'], [120, 'Runner'], [300, 'Wheelman'],
  [550, 'Fence Friend'], [850, 'Shot Caller'], [1200, 'Palmshade Legend'],
];
export function respectRank(points) {
  let title = RESPECT_LADDER[0][1];
  for (const [at, name] of RESPECT_LADDER) if (points >= at) title = name;
  return title;
}
// District standing bands, 0..100: how a neighbourhood feels about Rio.
export function standingBand(v) {
  return v < 25 ? 'HOSTILE' : v < 45 ? 'WARY' : v <= 60 ? 'NEUTRAL' : v <= 80 ? 'FRIENDLY' : 'ALLIED';
}
