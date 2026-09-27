// Difficulty sims for ramp-rivals: whole races with you on the autopilot (the rivals' own driving, plus tricks swiped
// at 95% accuracy), then again with you idle. Usage: node tests/ramp-rivals.sim.js [trials=20] [tracks=0-0,0-1,...]
// (tracks are map-track, counted from 0; the output labels them 1-1 … 3-3 like the menu).
// Tuned so the autopilot averages about 2-4th on GRID CITY, 4-5th on SOLAR CANYON and 5-6th on VOID RINGS, and an
// idle player finishes last.
const { chromium } = (() => { try { return require('playwright'); } catch { return require('/opt/node22/lib/node_modules/playwright'); } })();
const path = require('path');

(async () => {
  const trials = +(process.argv[2] || 20);
  const tracks = (process.argv[3] || '0-0,0-1,0-2,1-0,1-1,1-2,2-0,2-1,2-2').split(',');
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 600, height: 600 } });
  p.on('pageerror', (e) => console.log('page error: ' + e.stack));
  await p.clock.install();
  await p.goto('file://' + path.resolve(__dirname, '../ramp-rivals/index.html') + '?noreload=1');
  await p.clock.pauseAt(await p.evaluate(() => Date.now() + 50));
  const rows = await p.evaluate(([trials, tracks]) => {
    const D = __rampRivalsDebug, S = __rampRivals, out = [];
    const race = (m, l, auto) => {
      D.startRace(m, l); S.autoSkill = 0.95; S.P.auto = auto;
      if (auto && Math.random() < 0.7) S.P.rocket = true;
      for (let i = 0; i < 30 * 240 && !(S.mode === 'results' && S.racers.every((r) => r.finished)); i++) D.update(1 / 30);
      const t = S.racers.map((r) => r.finishT).sort((a, b) => a - b);
      return { place: S.P.place, you: S.P.finishT, win: t[0], last: t[7] };
    };
    for (const k of tracks) {
      const [m, l] = k.split('-').map(Number), a = [], idle = [];
      for (let i = 0; i < trials; i++) { a.push(race(m, l, true)); idle.push(race(m, l, false).place); }
      const avg = (f) => a.reduce((s, x) => s + f(x), 0) / a.length;
      out.push({ k: `${m + 1}-${l + 1}`, name: D.MAPS[m].levels[l].name, place: avg((x) => x.place), win: avg((x) => x.win), you: avg((x) => x.you), last: avg((x) => x.last), idleLast: idle.filter((x) => x === 8).length / trials });
    }
    return out;
  }, [trials, tracks]);
  console.log('track               autopilot place   winner    you   last   idle player last');
  for (const r of rows) {
    console.log(`${(r.k + ' ' + r.name).padEnd(20)} ${r.place.toFixed(1).padStart(8)}        ${r.win.toFixed(1).padStart(6)}s ${r.you.toFixed(1).padStart(6)}s ${r.last.toFixed(1).padStart(6)}s ${(r.idleLast * 100).toFixed(0).padStart(6)}%`);
  }
  await b.close();
})();
