# Handoff: Lane Runner, Vapor Freeway

Paste this whole file into a new Claude Code session (web or cloud) as its first message.

## What this repo is

`Dinco-MrT/Dinco-MrT.github.io` is a GitHub Pages site that hosts web apps and games for **Meta Ray-Ban Display glasses**, with one folder per app. Pages is served from `main`. It has no build step: every game is one self-contained `index.html`.

- `index.html` is the landing page, with one link card per app.
- `lane-runner/index.html` is the game (about 1000 lines of vanilla JS drawing to a 600×600 canvas).
- `lane-runner/.well-known/meta-wearables-manifest.json` and `icon.svg` are the app manifest and icon for the glasses.
- `tests/lane-runner.test.js` holds the headless Playwright checks (see Testing).

Live URL once merged to `main`: https://dinco-mrt.github.io/lane-runner/

## The game today

A vaporwave freeway racer, seen from behind the car in pseudo-3D. Built on branch `claude/repo-overview-rc1v4o`.

- **Lanes change while you drive.** The road starts with 3 lanes. You can open a lane on either edge or close either outermost lane, with a minimum of 3 and a maximum of 8. Open-left plus close-right can repeat forever, so the road drifts sideways; the original lanes don't have to survive.
- **Multiplier.** 3 lanes pays x3, 4 lanes pays x2, 5 or more pays x1. The **2X** power-up doubles whatever the lanes give.
- **Traffic.**
  - Cars can be jumped over or driven across the roofs.
  - Box trucks: jump onto the roof to ride them.
  - Car-carrier trucks have a yellow chevron ramp you can just drive up.
  - Trucks sometimes come in convoys.
  - Cone rows can be jumped.
- **Roadblocks.** Every 28–42 s a "ROAD CLOSED" barricade covers every lane that exists at that moment. To get past, you pave a new lane (or go through it with nitro).
- **Fresh lanes.** A newly paved lane shimmers mint and gets no traffic for 2.5 s.
- **Power-ups.**
  - MAGNET pulls in coins.
  - SHIELD absorbs one crash.
  - NITRO gives 1.6× speed and smashes anything you hit.
  - HYDRAULICS gives 1.3× jump height.
  - SCORE 2X doubles scoring.
- **Scoring.** Distance and coins both count, multiplied as above. The best score is saved in `localStorage` under `laneRunner.vaporBest`.

### Controls (glasses input = key events)

The Neural Band and temple touchpad send swipes as `ArrowLeft/Right/Up/Down` and a pinch as `Enter`. Always match on `e.key`, because device events have an empty `code`. Leave `Escape` alone: it's the system Back.

| Input | Action |
|---|---|
| ← / → | Steer. Steering off the edge paves a new lane and moves you into it. |
| ↑ | Jump |
| Pinch, then ← / → within 0.9 s | Open a lane on that side |
| ↓, then ← / → within 0.9 s | Close the outermost lane on that side. ↓ in the air also slams you down. |
| Pinch (title / game over / paused) | Start / restart / resume |
| Desktop only: Q / E / Z / C | Open left / open right / close left / close right |

## Hard constraints for the glasses (don't break these)

- **Additive display: black is see-through.** Keep the page background pure `#000`. Bright, large filled areas glare, so prefer strokes and dark translucent fills.
- **Fixed 600×600 stage.** The page uses `<meta name="viewport" content="width=600, height=600">`. Games aren't responsive.
- **`<meta name="mrbd-web-app-capable" content="yes">` must stay**, or the glasses route no input to the page.
- **The no-cache meta tags must stay**, because the glasses browser caches QR-opened pages hard.
- **Loop capped at about 30 fps** to match the 30 Hz panel. Nothing may run while hidden: the `visibilitychange` handler pauses the game, stops the loop and suspends audio.
- **Weak CPU.** Don't use `shadowBlur` or per-frame gradients. Sky art (sun, mountains) is pre-rendered once to offscreen canvases. A frame renders in about 3.8 ms on desktop Chromium; assume the glasses are 5–10× slower, so keep the per-frame draw budget roughly where it is.
- **Audio** is tiny Web Audio synth blips. The context is unlocked on the first pinch.
- Keep everything **self-contained in one HTML file**: no external scripts, fonts or images. The favicon is an inline data URI in `<head>`; don't touch it.

