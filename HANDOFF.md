# Handoff: Lane Runner, Vapor Freeway

Paste this whole file into a new Claude Code session (web or cloud) as its first message.

## What this repo is

`Dinco-MrT/Dinco-MrT.github.io` is a GitHub Pages site that hosts web apps and games for **Meta Ray-Ban Display glasses**, with one folder per app. Pages is served from `main`. It has no build step: every game is one self-contained `index.html`.

- `index.html` is the landing page. It links to `lane-runner/?v=2`; bump the `?v=` when you ship, because the glasses cache hard.
- `lane-runner/index.html` is the game (about 1200 lines of vanilla JS drawing to a 600×600 canvas). The title screen shows the build tag (`BUILD` constant, currently `v2`) so you can tell which build the glasses loaded.
- `lane-runner/.well-known/meta-wearables-manifest.json` and `icon.svg` are the app manifest and icon for the glasses.
- `tests/lane-runner.test.js` holds the headless Playwright checks (see Testing).

Live URL: https://dinco-mrt.github.io/lane-runner/

## The game today

A vaporwave freeway racer, seen from behind your car in pseudo-3D.

- **The freeway changes lanes by itself.** Every 260–420 units of distance (roughly 12–25 s) one side either opens a new lane (it tapers in; a mint NEW LANE sign) or ends one (two yellow LANE ENDS signs, then a chevron arrow board, then a taper). The road always keeps 3–6 lanes and can drift sideways over time. If your lane is ending, a HUD banner tells you which way to merge. Staying in the lane means hitting the board.
- **Traffic merges realistically.** Cars signal (amber blinker) and merge out of ending lanes, or take the exit if they can't. Faster traffic queues behind slower traffic.
- **No jumping.** The only way off the ground is to drive up the yellow chevron ramp of a car carrier and ride its deck. From there you can move across onto neighbouring roofs, or drop off the end.
- **Look: flat-coloured shapes.** Every vehicle is one solid colour, flat-shaded (roof lighter, side darker, via `shade()`), with just a few readable details: dark windows, taillights, and one signature feature per model. The models are a wedge with a wing, a DeLorean with a black tail panel, a muscle car with white stripes, a cop car with a red/blue light bar, a tall van, and a hatchback. Trucks come as semis (silver cab, coloured box), tankers (a cylinder) and car carriers (a yellow ramp). Keep new art in this style: shapes and colour, not line detail.
- **Your car** is a pink wedge with a glowing taillight bar, a lip spoiler and cyan neon underglow. It yaws toward the lane it's heading for, rolls into turns, and buzzes with road vibration. The taillights flare when you brake, and the exhausts flame when you boost.
- **Speed keeps climbing.** 12 → 25 u/s over the first minute, then +0.07 u/s² up to a cap of 42. The speedo reads u/s × 8.5 as km/h (about 100 → 360 km/h base, more when boosting).
- **Boost** is a 3-segment meter. It charges slowly over time, with coins, and with near misses. A swipe up spends one segment for 2.5 s at 1.45× speed, with a FOV kick and speed lines. **While boosting you smash through cones and lane-end boards** (`LIGHT` set); cars and trucks still wreck you.
- **Power-ups.**
  - MAGNET pulls in coins.
  - SHIELD absorbs one crash.
  - NITRO gives 1.6× speed and smashes through anything.
  - BOOST FULL refills the meter.
  - SCORE 2X doubles scoring.
- **Scoring.** Distance counts, coins are +10, near misses +30 (overtaking a vehicle in an adjacent lane), and smashes +25. Everything doubles under 2X. The best score is saved in `localStorage` under `laneRunner.vaporBest`.

