// Headless checks for lane-runner. Usage: node tests/lane-runner.test.js [screenshot-dir]
const { chromium } = (() => { try { return require('playwright'); } catch { return require('/opt/node22/lib/node_modules/playwright'); } })();
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 600, height: 600 } });
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.clock.install();
  await p.goto('file://' + require('path').resolve(__dirname, '../lane-runner/index.html'));
  const SP = process.argv[2] || require('os').tmpdir();
  const shot = async (n) => { await p.evaluate(() => __laneRunnerDebug.render()); await p.screenshot({ path: `${SP}/${n}.png` }); };
  const run = (sec) => p.evaluate((sec) => { for (let i = 0; i < sec * 30; i++) __laneRunnerDebug.update(1 / 30); }, sec);
  const S = () => p.evaluate(() => { const s = __laneRunner; return { mode: s.mode, L: s.L, R: s.R, lane: s.lane, y: +s.y.toFixed(2), score: Math.floor(s.score), coins: s.coins }; });
  const key = (k) => p.keyboard.press(k);
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
  const clean = () => p.evaluate(() => { const s = __laneRunner; s.objs = []; s.nextBlock = 999; s.nextPower = 999; s.sinceRow = -1e9; });

  await run(1); await shot('1-title');
  await key('Enter'); ok((await S()).mode === 'play', 'pinch starts');
  await clean();
  await key('ArrowLeft'); await key('ArrowLeft');
  let s = await S(); ok(s.L === -2 && s.lane === -2, 'steering off left edge paves a lane ' + JSON.stringify(s));
  await key('Enter'); await key('ArrowRight'); s = await S(); ok(s.R === 2 && s.lane === -2, 'pinch+right opens right lane');
  await key('ArrowDown'); await key('ArrowLeft'); s = await S(); ok(s.L === -1 && s.lane === -1, 'down+left closes left lane and shoves player');
  await key('ArrowDown'); await key('ArrowLeft'); await key('ArrowDown'); await key('ArrowLeft'); s = await S();
  ok(s.R - s.L + 1 === 3, 'cannot go below 3 lanes ' + JSON.stringify(s));
  for (let i = 0; i < 8; i++) { await key('Enter'); await key('ArrowRight'); }
  s = await S(); ok(s.R - s.L + 1 === 8, 'max 8 lanes ' + JSON.stringify(s));
  // shift road right repeatedly
  await p.evaluate(() => __laneRunnerDebug.reset()); await clean();
  for (let i = 0; i < 4; i++) { await key('Enter'); await key('ArrowRight'); await key('ArrowDown'); await key('ArrowLeft'); }
  s = await S(); ok(s.L === 3 && s.R === 5 && s.lane === 3, 'road can drift right forever ' + JSON.stringify(s));
  await run(0.5); await shot('2-drifted');

  // crash into a car
  await p.evaluate(() => { __laneRunnerDebug.reset(); }); await clean();
  await p.evaluate(() => __laneRunnerDebug.addCar(0, 6));
  await run(3); ok((await S()).mode === 'over', 'hitting a car wrecks you');
  await shot('3-wrecked');

  // ramp truck ride
  await p.evaluate(() => __laneRunnerDebug.reset()); await clean();
  await p.evaluate(() => { const t = __laneRunnerDebug.addTruck(0, 5, true); });
  let maxY = 0;
  for (let i = 0; i < 60; i++) { await run(1/30); const q = await S(); maxY = Math.max(maxY, q.y); if (i === 25) await shot('4-on-ramp-truck'); }
  s = await S(); ok(s.mode === 'play' && maxY >= 0.99, 'drive up a ramp truck and off again maxY=' + maxY + ' ' + JSON.stringify(s));

  // box truck: jump onto it
  await p.evaluate(() => __laneRunnerDebug.reset()); await clean();
  await p.evaluate(() => __laneRunnerDebug.addTruck(0, 6, false));
  let jumped = false; maxY = 0;
  for (let i = 0; i < 90; i++) {
    const z = await p.evaluate(() => __laneRunner.objs.find(o => o.kind === 'truck')?.z ?? -99);
    if (!jumped && z < 2.6) { await key('ArrowUp'); jumped = true; }
    await run(1/30); maxY = Math.max(maxY, (await S()).y);
  }
  s = await S(); ok(s.mode === 'play' && maxY >= 1.19, 'jump onto a box truck roof maxY=' + maxY + ' ' + JSON.stringify(s));
  // box truck without jumping crashes
  await p.evaluate(() => __laneRunnerDebug.reset()); await clean();
  await p.evaluate(() => __laneRunnerDebug.addTruck(0, 6, false)); await run(3);
  ok((await S()).mode === 'over', 'hitting a box truck rear wrecks you');

  // nitro smash & shield
  await p.evaluate(() => { __laneRunnerDebug.reset(); }); await clean();
  await p.evaluate(() => { __laneRunner.pw.nitro = 5; __laneRunnerDebug.addCar(0, 8); });
  await run(1.2); await shot('5-nitro'); await run(1); ok((await S()).mode === 'play', 'nitro smashes traffic');
  await p.evaluate(() => { __laneRunnerDebug.reset(); }); await clean();
  await p.evaluate(() => { __laneRunner.pw.shield = 5; __laneRunnerDebug.addCar(0, 6); }); await run(2);
  ok((await S()).mode === 'play' && !(await p.evaluate(() => __laneRunner.pw.shield)), 'shield absorbs one hit');

  // power pickup
  await p.evaluate(() => { __laneRunnerDebug.reset(); }); await clean();
  await p.evaluate(() => __laneRunnerDebug.add({ kind: 'power', power: 'magnet', lane: 0, z: 6, h: 0.55 })); await run(1);
  ok(await p.evaluate(() => __laneRunner.pw.magnet > 0), 'picking up a power-up activates it');

  // barricade: stay put -> crash; pave -> survive
  await p.evaluate(() => { __laneRunnerDebug.reset(); }); await clean();
  await p.evaluate(() => __laneRunnerDebug.spawnBlock()); await run(2); await shot('6-roadblock');
  await run(4); ok((await S()).mode === 'over', 'roadblock wrecks you if you stay');
  await p.evaluate(() => { __laneRunnerDebug.reset(); }); await clean();
  await p.evaluate(() => __laneRunnerDebug.spawnBlock()); await run(1);
  await key('ArrowLeft'); await key('ArrowLeft'); await run(5);
  ok((await S()).mode === 'play', 'paving around the roadblock survives');

  // soak: natural spawning, random inputs, many runs
  let wrecks = 0, maxT = 0;
  for (let r = 0; r < 20; r++) {
    await p.evaluate(() => __laneRunnerDebug.reset());
    for (let i = 0; i < 400; i++) {
      const k = ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter'][Math.floor(Math.random()*5)];
      if (Math.random() < 0.15) await key(k);
      await run(0.1);
      if ((await S()).mode === 'over') { wrecks++; break; }
    }
    maxT = Math.max(maxT, await p.evaluate(() => __laneRunner.t));
  }
  console.log('soak: wrecks', wrecks, '/20, longest run', maxT.toFixed(1), 's');
  // gameplay screenshot with traffic, 5 lanes
  await p.evaluate(() => __laneRunnerDebug.reset());
  await p.evaluate(() => { __laneRunner.invuln = 999; __laneRunner.pw.magnet = 8; __laneRunner.pw.hydro = 6; });
  await key('Enter'); await key('ArrowRight'); await key('Enter'); await key('ArrowLeft');
  await run(14); await shot('7-traffic');
  const perf = await p.evaluate(() => { const t0 = performance.now(); for (let i = 0; i < 300; i++) __laneRunnerDebug.render(); return (performance.now() - t0) / 300; });
  console.log('avg render ms (desktop):', perf.toFixed(2), 'objs', await p.evaluate(() => __laneRunner.objs.length));
  ok(errs.length === 0, 'no page errors ' + errs.join(' | '));
  await b.close();
})();
