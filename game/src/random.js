'use strict';

var _seed = 987654321;
function srand(s) { _seed = s >>> 0; }
function rnd() { _seed |= 0; _seed = _seed + 0x6D2B79F5 | 0; var t = Math.imul(_seed ^ _seed >>> 15, 1 | _seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
function rand(a, b) { return a + rnd() * (b - a); }
function randi(a, b) { return Math.floor(rand(a, b + 1)); }
function pick(arr) { return arr[Math.floor(rnd() * arr.length)]; }
function chance(p) { return rnd() < p; }