- **Trick ramps (core loop).** Hot-pink kickers with yellow chevrons appear in free lanes about every 380–600 units, with a coin trail leading on and a coin arc along the flight path. Driving over one launches you: time slows to 0.3×, the world dims, the camera rises with the car (`S.camH`), and a combo of 3–5 arrow icons appears at the top (more steps later in a run). Traffic in your lane scatters from the landing zone.
  - Each correct swipe does a trick: ← BARREL ROLL, → CORKSCREW, ↑ KICKFLIP (hop and flip), ↓ BOP 360 (spin and squash). Tricks score 100 × step × multiplier, and the icons light up with an `i/n` count and an air-time bar.
  - Finishing the combo is PERFECT: +500 × multiplier, +1 boost segment, and +1 **style chain**.
  - A wrong swipe is COMBO BROKEN: the chain resets. No input just lands (TOO SLOW).
  - The style chain multiplies all scoring (x1 + chain, up to x5 on its own, ×2 more with the 2X power-up) and drains after 30 s without a trick.
- **Zones.** Every 900 units the terrain changes, cycling through SUNSET STRIP (palms), NEON CITY (flat-shaded towers), DESERT NIGHT (cacti and rocks) and HYPER TUNNEL (neon rings overhead; the sky fades out). Each has its own grid and road-edge colours and an "ENTERING …" banner.
- **Events.** Every 35–55 s (after 20 s) one runs with a HUD pill and timer: RUSH HOUR (much denser traffic, 18 s), COIN RUSH (coins in every free lane, 14 s) or STUNT ZONE (a trick ramp every ~50–70 units and lighter traffic, 16 s).

- **Hits, not instant death.** Hitting something knocks it out of the way, halves your speed (and caps it at 60% for 2.5 s) and gives 1.5 s of invulnerability. A red **DAMAGED** countdown runs for 60 s while your car smokes. A second hit inside that window wrecks you (`hit()`, `HIT_WINDOW`).
- **Readable traffic.** Before any lane change a vehicle indicates for 0.8 s (`SIGNAL_T`, glowing blinkers), and a flashing orange double chevron is painted flat on the lane it's moving into (`drawMergeArrows`).
- **Fairness (no impossible scenarios).** Every frame, after physics, `fairness()` scans ahead. If every usable lane is blocked at about the same distance (±1.5 units; car carriers and trick ramps count as passable), the furthest vehicle takes an exit. This was mostly rolling roadblocks: cars from different spawn rows drifting side by side, which blocked about 7% of frames before the fix and 0 after.
- **No popping.** Everything spawns at `SPAWN` (= FAR + 10), fully transparent, and fades in over 12 units. Anything removed during play (knocked-out, fairness exits, trick landing clears) uses `exitObj()`: it slides off the nearer side of the road and fades out, and is non-solid while it does. Nothing vanishes instantly any more.

- **Boost impact.** A boost gives an instant speed jolt (×1.3) on top of a 1.6× top speed. On screen you get a FOV punch (`S.hud.kick`), a cyan flash, a shockwave ring (`ring()` / `drawRings`), 30 speed lines, glowing screen edges, long twin exhaust flames with taillight afterimages, a bass boom, and a speedo that pops and turns cyan.
- **HUD style.** Everything is built from `chip()`: a dark rounded panel with a neon outline and a top sheen.
  - Top left: SCORE rolls up and pops on big gains, next to an xN badge (mint when the style chain is on), with the STYLE bar and a shaking DAMAGED chip beneath.
  - Top right: COINS, with coins flying into the counter (`flyCoin`).
  - Top centre: the lane map, with a sliding dot and ending lanes blinking yellow.
  - Bottom: power-up chips, the boost meter (segments flash when they fill, plus a bobbing ↑ hint) and a circular speedo.
  - All of it slides in at the start of a run with a "GO!".
  - Toasts pop in with overshoot, zone banners sweep in, and combo icons drop in and bounce as you hit them.
  - The title screen animates, with key chips and a pulsing start pill. The game-over screen scales in, counts the score up, and shows four stat cards (distance, top speed, coins, perfect combos) plus a NEW BEST badge.
- **Fewer lane changes.** Cones and trick ramps only go in lanes where no vehicle ahead would reach them before you overtake it (`quiet()` in `spawnRow`). Traffic isn't spawned into lanes that end within 150 units, and lane endings pick the side with less traffic. That took lane changes from 8/min to about 2.5/min and stopped cars from 14/min to about 2/min.

