// Headless checks for lane-runner. Usage: node tests/lane-runner.test.js [screenshot-dir]
const { chromium } = (() => { try { return require('playwright'); } catch { return require('/opt/node22/lib/node_modules/playwright'); } })();
const path = require('path');

(async () => {
  const SP = process.argv[2] || require('os').tmpdir();
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 600, height: 600 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.clock.install(); // freeze rAF; the test drives update() itself
  await p.goto('file://' + path.resolve(__dirname, '../lane-runner/index.html'));

  const shot = async (n) => { await p.evaluate(() => __laneRunnerDebug.render()); await p.screenshot({ path: `${SP}/${n}.png` }); };
  const run = (sec) => p.evaluate((sec) => { for (let i = 0; i < sec * 30; i++) __laneRunnerDebug.update(1 / 30); }, sec);
  const S = () => p.evaluate(() => { const s = __laneRunner; return { mode: s.mode, lane: s.lane, y: +s.y.toFixed(2), speed: +s.speed.toFixed(2), boost: +s.boost.toFixed(2), score: Math.floor(s.score), L: __laneRunnerDebug.laneAt('L', s.dist), R: __laneRunnerDebug.laneAt('R', s.dist) }; });
  const key = (k) => p.keyboard.press(k);
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
  const fresh = () => p.evaluate(() => { __laneRunnerDebug.reset(); const s = __laneRunner; s.nextLane = 1e9; s.nextPower = 1e9; s.sinceRow = -1e9; });

  await p.evaluate(() => __laneRunnerDebug.update(1 / 30)); await shot('1-title');
  await key('Enter'); ok((await S()).mode === 'play', 'pinch starts');

  // Controls.
  await fresh();
  await key('ArrowUp'); await run(1);
  let s = await S(); ok(s.y === 0, 'swiping up does not jump');
  ok(s.boost < 0.2 && s.speed > 15, 'swipe up boosts ' + JSON.stringify(s));
  await run(3); const cruise = (await S()).speed;
  await key('ArrowDown'); await run(0.5); ok((await S()).speed < cruise - 2, 'swipe down brakes');
  await fresh();
  await key('ArrowLeft'); await key('ArrowLeft'); await run(0.3);
  s = await S(); ok(s.lane === -1 && s.L === -1, 'cannot steer off a 3-lane road');

  // Speed keeps climbing past the old cap.
  const sp = await p.evaluate(() => [0, 60, 200, 400].map((t) => __laneRunnerDebug.baseSpeed(t)));
  ok(sp[0] < sp[1] && sp[1] < sp[2] && sp[2] > 28 && sp[3] <= 42, 'speed keeps climbing ' + sp.join(','));
  await fresh(); await p.evaluate(() => { __laneRunner.t = 200; }); await run(2);
  ok((await S()).speed > 28, 'late-game speed beats old 28 cap');

  // The freeway opens a lane on its own.
  await fresh();
  await p.evaluate(() => __laneRunnerDebug.scheduleLaneChange());
  await run(4); await shot('2-lane-opening'); await run(8);
  s = await S(); ok(s.R - s.L + 1 === 4, 'a new lane opens ahead ' + JSON.stringify(s));
  const side = s.L === -2 ? 'ArrowLeft' : 'ArrowRight';
  await key(side); await key(side); await run(0.5);
  s = await S(); ok(s.lane === (side === 'ArrowLeft' ? -2 : 2), 'can drive into the new lane ' + JSON.stringify(s));

  // A lane ends: stay in it and you hit the board; merge and you're fine.
  const endLane = async (merge) => {
    await fresh();
    await p.evaluate(() => {
      const s = __laneRunner; s.road.L.v0 = -2; s.lane = -2; s.px = -2;
      s.road.L.ch.push({ w: s.dist + 40, from: -2, to: -1 });
      __laneRunnerDebug.add({ kind: 'barrier', lane: -2, z: 40, len: 0.6, w: 0.96, h: 1.5, dir: 1 });
    });
    await run(1.5); if (!merge) await shot('3-lane-ends');
    if (merge) await key('ArrowRight');
    await run(4);
    return (await S()).mode;
  };
  ok((await endLane(false)) === 'over', 'staying in an ending lane wrecks you');
  ok((await endLane(true)) === 'play', 'merging out of an ending lane survives');

  // Traffic merges out of an ending lane instead of vanishing into the board.
  await fresh();
  const merged = await p.evaluate(() => {
    const s = __laneRunner; s.road.R.v0 = 2;
    s.road.R.ch.push({ w: s.dist + 50, from: 2, to: 1 });
    const car = __laneRunnerDebug.addCar(2, 20);
    for (let i = 0; i < 90; i++) __laneRunnerDebug.update(1 / 30);
    return { lane: car.lane, to: car.mergeTo, dead: !!car.dead };
  });
  ok(merged.dead || merged.lane === 1 || merged.to === 1, 'traffic merges before its lane ends ' + JSON.stringify(merged));

  // Traffic never drives through a static obstacle (it would hide it until the last moment).
  for (const walls of [false, true]) {
    await fresh();
    const r = await p.evaluate((walls) => {
      const d = __laneRunnerDebug, s = __laneRunner; s.lane = 1; s.px = 1;
      const cones = d.add({ kind: 'cones', lane: 0, z: 40, len: 0.5, w: 0.9, h: 0.4 });
      const car = d.addCar(0, 25); car.frac = 0.55;
      if (walls) { d.addTruck(-1, 20, 'semi', car.frac); d.addTruck(1, 20, 'semi', car.frac); } // boxed in
      let overlapped = false;
      for (let i = 0; i < 150; i++) {
        d.update(1 / 30);
        if (s.mode !== 'play') { s.mode = 'play'; s.invuln = 1e9; }
        if (!car.dead && s.objs.includes(cones) && s.objs.includes(car) && Math.abs(car.lane - cones.lane) < 0.5 && car.z < cones.z + cones.len && car.z + car.len > cones.z) overlapped = true;
      }
      return { overlapped, lane: car.lane, stopped: !!car.stopped };
    }, walls);
    ok(!r.overlapped && (walls ? r.stopped : r.lane !== 0), (walls ? 'boxed-in car stops behind cones ' : 'car changes lanes around cones ') + JSON.stringify(r));
  }
  await fresh();
  ok(await p.evaluate(() => { const d = __laneRunnerDebug, c = d.addCar(1, 7); d.add({ kind: 'cones', lane: 1, z: 15, len: 0.5, w: 0.9, h: 0.4 }); for (let i = 0; i < 10; i++) d.update(1 / 30); return c.mergeTo !== 0 && Math.round(c.lane) !== 0; }), 'traffic never cuts into your lane right in front of you');

  // Four minutes of natural traffic: no vehicle may ever overlap cones or a lane-end board.
  const overlaps = await p.evaluate(() => {
    const d = __laneRunnerDebug, s = __laneRunner; let n = 0;
    for (let run = 0; run < 2; run++) {
      d.reset(); s.invuln = 1e9;
      for (let i = 0; i < 30 * 120; i++) {
        d.update(1 / 30);
        const statics = s.objs.filter((o) => !o.dead && (o.kind === 'cones' || o.kind === 'barrier' || o.kind === 'kicker') && o.z < 64);
        for (const v of s.objs) {
          if (v.dead || !['car', 'truck', 'ramp'].includes(v.kind)) continue;
          for (const c of statics) if (Math.abs(v.lane - c.lane) < 0.6 && v.z < c.z + c.len && v.z + v.len > c.z && v.z < 60) n++;
        }
      }
    }
    return n;
  });
  ok(overlaps === 0, 'natural traffic never drives through obstacles (' + overlaps + ' overlapping frames)');

  // Boosting smashes through light things (cones, lane-end boards) but not traffic.
  for (const kind of ['cones', 'barrier']) {
    await fresh();
    await p.evaluate((kind) => { __laneRunner.boost = 3; __laneRunnerDebug.add({ kind, lane: 0, z: 14, len: kind === 'cones' ? 0.5 : 0.6, w: 0.9, h: kind === 'cones' ? 0.4 : 1.5, dir: 1 }); }, kind);
    await key('ArrowUp'); await run(2);
    ok((await S()).mode === 'play', 'boost smashes through ' + kind);
  }
  await fresh(); await p.evaluate(() => __laneRunnerDebug.add({ kind: 'cones', lane: 0, z: 10, len: 0.5, w: 0.9, h: 0.4 })); await run(2);
  ok((await S()).mode === 'over', 'cones still wreck you without boost');
  await fresh(); await p.evaluate(() => { __laneRunner.boost = 3; __laneRunnerDebug.addCar(0, 14); });
  await key('ArrowUp'); await run(3);
  ok((await S()).mode === 'over', 'boost does not smash cars');

  // Trick ramps: launch into slow motion and swipe the combo.
  const KEY = { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown' };
  const toRamp = async () => {
    await fresh();
    await p.evaluate(() => { __laneRunner.objs = []; __laneRunnerDebug.addKicker(0, 8); __laneRunner.objs = __laneRunner.objs.filter((o) => o.kind === 'kicker'); __laneRunnerDebug.addCar(0, 25); });
    for (let i = 0; i < 90 && !(await p.evaluate(() => !!__laneRunner.trick)); i++) await run(1 / 30);
    await run(0.3);
  };
  await toRamp();
  let tr = await p.evaluate(() => ({ trick: !!__laneRunner.trick, slow: __laneRunner.slow, y: __laneRunner.y, car: __laneRunner.objs.some((o) => o.kind === 'car') }));
  ok(tr.trick && tr.slow < 0.6 && tr.y > 1, 'trick ramp launches into slow motion ' + JSON.stringify(tr));
  ok(!tr.car, 'traffic clears out of the landing zone');
  await shot('8-trick');
  const seq = await p.evaluate(() => __laneRunner.trick.seq);
  for (const d of seq) { await key(KEY[d]); await run(0.05); }
  await shot('9-trick-done');
  tr = await p.evaluate(() => ({ state: __laneRunner.trick.state, chain: __laneRunner.chain, boost: __laneRunner.boost, lane: __laneRunner.lane }));
  ok(tr.state === 'done' && tr.chain === 1 && tr.boost >= 1.9 && tr.lane === 0, 'perfect combo: style chain + boost, no steering in the air ' + JSON.stringify(tr));
  await run(3);
  ok((await S()).mode === 'play' && (await S()).y === 0, 'lands safely after a perfect combo');

  await toRamp();
  await p.evaluate(() => { __laneRunner.chain = 2; });
  const wrong = await p.evaluate(() => ({ left: 'right', right: 'left', up: 'down', down: 'up' })[__laneRunner.trick.seq[0]]);
  await key(KEY[wrong]); await run(0.05);
  tr = await p.evaluate(() => ({ state: __laneRunner.trick.state, chain: __laneRunner.chain }));
  ok(tr.state === 'fail' && tr.chain === 0, 'wrong swipe breaks the combo and the style chain ' + JSON.stringify(tr));
  await run(3); ok((await S()).mode === 'play', 'lands safely after a broken combo');

  await toRamp(); await run(6);
  tr = await p.evaluate(() => ({ trick: __laneRunner.trick && __laneRunner.trick.landed, slow: __laneRunner.slow, mode: __laneRunner.mode }));
  ok(tr.mode === 'play' && tr.slow === 1, 'no input: you just land and time speeds back up ' + JSON.stringify(tr));

  // Zones and events.
  await fresh();
  const zones = [];
  for (let zi = 0; zi < 4; zi++) {
    await p.evaluate((zi) => { __laneRunner.dist = zi * 900 + 200; __laneRunnerDebug.update(1 / 30); }, zi);
    zones.push(await p.evaluate(() => __laneRunnerDebug.zoneAt(__laneRunner.dist).name));
    await shot('z' + zi + '-' + zones[zi].split(' ')[0].toLowerCase());
  }
  ok(new Set(zones).size === 4, 'four different zones: ' + zones.join(', '));
  ok(await p.evaluate(() => !!__laneRunner.zoneBanner), 'zone change shows a banner');
  await fresh();
  const ev = await p.evaluate(() => { const s = __laneRunner; s.t = 30; s.nextEvent = 0; __laneRunnerDebug.update(1 / 30); return s.event && s.event.kind; });
  ok(!!ev, 'events start on their own: ' + ev);

  // Trucks.
  await fresh(); await p.evaluate(() => __laneRunnerDebug.addTruck(0, 5, 'ramp'));
  let maxY = 0;
  for (let i = 0; i < 70; i++) { await run(1 / 30); maxY = Math.max(maxY, (await S()).y); if (i === 30) await shot('4-ramp-truck'); }
  ok((await S()).mode === 'play' && maxY >= 0.99, 'drive up a car carrier maxY=' + maxY);
  await fresh(); await p.evaluate(() => __laneRunnerDebug.addTruck(0, 6, 'semi')); await run(4);
  ok((await S()).mode === 'over', 'rear-ending a semi wrecks you');

  // Near miss, horn, power-ups.
  await fresh(); await p.evaluate(() => { __laneRunner.boost = 0; __laneRunnerDebug.addCar(1, 5); }); await run(3);
  s = await S(); ok(s.boost >= 0.15 && s.mode === 'play', 'near miss charges boost ' + JSON.stringify(s));
  await fresh(); await p.evaluate(() => { window.__c = __laneRunnerDebug.addCar(0, 9); });
  await key('Enter'); ok(await p.evaluate(() => __c.mergeTo !== undefined), 'pinch horn makes the car ahead move over');
  await run(3); ok((await S()).mode === 'play', 'car that moved over is not hit');
  await fresh(); await p.evaluate(() => { __laneRunner.pw.nitro = 5; __laneRunnerDebug.addCar(0, 8); });
  await run(1); await shot('5-nitro'); await run(1); ok((await S()).mode === 'play', 'nitro smashes traffic');
  await fresh(); await p.evaluate(() => { __laneRunner.pw.shield = 5; __laneRunnerDebug.addCar(0, 6); }); await run(2);
  ok((await S()).mode === 'play' && !(await p.evaluate(() => __laneRunner.pw.shield)), 'shield absorbs one hit');
  await fresh(); await p.evaluate(() => __laneRunnerDebug.add({ kind: 'power', power: 'turbo', lane: 0, z: 6, h: 0.55 })); await run(1);
  ok((await S()).boost >= 2.9, 'turbo power-up fills boost');

  // Showroom: every model up close.
  await fresh();
  await p.evaluate(() => {
    const d = __laneRunnerDebug, s = __laneRunner; s.road.L.v0 = -2; s.road.R.v0 = 2;
    ['wedge', 'delorean', 'muscle', 'cop', 'van'].forEach((m, i) => { const c = d.addCar(i - 2, 5 + (i % 2) * 5); c.model = m; c.frac = 0.999; });
    const h = d.addCar(0, 17); h.model = 'hatch'; h.frac = 0.999;
    [['semi', -2], ['tanker', 1], ['ramp', 2]].forEach(([k, l]) => { d.addTruck(l, 16, k, 0.999); });
    s.base = 12; s.speed = 12;
  });
  await p.evaluate(() => { for (let i = 0; i < 3; i++) __laneRunnerDebug.update(1 / 30); }); await shot('6-showroom');

  // Soak: natural spawning and lane events with random inputs.
  let wrecks = 0, events = 0, maxT = 0;
  for (let r = 0; r < 12; r++) {
    await p.evaluate(() => __laneRunnerDebug.reset());
    for (let i = 0; i < 500; i++) {
      if (Math.random() < 0.15) await key(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter'][Math.floor(Math.random() * 5)]);
      await run(0.1);
      if ((await S()).mode === 'over') { wrecks++; break; }
    }
    events += await p.evaluate(() => __laneRunner.road.L.ch.length + __laneRunner.road.R.ch.length);
    maxT = Math.max(maxT, await p.evaluate(() => __laneRunner.t));
  }
  console.log('soak: wrecks', wrecks, '/12, longest run', maxT.toFixed(1), 's, pending lane changes seen', events);

  await p.evaluate(() => { __laneRunnerDebug.reset(); __laneRunner.invuln = 1e9; __laneRunner.t = 40; });
  await run(20); await key('ArrowUp'); await run(0.6); await shot('7-traffic');
  const perf = await p.evaluate(() => { const t0 = performance.now(); for (let i = 0; i < 300; i++) __laneRunnerDebug.render(); return (performance.now() - t0) / 300; });
  console.log('avg render ms (desktop):', perf.toFixed(2), 'objs', await p.evaluate(() => __laneRunner.objs.length));
  // Restarting after a wreck reloads the page from the server under a fresh URL and drops straight into a run.
  await fresh(); await p.evaluate(() => __laneRunnerDebug.addCar(0, 6)); await run(3);
  ok((await S()).mode === 'over', 'wrecked before restart');
  await p.clock.runFor(1000);
  await Promise.all([p.waitForNavigation(), key('Enter')]);
  ok(/[?&]v=\d+&go=1$/.test(p.url()) && (await S()).mode === 'play', 'restart reloads a fresh copy into play ' + p.url());
  ok(errs.length === 0, 'no page errors ' + errs.join(' | '));
  await b.close();
})();
