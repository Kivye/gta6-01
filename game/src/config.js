'use strict';

var ROAD_W = 15, WORLD_R = 112;
var ROADS = [-78, -52, -26, 0, 26, 52, 78];
var DISTRICTS = ['Marina', 'Old Town', 'The Heights'];
function districtAt(x, z) { if (z >= 40) return 'Marina'; if (x >= 34) return 'The Heights'; return 'Old Town'; }
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function lerp(a, b, t) { return a + (b - a) * t; }
function dist2d(ax, az, bx, bz) { var dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz); }

var FENCES = [
  {name:'West Chop Shop',x:-52,z:-13 },
  {name:'Marina Chop Shop',x:30,z:86 },
  {name:'Heights Customs',x:64,z:-26 }
];
var COP_DOOR = {x:26,z:8 };
var VEST_POS = {x:18.5,z:8 };
var HOSPITAL = {x:-22,z:30 };
var GUNVAN = {x:12,z:86 };
var GARAGE = {x:6,z:45 };
var SHOWROOM = {x:70,z:44 };
var PIER_POINT = {x:-16,z:100 };
var TRANSMITTERS = [{x:44,z:-40 }, {x:66,z:-8 }, {x:58,z:34 }];
var PROPERTIES = [
  {id:'pier',name:'Pier Club',x:-44,z:92,price:4000,income:180 },
  {id:'yard',name:'Auto Yard',x:-66,z:-58,price:6500,income:260 },
  {id:'pent',name:'Penthouse',x:64,z:20,price:12000,income:420 }
];
var RAMPS = [
  {x:-70,z:78,h:0 }, {x:0,z:97,h:Math.PI }, {x:70,z:60,h:-Math.PI / 2 },
  {x:-78,z:-20,h:Math.PI / 2 }, {x:-30,z:-70,h:Math.PI }, {x:30,z:-78,h:0 },
  {x:78,z:10,h:-Math.PI / 2 }, {x:52,z:-52,h:Math.PI * 0.75 }
];
var RACES = [
  {name:'Marina Mile',district:'Marina',start:{x:0,z:78,h:Math.PI / 2 },pts:[[52, 78], [52, 26], [26, 26], [26, 78], [0, 78]] },
  {name:'Old Town Loop',district:'Old Town',start:{x:-52,z:0,h:Math.PI },pts:[[-52, -52], [0, -52], [0, 0], [-26, 0], [-52, 0]] },
  {name:'Heights Descent',district:'The Heights',start:{x:52,z:-26,h:Math.PI / 2 },pts:[[78, -26], [78, 26], [52, 26], [52, 0], [52, -26]] }
];
var MODELS = {
  compact: {name:'Pico Compact',base:900,top:26,accel:11,len:3.4,wid:1.7,hp:100 },
  sedan: {name:'Meridian Sedan',base:1600,top:30,accel:12,len:4.4,wid:1.9,hp:110 },
  taxi: {name:'Cab Co. Taxi',base:1200,top:29,accel:12,len:4.4,wid:1.9,hp:110 },
  cabrio: {name:'Solana Cabrio',base:3400,top:36,accel:15,len:4.2,wid:1.9,hp:110 },
  sport: {name:'Vesper GT',base:5200,top:42,accel:18,len:4.3,wid:2.0,hp:120 },
  limo: {name:'Regent Limo',base:6000,top:27,accel:10,len:6.2,wid:2.0,hp:140 },
  suv: {name:'Bastion SUV',base:3000,top:31,accel:12,len:4.8,wid:2.1,hp:150 },
  truck: {name:'Hauler Cargo Truck',base:4500,top:24,accel:8,len:7.2,wid:2.4,hp:220 },
  van: {name:'Cash Van',base:3800,top:26,accel:9,len:5.4,wid:2.1,hp:300 }
};
var CAR_COLORS = [0xd64541, 0x2e6fd8, 0xf2b134, 0x39b56a, 0xe8e6df, 0x8e44ad, 0xec7f2d, 0x2bb3a3, 0xd63384, 0x5a6270];
var LADDER = [[0, 'Nobody'], [120, 'Runner'], [300, 'Wheelman'], [550, 'Fence Friend'], [850, 'Shot Caller'], [1200, 'Palmshade Legend']];
function respectTitle(r) { var t = LADDER[0][1]; for (var i = 0; i < LADDER.length; i++) if (r >= LADDER[i][0]) t = LADDER[i][1]; return t; }
function standingBand(v) { return v < 25 ? 'HOSTILE' : v < 45 ? 'WARY' : v <= 60 ? 'NEUTRAL' : v <= 80 ? 'FRIENDLY' : 'ALLIED'; }
function fmtMoney(n) { return '$' + Math.round(n).toLocaleString('en-US'); }

var G = {
  mode: 'title', paused: false, frozen: false, time: 0, timeScale: 1, playSeconds: 0,
  money: 350, health:100, armour:0, wanted: 0, wantedLock: null,
  respect: 0, standing:{ 'Marina': 50, 'Old Town': 50, 'The Heights': 50 },
  storyDone: 0, slot: 1, ownSmg:false, ownShotgun:false, ammoSmg:0, ammoShot:0,
  flatTyre: false, nitro: 40, props:[], fav:null, garageTrimUsed: false,
  sight: { seen: false, hideT: 0, decayT: 0 },
  incident: null, eyesOutUntil: 0, lastNearMiss: 0, nmChain: 0,
  stats: { stolen:0, sold: 0, distKm: 0, topKmh: 0, escapes: 0, shots: 0, earned: 0, crew: 0, nearMiss: 0, stunts: 0, racesWon: 0 },
  playerCar: null, shopOpen: false, dialogOverride: null, lastEvent: '', lastToast: ''
};
function effWanted() { return Math.max(G.wanted, G.wantedLock || 0); }
function addRespect(n) { G.respect += n; }
function completionPct() {
  var d = 0; for (var i = 0; i < DISTRICTS.length; i++) if (G.standing[DISTRICTS[i]] >= 61) d++;
  return Math.round((G.storyDone / 8) * 70 + (d / 3) * 20 + (Math.min(G.stats.stolen, 10) / 10) * 10);
}