### Controls (glasses input = key events)

The Neural Band and temple touchpad send swipes as `ArrowLeft/Right/Up/Down` and a pinch as `Enter`. Always match on `e.key`, because device events have an empty `code`. Leave `Escape` alone: it's the system Back.

| Input | Action |
|---|---|
| ← / → | Change lanes. You can't leave the road; hitting the edge gives a bump and a wobble. In the air during a trick combo, all four swipes are combo inputs instead. |
| ↑ (swipe forward) | Boost (uses one charged segment) |
| ↓ | Brake (0.7 s at 60% speed) |
| Pinch | Horn: the vehicle ahead in your lane tries to move over. Also start / restart / resume. |

## Hard constraints for the glasses (don't break these)

- **Additive display: black is see-through.** Keep the page background pure `#000`. Bright, large filled areas glare, so prefer strokes and dark translucent fills.
- **Fixed 600×600 stage.** The page uses `<meta name="viewport" content="width=600, height=600">`. Games aren't responsive.
- **`<meta name="mrbd-web-app-capable" content="yes">` must stay**, or the glasses route no input to the page.
- **The no-cache meta tags must stay**, and bump `?v=` on the landing link plus `BUILD` when you ship.
- **Loop capped at about 30 fps** to match the 30 Hz panel. Nothing may run while hidden: the `visibilitychange` handler pauses the game, stops the loop, and stops the engine drone and audio.
- **Weak CPU.** Don't use `shadowBlur` or per-frame gradients. The sun, mountains, city skyline and horizon glow are pre-rendered once to offscreen canvases. A busy frame renders in about 5–6 ms on desktop Chromium. That's more than v1's 3.8 ms because of the new car details, so watch it: assume the glasses are 5–10× slower. If it stutters, cheaper level-of-detail for far cars is the first lever (see `detail` in `drawCar` / `drawTruck`).
- **Audio** is tiny Web Audio synth blips plus a low sawtooth engine drone whose pitch tracks speed. The context is unlocked on the first pinch.
- Keep everything **self-contained in one HTML file**. The favicon is an inline data URI in `<head>`; don't touch it.

## Code map (`lane-runner/index.html`)

- **Tuning constants** at the top: speed curve, boost/brake/nitro multipliers, `STEP` (the tallest ledge you drive up, which is what makes ramps work), lane limits, `TAPER`, and the hitbox.
- **Projection.** `X(x, z)`, `Y(z, h)` and `scaleAt(z)`. `S.D` is the focal distance, animated for the boost FOV kick, and `S.cam` is the sideways camera. World x is measured in lanes, z is distance ahead of the car, h is height.
- **The freeway** is `S.road = { L: {v0, ch: []}, R: {...} }`. `v0` is that side's outermost lane; `ch` holds changes `{w, from, to}` at world distance `w`.
  - `laneAt(side, w)` gives the usable outermost lane at `w`, used for steering, spawning and merges.
  - `edgeAt(side, w)` gives the drawn edge, including tapers.
  - `scheduleLaneChange()` adds a change about FAR + 40 ahead, plus its signs and barrier; `pruneRoad()` folds old changes into `v0`.
- **State** is `S`. `S.objs` holds world objects: `car | truck | ramp | cones | barrier | sign | coin | power`.
  - `frac` is an object's speed as a fraction of base speed (0 for static things).
  - `ride` pins coins to a vehicle.
  - `mergeTo` is a vehicle's lane change in progress.
  - `model` picks the drawing (`MODELS` for cars; `semi | tanker | ramp` for trucks).
- **Collisions** are in `step()`. `surf(o, u)` gives an object's surface height at `u` past its rear. If that's more than `STEP` above the car, it's a crash; otherwise it becomes the ground.
- **Traffic.** `spawnRow()` always leaves one lane free, `convoy()` queues traffic, `trafficMerges()` handles lane-end merges and blinkers, and `tryMerge()` refuses to merge into the player.
- **Drawing.**
  - `box()` draws a pseudo-3D box that can be yawed. It culls the hidden side, then draws the roof and rear.
  - `frame()` / `fx` / `fy` / `frect` / `fcircle` / `fpoly` draw on a rear face in local units (a = lanes across, b = height).
  - Each car model's details are in `drawCar`'s switch; trucks are in `drawTruck`; your car is `drawPlayer`.
