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
