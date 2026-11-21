# Palmshade Heat

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Kivye/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Kivye/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Palmshade Heat is an original open-world crime game for a desktop browser, served entirely from static files. It runs on a vendored copy of Three.js, and everything else — city, cars, people, sounds — is generated in code at runtime, so there is nothing to download and nothing to install. You are Rio, working the golden-hour streets of Palmshade, a coastal city laid out as a street grid across three districts: the pastel Marina along the sea and its pier, cream-and-brick Old Town, and the tall blue-glass Heights. Buildings are flat-shaded and lit-windowed, palms and lamps line the boulevards, traffic follows the road network and brakes for obstacles, and pedestrians stroll the sidewalks until trouble makes them scatter with a floating "!".

Twelve procedural car models — a boxy compact, a Palm Cab taxi, a police cruiser, a limo, the golden Aurum One — can be stolen at a key press (the driver bolts), driven with arcade physics and a handbrake, damaged until their smoke plume is unmissable, and fenced at two chop shops that pay by model value and delivered condition. Witnessed crimes raise a 1–5 star wanted level. Cruisers with individual PALM callsigns spawn off-screen, chase, ram and block; at three stars a spotlight helicopter joins the hunt, at four a cruiser breaks off to set a roadblock across your route, and breaking line of sight makes the stars blink and decay. Get caught and you are BUSTED at the station for a 15% fine; die and you wake WASTED at the hospital for 10% — with a fresh kevlar vest's worth of armour either way.

The HUD is built to be read at a glance: a PSPD dispatch panel names every unit with its role and distance and carries the latest incident line; a mission panel shows stage pips, the objective and the NEXT step while the mission giver talks in a dialogue box; a sight chip reads IN SIGHT or LOSING THEM with the decay percentage; and the round minimap draws the real road grid, the 55 m search ring, objective and shop blips, and an orange barricade marker on the roadblock unit. Rio's three-person crew works on real cooldowns — Nia Ferrer swaps plates to shed a star, Bo Castellano quick-fixes the car you are driving, Juno Reyes rings every cruiser on the minimap — and each district keeps a standing score that your jobs, fences and witnessed thefts push around. Five chained story missions from named givers pay cash, earn respect from Nobody to Palmshade Legend, and fill a career record (cars stolen and fenced, distance, top speed, escapes, shots, earnings, near misses) that the pause screen presents as a completion percentage. A three-station procedural radio (R to retune) plays under a synthesized WebAudio soundscape of engines, sirens, gunfire and jingles, M to mute, and progress — cash, story, respect, standing, career and armour — persists in localStorage behind Start, Continue, How to Play and Reset Save.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser.

---

<sub>Entered on [make.fun](https://make.fun/?ref=r951qv42&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