- **Test hooks.** `window.__laneRunner` is the state and `window.__laneRunnerDebug` exposes the functions. Only the tests use them.

## Testing

Chromium and Playwright are in the cloud container. If the project's `playwright` doesn't resolve, the script falls back to the global install at `/opt/node22/lib/node_modules/playwright`.

```
node tests/lane-runner.test.js /tmp/shots
```

The script prints 21 PASS/FAIL checks:
- controls (boost doesn't jump, brake works, you can't leave the road)
- the speed curve
- a lane opening and driving into it
- a lane ending (crash if you stay, survive if you merge)
- traffic merging
- riding a car carrier, and rear-ending a semi
- near miss, horn, nitro, shield and turbo
- no page errors

It also runs a random-input soak and a render benchmark, and saves screenshots: `1-title`, `2-lane-opening`, `3-lane-ends`, `4-ramp-truck`, `5-nitro`, `6-showroom` (every model at once) and `7-traffic`. **Look at the screenshots after any visual change.** For a close-up, use `deviceScaleFactor: 2` with a `clip`.

## Ideas / next steps

1. **On-device tuning.** Traffic density (`dens` in `spawnRow`), how often lanes change (`S.nextLane`), the speed curve, and boost charge rates.
2. **Performance pass on the glasses.** Simplify far-away cars more aggressively, or cache car sprites per model and scale bucket.
3. **Exits and on-ramps.** Traffic joining from a new lane's taper, and an occasional off-ramp split.
4. **Music.** A light synthwave arpeggio or bass loop (Web Audio lookahead scheduling), with a mute option.
5. **More scenery.** Overhead gantry signs, a Helios bust or dolphin billboards, tunnels, and colour "zones" every km.
6. **Crash polish.** Car debris, a glitch/RGB-split effect, and a slow-mo moment.
7. **More traffic.** Motorbikes that lane-split, a limo, or a police chase that reacts to your speed.

## Workflow

