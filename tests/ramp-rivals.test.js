// Headless checks for ramp-rivals. Usage: node tests/ramp-rivals.test.js [screenshot-dir]
const { chromium } = (() => { try { return require('playwright'); } catch { return require('/opt/node22/lib/node_modules/playwright'); } })();
const path = require('path');

(async () => {
  const SP = process.argv[2] || require('os').tmpdir();
  const URL = 'file://' + path.resolve(__dirname, '../ramp-rivals/index.html');
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 600, height: 600 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.clock.install();
  await p.goto(URL + '?noreload=1');
  await p.clock.pauseAt(await p.evaluate(() => Date.now() + 50)); // freeze rAF; the test drives update() itself

  const shot = async (n) => { await p.evaluate(() => __rampRivalsDebug.render()); await p.screenshot({ path: `${SP}/${n}.png` }); };
  const run = (sec) => p.evaluate((sec) => { for (let i = 0; i < Math.round(sec * 30); i++) __rampRivalsDebug.update(1 / 30); }, sec);
  const S = () => p.evaluate(() => { const s = __rampRivals, P = s.P; return { mode: s.mode, lane: P.lane, d: +P.d.toFixed(2), v: +P.v.toFixed(2), boosts: P.boosts, coins: P.coins, spin: P.spinT > 0, pos: P.pos, y: +P.y.toFixed(2) }; });
  const key = (k) => p.keyboard.press(k);
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
  const KEY = { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown' };
  // A race already under way on a quiet stretch: rivals parked far behind, nothing on the road near you.
  const fresh = (m = 0, l = 0, at = 400) => p.evaluate(([m, l, at]) => {
    const D = __rampRivalsDebug, s = __rampRivals;
    D.startRace(m, l);
    for (let i = 0; i < 100; i++) D.update(1 / 30);
    const T = D.track();
    T.items = T.items.filter((o) => o.s < at - 40 || o.s > at + 120);
    T.ramps = T.ramps.filter((o) => o.s < at - 40 || o.s > at + 120);
    s.racers.forEach((r, i) => { r.s = i ? at - 200 - i * 3 : at; r.v = i ? 0 : 26; r.ii = 0; r.trail = []; r.boostT = 0; r.skill = i ? 0.001 : 1; r.attackCD = 1e9; });
    s.P.lane = 3; s.P.d = -0.5; s.P.boosts = 1; s.P.coins = 0;
    for (let i = 0; i < 3; i++) D.update(1 / 30);
  }, [m, l, at]);
  // Put a rival next to (ds = 0), ahead of (ds > 0) or behind (ds < 0) you in a lane, at a speed.
  const rival = (i, lane, ds, v, extra = {}) => p.evaluate(([i, lane, ds, v, extra]) => {
    const s = __rampRivals, r = s.racers[i];
    Object.assign(r, { lane, prevLane: lane, d: lane - 3.5, s: s.P.s + ds, v, skill: v / 26, coins: 0, rb: 1, invuln: 0, spinT: 0, boostT: 0, ramming: false, attack: null, charge: null, attackCD: 1e9, thinkT: 1e9 }, extra);
  }, [i, lane, ds, v, extra]);

  // ---- Title, menu, countdown ----
  await run(1); await shot('1-title');
  await key('Enter'); await run(0.5);
  ok((await S()).mode === 'menu', 'pinch opens the race menu');
  await key('ArrowRight'); await key('ArrowDown'); await run(0.5);
  let sel = await p.evaluate(() => __rampRivals.sel);
  ok(sel.m === 1 && sel.l === 1, 'menu: ← → picks the map, ↑ ↓ picks the track ' + JSON.stringify(sel));
  await shot('2-menu');
  await key('ArrowLeft'); await key('ArrowUp'); await run(0.3);
  sel = await p.evaluate(() => __rampRivals.sel);
  ok(sel.m === 0 && sel.l === 2, 'menu wraps round (← back to map 1, ↑ from the first track to the last) ' + JSON.stringify(sel));
  await key('Enter'); await run(1);
  const grid = await p.evaluate(() => ({ mode: __rampRivals.mode, n: __rampRivals.racers.length, lanes: [...new Set(__rampRivals.racers.map((r) => r.lane))].length, moving: __rampRivals.racers.some((r) => r.v > 0) }));
  ok(grid.mode === 'count' && grid.n === 8 && grid.lanes === 8 && !grid.moving, 'countdown: 8 racers side by side, one per lane, waiting ' + JSON.stringify(grid));
  await shot('3-countdown');
  await run(1.85); await key('ArrowUp'); await run(0.5);
  let s = await S();
  ok(s.mode === 'race' && s.v > 20, 'swipe up on GO: rocket start ' + JSON.stringify(s));
  await p.evaluate(() => { __rampRivalsDebug.startRace(0, 0); }); await run(3.5);
  const normal = (await S()).v;
  await p.evaluate(() => { __rampRivalsDebug.startRace(0, 0); }); await run(1.0); await key('ArrowUp'); await run(2.5);
  s = await S();
  ok(s.v < normal - 5, 'swipe up too early: you stall at GO ' + normal + ' vs ' + s.v);

  // ---- Controls ----
  await fresh();
  await key('ArrowLeft'); await run(0.4);
  s = await S(); ok(s.lane === 2 && s.d === -1.5, 'swipe left changes lane ' + JSON.stringify(s));
  await key('ArrowRight'); await key('ArrowRight'); await run(0.4);
  s = await S(); ok(s.lane === 4, 'swipe right changes lane');
  await p.evaluate(() => { const P = __rampRivals.P; P.lane = 7; P.d = 3.5; });
  await key('ArrowRight'); await run(0.3);
  s = await S(); ok(s.lane === 7, 'cannot steer off the road');
  await fresh(); await run(1);
  const cruise = (await S()).v;
  await key('ArrowDown'); await run(0.5);
  s = await S(); ok(s.v < cruise - 5 && s.v > 8, 'swipe down slows you down (still rolling) ' + cruise + ' → ' + s.v);
  await run(2); ok((await S()).v > cruise - 1, 'and you pick back up');
  await fresh(); await run(0.5);
  await key('ArrowUp'); await run(0.4);
  s = await S(); ok(s.boosts === 0 && s.v > cruise * 1.3, 'swipe up spends a boost ' + JSON.stringify(s));
  await run(3); await key('ArrowUp'); await run(0.4);
  s = await S(); ok(s.boosts === 0 && s.v < cruise * 1.1, 'no boost without a charge');
  const cells = await p.evaluate(() => {
    const s = __rampRivals, T = __rampRivalsDebug.track(), P = s.P;
    for (let i = 0; i < 4; i++) T.items.push({ kind: 'cell', s: P.s + 6 + i * 6, d: P.d, h: 0.5, dead: false, back: 0, born: -9 });
    T.items.sort((a, b) => a.s - b.s); P.ii = 0;
    for (let i = 0; i < 60; i++) __rampRivalsDebug.update(1 / 30);
    return P.boosts;
  });
  ok(cells === 3, 'boost cells give charges, up to 3 (' + cells + ')');

  // ---- Coins ----
  await fresh();
  const coins = await p.evaluate(() => {
    const s = __rampRivals, D = __rampRivalsDebug, T = D.track(), P = s.P, top0 = D.topSpeed(P);
    for (let i = 0; i < 14; i++) T.items.push({ kind: 'coin', s: P.s + 5 + i * 1.7, d: P.d, h: 0.35, dead: false, back: 0, born: -9 });
    T.items.sort((a, b) => a.s - b.s); P.ii = 0;
    for (let i = 0; i < 45; i++) D.update(1 / 30);
    const top10 = D.topSpeed(P), n = P.coins;
    D.spinOut(P, null, 'wall');
    return { n, gain: top10 / top0, after: P.coins };
  });
  ok(coins.n === 10 && Math.abs(coins.gain - 1.25) < 0.01, 'coins raise top speed 2.5% each, capped at 10 ' + JSON.stringify(coins));
  ok(coins.after === 7, 'a spin-out knocks 3 coins loose');

  // ---- Bumping ----
  await fresh(); await rival(1, 4, 0.2, 24);
  let bump = await p.evaluate(() => { const s = __rampRivals, P = s.P, r = s.racers[1]; P.v = 30; __rampRivalsDebug.tryLane(P, 1); return { lane: P.lane, rv: +r.v.toFixed(2) }; });
  ok(bump.lane === 3 && bump.rv < 22, 'moving into a lane with a rival alongside: you bump them, stay put, and (faster) slow them ' + JSON.stringify(bump));
  await run(0.1); await shot('4-bump');
  await fresh(); await rival(1, 4, 0.2, 29);
  bump = await p.evaluate(() => { const s = __rampRivals, P = s.P, r = s.racers[1]; P.v = 24; __rampRivalsDebug.tryLane(P, 1); return { lane: P.lane, rv: +r.v.toFixed(2) }; });
  ok(bump.lane === 3 && bump.rv === 29, 'slower than them: blocked, no knock ' + JSON.stringify(bump));
  await fresh(); await rival(1, 4, 0.2, 24);
  bump = await p.evaluate(() => { const s = __rampRivals, P = s.P, r = s.racers[1]; P.v = 30; P.boostT = 1; __rampRivalsDebug.tryLane(P, 1); return { lane: P.lane, spin: r.spinT > 0 }; });
  ok(bump.lane === 3 && bump.spin, 'boosting into them from the side spins them out');
  await fresh(); await rival(1, 3, 6, 20);
  const ram = await p.evaluate(() => {
    const s = __rampRivals, D = __rampRivalsDebug, P = s.P, r = s.racers[1];
    P.boosts = 1; D.useBoost(P);
    let t = 0; while (r.spinT <= 0 && t++ < 60) D.update(1 / 30);
    return { spin: r.spinT > 0, lane: r.lane, pv: +P.v.toFixed(1) };
  });
  ok(ram.spin && ram.lane !== 3, 'boosting into the back of a rival knocks them flying into another lane ' + JSON.stringify(ram));
  await fresh(); await rival(1, 3, 3, 18);
  const rear = await p.evaluate(() => { const s = __rampRivals, D = __rampRivalsDebug, P = s.P, r = s.racers[1]; P.v = 30; let lo = 99; for (let i = 0; i < 20; i++) { D.update(1 / 30); lo = Math.min(lo, P.v); } return { pv: +lo.toFixed(1), spin: r.spinT > 0, gap: +(r.s - P.s).toFixed(2) }; });
  ok(!rear.spin && rear.pv < 18 && rear.gap >= 0.99, 'running into the back of someone without boost just costs you speed ' + JSON.stringify(rear));

  // Rivals do it back: a faster rival alongside winds up (claws out, red arrows), then bumps you.
  await fresh(); await rival(2, 4, 0.1, 24, { aggro: 1, attackCD: 0, thinkT: 0, boosts: 0 });
  await p.evaluate(() => { __rampRivals.raceT = 10; __rampRivals.P.v = 22; __rampRivals.P.skill = 22 / 26; });
  // The wind-up is a dice roll (70% per look for a max-aggro rival); load the dice so the check is deterministic.
  let atk = await p.evaluate(() => {
    const R = Math.random; Math.random = () => 0.05;
    try { for (let i = 0; i < 6; i++) __rampRivalsDebug.update(1 / 30); } finally { Math.random = R; }
    const r = __rampRivals.racers[2]; return { attack: !!r.attack, threats: __rampRivalsDebug.threats() };
  });
  ok(atk.attack && atk.threats === 1, 'a faster rival alongside telegraphs a side swipe ' + JSON.stringify(atk));
  await shot('5-attack');
  atk = await p.evaluate(() => {
    const s = __rampRivals; let lo = 99;
    for (let i = 0; i < 21; i++) { __rampRivalsDebug.update(1 / 30); lo = Math.min(lo, s.P.v); }
    return { v: +lo.toFixed(1), lane: s.P.lane, hit: s.stats.hitBy };
  });
  ok(atk.lane === 3 && atk.hit === 1 && atk.v < 20, 'then bumps you: you stay in lane but get knocked ' + JSON.stringify(atk));

  // An aggressive rival with a boost comes for you from behind (a ram, or a charge up the next lane).
  await fresh(); await rival(5, 4, -5, 26, { aggro: 1, boosts: 1, attackCD: 0, thinkT: 0 });
  const hunted = await p.evaluate(() => {
    const s = __rampRivals, D = __rampRivalsDebug; s.raceT = 10;
    let warned = false, t = 0;
    while (s.P.spinT <= 0 && t++ < 120) { D.update(1 / 30); if (D.threats()) warned = true; }
    return { spun: s.P.spinT > 0, warned, secs: +(t / 30).toFixed(2), toast: s.toast && s.toast.text };
  });
  ok(hunted.spun && hunted.warned, 'a rival with a boost hunts you down (flagged in the rear warning first) ' + JSON.stringify(hunted));

  // Rear warnings: whoever is coming up behind shows under their lane; a boosting one is a threat.
  await fresh(); await rival(3, 5, -10, 26); await rival(4, 3, -8, 36, { boostT: 2, ramming: true, thinkT: 1e9 });
  const th = await p.evaluate(() => __rampRivalsDebug.threats());
  ok(th === 1, 'a rival boosting up behind you in your lane is flagged as a threat (' + th + ')');
  await run(0.1); await shot('6-rear-warning');

  // ---- Slipstream ----
  await fresh(); await rival(1, 3, 5, 25.5, { skill: 25.5 / 26 });
  const draft = await p.evaluate(() => {
    const s = __rampRivals, D = __rampRivalsDebug, P = s.P;
    P.skill = 0.98;
    let t = 0; while (P.draftT <= 0 && t++ < 90) D.update(1 / 30);
    return { fired: P.draftT > 0, t: +(t / 30).toFixed(2) };
  });
  ok(draft.fired && draft.t < 1.6, 'tucked in behind a rival: slipstream fires ' + JSON.stringify(draft));
  await shot('7-slipstream');

  // ---- Tricks (the Lane Runner combo) ----
  const toRamp = async () => {
    await fresh();
    await p.evaluate(() => { const s = __rampRivals, T = __rampRivalsDebug.track(), P = s.P; T.ramps.push({ kind: 'ramp', s: P.s + 8, d: P.d, lane: P.lane }); T.ramps.sort((a, b) => a.s - b.s); });
    for (let i = 0; i < 60 && !(await p.evaluate(() => !!__rampRivals.trick)); i++) await run(1 / 30);
    await run(0.3);
  };
  await toRamp();
  let tr = await p.evaluate(() => ({ trick: !!__rampRivals.trick, slow: +__rampRivals.slow.toFixed(2), y: __rampRivals.P.y, n: __rampRivals.trick && __rampRivals.trick.seq.length }));
  ok(tr.trick && tr.slow < 0.6 && tr.y > 1 && tr.n === 3, 'driving over a ramp launches you into slow-mo with a swipe combo ' + JSON.stringify(tr));
  await shot('8-trick');
  const seq = await p.evaluate(() => __rampRivals.trick.seq);
  const lane0 = (await S()).lane;
  for (const d of seq) { await key(KEY[d]); await run(0.05); }
  await shot('9-perfect');
  tr = await p.evaluate(() => ({ state: __rampRivals.trick.state, chain: __rampRivals.chain, boosts: __rampRivals.P.boosts, lane: __rampRivals.P.lane }));
  ok(tr.state === 'done' && tr.chain === 1 && tr.boosts === 2 && tr.lane === lane0, 'perfect combo: +1 boost and a style chain, no steering in the air ' + JSON.stringify(tr));
  await run(1.5);
  tr = await p.evaluate(() => ({ land: __rampRivals.P.landT > 0, mul: __rampRivals.P.landMul, y: __rampRivals.P.y, slow: __rampRivals.slow }));
  ok(tr.land && tr.mul > 1.3 && tr.y === 0 && tr.slow === 1, 'lands with a landing boost ' + JSON.stringify(tr));
  await toRamp();
  await p.evaluate(() => { __rampRivals.chain = 2; });
  const wrong = await p.evaluate(() => ({ left: 'right', right: 'left', up: 'down', down: 'up' })[__rampRivals.trick.seq[0]]);
  await key(KEY[wrong]); await run(0.05);
  tr = await p.evaluate(() => ({ state: __rampRivals.trick.state, chain: __rampRivals.chain }));
  ok(tr.state === 'fail' && tr.chain === 0, 'wrong swipe breaks the combo and the style chain ' + JSON.stringify(tr));
  await run(3); ok((await S()).y === 0 && (await S()).mode === 'race', 'lands safely after a broken combo');
  await toRamp(); await run(6);
  tr = await p.evaluate(() => ({ trick: __rampRivals.trick, slow: __rampRivals.slow }));
  ok(!tr.trick && tr.slow === 1, 'no input: you just land and time speeds back up');

  // ---- Firewalls ----
  await fresh();
  let fw = await p.evaluate(() => { const s = __rampRivals, T = __rampRivalsDebug.track(), P = s.P; T.items.push({ kind: 'barrier', s: P.s + 6, d: P.d, h: 0.95, dead: false, back: 0, born: -9 }); T.items.sort((a, b) => a.s - b.s); P.ii = 0; for (let i = 0; i < 20; i++) __rampRivalsDebug.update(1 / 30); return P.spinT > 0; });
  ok(fw, 'driving into a firewall spins you out');
  await fresh();
  fw = await p.evaluate(() => { const s = __rampRivals, T = __rampRivalsDebug.track(), P = s.P; T.items.push({ kind: 'barrier', s: P.s + 8, d: P.d, h: 0.95, dead: false, back: 0, born: -9 }); T.items.sort((a, b) => a.s - b.s); P.ii = 0; P.boosts = 1; __rampRivalsDebug.useBoost(P); for (let i = 0; i < 20; i++) __rampRivalsDebug.update(1 / 30); return P.spinT > 0; });
  ok(!fw, 'boosting smashes straight through a firewall');

  // ---- Tracks ----
  const tracks = await p.evaluate(() => {
    const D = __rampRivalsDebug, out = [];
    for (let m = 0; m < 3; m++) for (let l = 0; l < 3; l++) {
      const T = D.buildTrack(m, l), g = D.geometry(m, l);
      let minR = Infinity, close = Infinity;
      for (let i = 80; i < 80 + g.finish; i++) if (Math.abs(g.K[i]) > 1e-6) minR = Math.min(minR, 1 / Math.abs(g.K[i]));
      // the road never comes near itself: other parts of the track stay well clear
      for (let i = 80; i < 80 + g.finish; i += 6) for (let j = i + 150; j < 80 + g.finish; j += 6) close = Math.min(close, Math.hypot(g.X[i] - g.X[j], g.Z[i] - g.Z[j]));
      const k = (kind) => T.items.filter((o) => o.kind === kind).length;
      out.push({ lvl: `${m + 1}-${l + 1}`, len: g.finish, minR: Math.round(minR), close: Math.round(close), ramps: T.ramps.length, cells: k('cell'), coins: k('coin'), pads: k('pad'), walls: k('barrier') });
    }
    return out;
  });
  for (const t of tracks) {
    ok(t.minR >= 150 && t.close > 30 && t.ramps >= 8 && t.cells >= 20 && t.coins >= 60, `track ${t.lvl}: wide turns, clear of itself, stocked ` + JSON.stringify(t));
  }

  // ---- No pop-in: things fade in from the draw distance, and anything taken grows back in ----
  const pop = await p.evaluate(() => {
    const D = __rampRivalsDebug, s = __rampRivals, c = D.consts;
    D.startRace(0, 0); for (let i = 0; i < 120; i++) D.update(1 / 30);
    const cam = D.cam(), T = D.track();
    // the fade D draws with: 0 at the draw distance, 1 FADE units closer
    const fade = (ds) => Math.min(1, Math.max(0, (cam.s + c.VIEW - ds) / c.FADE));
    const far = T.items.filter((o) => o.s > cam.s + c.VIEW - 5 && o.s < cam.s + c.VIEW);
    return { atEdge: fade(cam.s + c.VIEW), inside: fade(cam.s + c.VIEW - c.FADE), farAlpha: far.map((o) => fade(o.s)).reduce((a, b) => Math.max(a, b), 0) };
  });
  ok(pop.atEdge === 0 && pop.inside === 1 && pop.farAlpha < 0.1, 'no pop-in: objects fade in over the last stretch of the draw distance ' + JSON.stringify(pop));

  // ---- A whole race on autopilot: everyone finishes, results show, best is saved ----
  const full = await p.evaluate(() => {
    const D = __rampRivalsDebug, s = __rampRivals;
    try { localStorage.removeItem('rampRivals.best'); } catch {}
    s.best = {};
    D.startRace(0, 0); s.autoSkill = 1; s.P.auto = true;
    let i = 0;
    while (i++ < 30 * 150 && !(s.mode === 'results' && s.racers.every((r) => r.finished))) D.update(1 / 30);
    return { mode: s.mode, fin: s.racers.filter((r) => r.finished).length, place: s.P.place, t: +s.P.finishT.toFixed(1), best: s.best['0-0'] };
  });
  ok(full.mode === 'results' && full.fin === 8 && full.best && full.best.place === full.place, 'full race: all 8 finish, results screen, best saved ' + JSON.stringify(full));
  await run(1.5); await shot('10-results');
  await key('ArrowDown'); await run(0.2);
  ok((await S()).mode === 'count', 'results: swipe down retries');
  await p.evaluate(() => { const s = __rampRivals; s.mode = 'results'; s.resultsAt = s.ui - 2; });
  await key('Enter'); await run(0.2);
  sel = await p.evaluate(() => ({ mode: __rampRivals.mode, ...__rampRivals.sel }));
  ok(sel.mode === 'count' && sel.m === 0 && sel.l === 1, 'results: pinch goes to the next race ' + JSON.stringify(sel));
  await key('Enter'); await run(0.1);
  ok((await S()).mode === 'paused', 'pinch mid-race pauses');
  await key('Enter'); await run(0.1);
  ok((await S()).mode === 'count', 'pinch again resumes');

  // ---- v2: low-poly 3D racers, a lean HUD, personal pick-ups, rivals that are a real race ----
  const models = await p.evaluate(() => { const M = __rampRivalsDebug.models, n = (m) => m.parts.reduce((a, q) => a + q.faces.length, 0); return { hero: n(M.HERO), bug: n(M.BUG) }; });
  ok(models.hero > 50 && models.bug > 40, 'racers are low-poly 3D models ' + JSON.stringify(models));
  await fresh(); await run(1); await rival(1, 4, 3, 26); await rival(2, 2, 8, 26);
  const lean = await p.evaluate(() => {
    const D = __rampRivalsDebug, P = CanvasRenderingContext2D.prototype, f = P.fillText; let texts = 0;
    P.fillText = function (...a) { texts++; return f.apply(this, a); };
    D.render(); P.fillText = f;
    return { faces: D.DBG.faces, texts };
  });
  ok(lean.faces > 40, 'the racers on screen are drawn as shaded 3D faces (' + lean.faces + ')');
  ok(lean.texts <= 5, 'lean HUD: position, coins and speed are the only words on screen mid-race (' + lean.texts + ' text draws)');
  await shot('10b-lean-hud');
  await fresh(); await rival(1, 5, 3, 26);
  const personal = await p.evaluate(() => {
    const s = __rampRivals, D = __rampRivalsDebug, T = D.track(), P = s.P, r = s.racers[1];
    const c = { kind: 'coin', s: r.s + 4, d: r.d, h: 0.35, dead: false, back: 0, born: -9, taken: 0 };
    T.items.push(c); T.items.sort((a, b) => a.s - b.s); r.ii = 0; P.ii = 0; r.coins = 0; P.coins = 0;
    for (let i = 0; i < 30; i++) D.update(1 / 30);
    const after = { rival: r.coins, still: !c.dead };
    P.lane = 5; P.d = 1.5; P.s = c.s - 6; P.ii = 0;
    for (let i = 0; i < 20; i++) D.update(1 / 30);
    return { ...after, you: P.coins, gone: c.dead };
  });
  ok(personal.rival === 1 && personal.still && personal.you === 1 && personal.gone, 'coins are personal: a rival takes its own and yours is still there ' + JSON.stringify(personal));
  const race = await p.evaluate(() => {
    const D = __rampRivalsDebug, s = __rampRivals, out = {}, R = Math.random;
    // Whole races are full of dice rolls; a seeded generator keeps this check repeatable (sims cover the spread).
    let a = 20260927;
    Math.random = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    for (const idle of [false, true]) {
      D.startRace(0, 0); s.autoSkill = 0.95; s.P.auto = !idle;
      let i = 0;
      while (i++ < 30 * 150 && !(s.mode === 'results' && s.racers.every((r) => r.finished))) D.update(1 / 30);
      const t = s.racers.map((r) => r.finishT).sort((a, b) => a - b);
      out[idle ? 'idle' : 'auto'] = { place: s.P.place, spread: +(t[7] - t[0]).toFixed(1) };
    }
    Math.random = R;
    return out;
  });
  ok(race.idle.place === 8, 'standing still loses: an idle player finishes last ' + JSON.stringify(race.idle));
  ok(race.auto.spread < 15, 'the rivals keep it tight: the whole field finishes within 15 s ' + JSON.stringify(race.auto));

  // Screens for each map.
  for (const [m, n] of [[0, 'grid-city'], [1, 'solar-canyon'], [2, 'void-rings']]) {
    await p.evaluate((m) => { const D = __rampRivalsDebug, s = __rampRivals; D.startRace(m, 1); s.P.auto = true; for (let i = 0; i < 30 * 14; i++) D.update(1 / 30); }, m);
    await shot('11-' + n);
  }

  // Render cost on a busy frame (let the clock run again so it can be timed).
  await p.clock.resume();
  const perf = await p.evaluate(() => { const t0 = performance.now(); for (let i = 0; i < 200; i++) __rampRivalsDebug.render(); return (performance.now() - t0) / 200; });
  console.log('avg render ms (desktop):', perf.toFixed(2));
  ok(errs.length === 0, 'no page errors ' + errs.join(' | '));

  // ---- Phone: same 600x600 stage fitted to the screen, swipes and taps ----
  const ctx2 = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const m = await ctx2.newPage();
  m.on('pageerror', (e) => errs.push(String(e)));
  await m.goto(URL + '?noreload=1');
  await m.waitForTimeout(300);
  const fit = await m.evaluate(() => { const r = document.getElementById('c').getBoundingClientRect(); return { w: r.width, vw: window.innerWidth, scroll: document.documentElement.scrollWidth }; });
  ok(Math.abs(fit.w - fit.vw) < 1 && fit.scroll <= fit.vw, 'phone: the 600x600 stage fills the screen width, no sideways scroll ' + JSON.stringify(fit));
  const cdp = await ctx2.newCDPSession(m);
  const touch = async (x0, y0, x1, y1) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
    for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + ((x1 - x0) * i) / 6, y: y0 + ((y1 - y0) * i) / 6 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  await touch(195, 420, 195, 420); await m.waitForTimeout(100);
  ok(await m.evaluate(() => __rampRivals.mode === 'menu' && __rampRivals.input === 'tap'), 'phone: tap opens the menu');
  await touch(195, 420, 195, 420); await m.waitForTimeout(100);
  await m.evaluate(() => { const D = __rampRivalsDebug, s = __rampRivals; for (let i = 0; i < 120; i++) D.update(1 / 30); for (const r of s.racers) if (r !== s.P) { r.s -= 80; r.trail = []; } });
  const l0 = await m.evaluate(() => __rampRivals.P.lane);
  await touch(250, 500, 130, 505); await m.waitForTimeout(50);
  const l1 = await m.evaluate(() => __rampRivals.P.lane);
  ok(l1 === l0 - 1, 'phone: swipe left changes lane ' + l0 + ' → ' + l1);
  await touch(200, 520, 200, 380); await m.waitForTimeout(50);
  ok(await m.evaluate(() => __rampRivals.P.boostT > 0), 'phone: swipe up boosts');
  await touch(195, 500, 195, 500); await m.waitForTimeout(50);
  ok(await m.evaluate(() => __rampRivals.mode === 'race'), 'phone: a stray tap mid-race does not pause');
  await m.evaluate(() => { const D = __rampRivalsDebug; for (let i = 0; i < 20; i++) D.update(1 / 30); D.render(); });
  await m.screenshot({ path: `${SP}/12-phone.png` });
  ok(errs.length === 0, 'no page errors on the phone ' + errs.join(' | '));
  await b.close();
})();