## Code map (`lane-runner/index.html`)

- **Tuning constants** at the top of the script: speeds, gravity, `STEP` (the tallest ledge you drive up without crashing), lane limits, `FRESH_T`, and the hitbox.
- **Projection.** `X(x, z)`, `Y(z, h)` and `scaleAt(z)`, with the camera following `S.cam`. World x is measured in lanes, z is distance ahead (positive is in front of the player), h is height.
- **State** is `S`. The road spans lanes `S.L..S.R` (integers). The player is at `S.lane` (target) and `S.px` (animated). `S.objs` holds world objects: `car | truck | ramp | cones | barrier | coin | power`.
- **Movement.** Each object has `frac`, its speed as a fraction of base speed (0 for static things). Coins on a vehicle use `ride` to reference that vehicle, so they stay on it.
- **Collisions** are in `step()`. `surf(o, u)` gives an object's surface height at distance `u` past its rear. If that height is more than `STEP` above the car, it's a crash; otherwise it becomes the ground (this is how ramps and roof riding work).
- **Traffic** comes from `spawnRow()`, which always leaves at least one lane free. `convoy()` makes faster traffic queue behind slower traffic. Traffic that reaches a barricade "takes the exit" (disappears in a burst).
- **Drawing.** `drawSky`, `drawGrid`, `drawRoad`, `drawPalms`, then `drawObj` sorted far to near, with the player drawn in between. `box()` is the generic pseudo-3D box (visible side, roof, rear).
- **Test hooks.** `window.__laneRunner` is the state and `window.__laneRunnerDebug` exposes the functions. Only the tests use them.

## Testing

Chromium and Playwright are in the cloud container. If the project's `playwright` doesn't resolve, the script falls back to the global install at `/opt/node22/lib/node_modules/playwright`.

```
node tests/lane-runner.test.js /tmp/shots
```

The script prints 17 PASS/FAIL checks: lane open/close rules, road drift, crashing into a car, riding a ramp truck, jumping onto a box truck, a box-truck crash, nitro, shield, power-up pickup, roadblock crash and bypass, and no page errors. It also runs a random-input soak and a render benchmark, and saves screenshots (`1-title.png`, `7-traffic.png`, …). Look at the screenshots after any visual change. The test uses `page.clock.install()` and calls `update()` directly, so it's deterministic apart from spawn randomness.

## Ideas / next steps (pick up any of these)

1. **On-device feel pass.** Tune `START_SPEED`, `ACCEL`, traffic density in `spawnRow` (`dens`), and the jump window for box trucks. The window is about 0.5 s; relax it if it's too strict on the glasses.
2. **AI lane changes.** Cars signal with blinkers, then drift into the next lane. Make sure a free path always exists.
3. **Music.** A light synthwave arpeggio or bass loop scheduled with Web Audio lookahead. It needs a mute option (maybe long-press, or a title-screen toggle).
4. **More scenery.** Neon streetlights, overhead gantry signs, a Helios bust or dolphin billboard, and day/night colour "zones" every ~1000 m.
5. **Crash polish.** Glitch/RGB-split effect and car debris on crash, and a camera bank when changing lanes.
6. **Performance.** If the glasses stutter, drop the palms to one side, reduce the grid lines, or cache the road layer.
7. **Landing page** could show the app icon next to each card.

## Workflow

- Work on a feature branch, run the test script, look at the screenshots, then commit and push. Merge to `main` to deploy; Pages serves `main`.
- Keep the style of the existing code: plain ES2020 in one IIFE, `'use strict'`, short comments only where the intent isn't obvious.