- **Always ship live ASAP** (the owner's standing instruction; see `CLAUDE.md`): work on a feature branch, run the test script and look at the screenshots, then commit, push, open a PR to `main` and merge it right away. Bump `BUILD` and the landing `?v=` each time.
- Keep the style of the existing code: plain ES2020 in one IIFE, `'use strict'`, short comments only where the intent isn't obvious.

---

# Handoff: Ramp Rivals

`ramp-rivals/index.html` is a second game in the same style and under the same glasses constraints as Lane Runner (see "Hard constraints for the glasses" above: pure `#000` background, fixed 600×600 stage, `mrbd-web-app-capable`, no-cache tags, ~30 fps loop, nothing running while hidden, one self-contained file). It's about 1,700 lines of vanilla JS drawing to a 600×600 canvas. `BUILD` is shown on the title screen (currently `v1`).

Live URL: https://dinco-mrt.github.io/ramp-rivals/

## The game

A TRON-style, cartoony lane racer. You're a round little hero bot on a hoverboard, racing seven rival bots to the finish of one linear track.

- **8 lanes, 8 racers.** There's always one lane per racer, and everyone starts side by side. You get a 3-2-1 countdown: swipe up right on GO for a rocket start, or you stall if you swipe too early.
- **The rivals** are round, one-wheeled beetle bots with two little claws and eyes on stalks: ZAPP, NIBBS, KRUNCH, PIXIE, VOLTA, GLITCH and BOLTZ. Their eyes look back at you when you're close.
- **Tracks** are built from straights and very wide freeway turns: 170–300 unit radius, with 180° "turn around" arcs. Every turn eases in and out, there are no hills, and you can always see far ahead. The chase camera yaws with the road and leans a little into turns. The floor is a world-fixed TRON grid, so it streams past and swings round as you turn.
- **3 maps × 3 tracks**, each map a step up in rival skill, aggression and firewalls:
  - GRID CITY (rookie, cyan)
  - SOLAR CANYON (pro, orange)
  - VOID RINGS (elite, pink/purple)

  Layouts are seeded, so a track is the same every time.
- **Bumping.** Swiping into a lane where someone is alongside doesn't move you: you bump them. They're slowed (×0.86) and knocked only if you're faster than them. If you're boosting, they spin out instead. Running into the back of someone without boost just costs you speed. Boosting into them knocks them flying (spin-out, 3 coins lost, shoved into a free lane). Landing a jump on someone stomps them. Rivals follow the same rules.
- **Rivals come for you.** Aggressive ones (`aggro` per track) line up in the lane beside you and attack in three ways:
  - **Side swipe:** a 0.55 s wind-up with red eyes, snapping claws and red chevrons on your lane, then they swerve in.
  - **Charge:** they boost up the next lane and swerve in.
  - **Ram:** they boost into you from behind.
- **Rear warnings.** Anyone within 28 units behind you shows as a chevron under their lane at the bottom of the screen, flashing red with a "!" and a beep when they're about to hit you.
- **Speed and momentum.**
  - **Coins:** each one adds 2.5% top speed, up to 10 (Mario Kart style), and a spin-out costs 3.
  - **Slipstream:** tuck in 1.2–9 units behind someone in your lane for 1 s and you get ×1.3 for 1.6 s.
  - **Boost:** collect cells (max 3); a swipe up gives ×1.5 for 2.2 s with a jolt and smashes through firewalls.
  - **Boost pads:** ×1.4 for 1 s.
  - **Brake:** a swipe down gives ×0.55 for 0.6 s; you keep rolling.
  - **Momentum on screen:** the speedo (with your coin-raised top speed as a yellow tick), speed lines, an FOV kick and your light-trail ribbon.
- **Tricks: the Lane Runner combo system, unchanged.** Driving over a pink ramp launches you into 0.3× slow motion with a combo of 3–5 arrows (← BARREL ROLL, → CORKSCREW, ↑ KICKFLIP, ↓ BOP 360).
  - **PERFECT:** +1 boost, +1 style chain (max x4) and a landing boost.
  - **Partial:** a small landing boost.
  - **Wrong swipe:** COMBO BROKEN, which also resets the chain.
- **Firewalls** (red hazard blocks, later tracks only) spin you out unless you're boosting. A knocked one slides off the road and fades rather than vanishing.
- **No pop-in.** Everything is pre-placed along the track and fades in over the last 55 units of the 210-unit draw distance. The far road and grid fade into a horizon fog, and taken coins and cells grow back in 8 s later.
- **Menus.**
  - **Title:** pinch or tap.
  - **Race select:** ← → picks the map, ↑ ↓ the track, with a live preview of the track shape and your best result.
  - **Results:** the full standings. Pinch goes to the next race, ↓ retries, ← goes to the menu (which reloads for a fresh build, like Lane Runner's restart).
  - **Pause:** pinch mid-race. On phones, tap the top HUD.
  - Best places and times are saved in `localStorage` under `rampRivals.best`.

## Controls

| Glasses (key events) | Phone (touch) | Action |
|---|---|---|
| ← / → | swipe left / right | Change lane, or bump whoever is alongside |
| ↑ | swipe up | Boost (uses a collected cell); in the air, a trick |
| ↓ | swipe down | Slow down |
| Pinch (`Enter`) | tap | Start / select, pause / resume (on phones, only a tap on the top HUD pauses mid-race) |

**Phones.** The same 600×600 stage is scaled to the screen width: a tiny head script switches the viewport to `width=600` when the screen is narrower than 560 px, and the glasses keep the fixed stage. Swipes are pointer events with `touch-action: none`, one per stroke.

## Performance

A busy frame is about 6 ms here in headless Chromium, versus Lane Runner's ~3.5 ms on the same machine. The sky is a pre-rendered 360° panorama per map, and nothing uses `shadowBlur` or per-frame gradients.

**Lite mode.** If a race averages worse than ~24 fps for 1.5 s, the game switches itself to lite mode: a sparser grid, no fog or stars, no rival trails, and scenery out to 130 units. Force it with `?lite=1`; the title shows "v1 · lite".

## Code map (`ramp-rivals/index.html`)

- **Tuning constants** at the top: speeds, boost, draft, brake, spin-out, knock, ramps, tricks and the camera.
- **`MAPS`** holds the three maps and their tracks.
  - Track `pieces` are `['S', len]` or `['R'|'L', degrees, radius]`.
  - Per track: `skill` (the rivals' speed range), `aggro`, `rubber`, `combo` (combo length range) and `barriers`.
- **`ROSTER`** is the rivals.
- **Track.**
  - `geometry()` turns pieces into curvature per unit, blurs it (eased turns) and integrates it into centreline `X/Z/P` arrays, `PRE` units behind the start and `RUNOUT` past the finish.
  - `populate()` places items (coins, cells, pads, barriers), `ramps` and scenery `props`, keeping props off the road where the track passes itself.
  - Coordinates: `s` = distance along the track, `d` = lanes across (+ is right), `h` = height.
- **Camera and projection.** `Cam` follows you. `proj(s, d, h)` gives screen `x, y` and `k` (px per unit); its results come from a per-frame pool, so don't keep them across frames. `sampleRoad()` / `rpt()` project road samples cheaply.
- **Racers** are created by `newRacer()`; `S.racers[0]` is you (`S.P`).
  - `updateRacer()` does speed targets, lanes, ramps and air, pick-ups, slipstream and the finish.
  - `contacts()` resolves side bumps and rear bumps. `tryLane()` and `bumpHit()` handle the "can't move in, bump instead" rule; `knock()` and `spinOut()` are the two hit sizes.
  - AI: `think()` does lane choice, hunting, boosts and attacks; `capSpeed()` stops rivals rear-ending anyone unless they're ramming; `attackTick()` runs wind-ups and charges.
  - `S.P.auto` puts you on the same AI: used for the title demo, after you finish, and by the tests, which also play the trick combo.
- **Drawing.**
  - Scene: `drawSky` (panorama and stars), `drawGrid`, `drawRoad`, `drawTrail`, `drawWorld` (items, ramps, props and racers sorted far to near), `drawBug` (rivals, with a middle-distance simplification), `drawHero` (you) and `box()`, a culled 3D box with optional taper.
  - HUD and screens: `drawRaceHud`, `drawTrickHud` (copied from Lane Runner), `drawRearWarnings`, `drawTitle`, `drawMenu`, `drawResults` and `drawPaused`.
- **Test hooks.** `window.__rampRivals` is the state and `window.__rampRivalsDebug` exposes the functions.

## Testing

```
node tests/ramp-rivals.test.js /tmp/shots
```

This runs about 55 PASS/FAIL checks:
- menu, countdown, rocket start and stall
- lanes, brake and boost, cells, coins
- every bump rule, rival side swipes, hunting and rear warnings
- slipstream
- the trick combo (perfect, broken and no input)
- firewalls
- all 9 tracks (wide turns, clear of themselves, stocked)
- no pop-in
- a full autopilot race to the results screen, retry / next / pause
- a phone-sized touch run (the stage fits the width, tap, swipe left, swipe up, stray taps ignored)
- no page errors

It saves screenshots `1-title` … `12-phone` and prints the average render time.

## Ideas / next steps

1. **On-device tuning.** Rival `aggro` and `skill`, the rubber band, boost and draft strength, and race length (40–80 s now).
2. **Performance on the glasses.** Check whether lite mode kicks in; if so, trim the rivals' drawing further or cache their sprites.
3. **More maps and tracks.** Unlockable cups, and a time-trial ghost.
4. **Music.**
5. **Multiplayer.** The bump rules were designed to be symmetric, so another player could slot in where a rival is.
6. **Local copy.** The game isn't in `~/Developer/RayBanDisplay/apps/` yet; it was built straight into this repo.

