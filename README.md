# Palmshade Heat

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Kivye/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Kivye/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Palmshade Heat is an original open-world crime game that runs in a desktop browser from static files, built on a vendored copy of Three.js with every other asset generated in code — the city, the cars, the people and the sounds are all procedural, so there is nothing to download and nothing to install. You play Rio in Palmshade, a sun-soaked coastal city baked in golden late-afternoon light: a grid of streets and sidewalks across three districts (the bright pastel Marina by the sea and its pier, the cream-and-brick Old Town, and the tall blue-glass Heights), with flat-shaded buildings, palm trees, street lamps, live traffic that follows the road network and brakes for obstacles, and pedestrians who stroll the sidewalks and scatter with a "!" when danger gets close. Twelve procedurally built car models — from a boxy compact and a Palm Cab taxi to a police cruiser, a limo and the golden Aurum One showpiece — can be stolen with a key press (the driver bolts), driven with arcade physics and handbrake drift, damaged until they smoke, and fenced at two chop shops where the payout scales with the model's value and the condition you deliver it in. Crimes witnessed by police raise a 1–5 star wanted level: cruisers spawn off-screen, chase, block and ram, and breaking line of sight makes the stars blink and decay; get caught and you are BUSTED at the police station for a 15% cash fine, die and you wake WASTED at the hospital for 10%. A hitscan pistol with aim assist, muzzle flash and recoil handles the fights when gang members shoot back. Five chained story missions — a tutorial theft, a timed package run, a rival-car chase for a briefcase, a showroom heist under a forced 3-star chase, and a golden-car convoy finale at the pier — pay cash and raise your story rank from Nobody to Palmshade Legend, with a gold light column and minimap blip marking every objective. The HUD carries a canvas minimap with district tints and blips for police, objectives and chop shops, wanted stars, health, cash, the current district name, interaction prompts, and a speedometer with the car's name while driving; all audio is synthesized live with WebAudio (engine pitch, two-tone sirens, gunshots, thuds, horns, jingles and a quiet bass loop, M to mute), and progress — cash, rank and completed missions — persists in localStorage with Start, Continue, How to Play and Reset Save on the start screen.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser.

---

<sub>Entered on [make.fun](https://make.fun/?ref=r951qv42&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
