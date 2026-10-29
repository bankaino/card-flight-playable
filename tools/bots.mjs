// bots.mjs — a headless "casual player" funnel for the card flight (one-tap flap). The same SIM.step inputs a finger would produce.
//   node tools/bots.mjs [N=1000] [--k KEY=VAL ...]        (--k overrides SIM.K, so balance can be tuned without editing the game)
// Each bot sees the card through a reaction delay (history buffer), aims at the next gate with noise and a partial lead, taps with a finger
// that cannot repeat faster than ~0.2 s; some bots spam taps, some are slow, a few give up after the first fail. A failed attempt = tap on the
// "retry" card after a pause (SIM.respawn: each retry has wider gaps). Prints the funnel and checks the corridors from SPEC.md / GDD.md.
import { createRequire } from 'node:module';
const SIM = createRequire(import.meta.url)('../live/sim.js');
const { K, DT } = SIM;
const args = process.argv.slice(2), N = +(args.find((a) => /^\d+$/.test(a)) || 1000);
for (let i = 0; i < args.length; i++) if (args[i] === '--k') { const [k, v] = args[i + 1].split('='); K[k] = isNaN(+v) ? v : +v; }
const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

function runBot(seed) {
  const R = rng(seed), U = (a, b) => a + (b - a) * R(), G = () => Math.sqrt(-2 * Math.log(R() + 1e-9)) * Math.cos(2 * Math.PI * R());
  const kind = R() < 0.70 ? 'normal' : R() < 0.5 ? 'spam' : 'slow';                      // 70 % normal, 15 % taps too often, 15 % late
  const p = { react: U(0.12, 0.22) + (kind === 'slow' ? 0.12 : 0), sigma: U(20, 45) * (kind === 'spam' ? 1.5 : 1), lead: 0, low: U(35, 95), look: U(450, 700),
    gap: U(0.17, 0.30), start: U(0.3, 2.4), spam: kind === 'spam' ? U(1.2, 2.6) : 0, wait: U(0.7, 1.6), quit: R() < 0.08 };
  p.lead = p.react * U(0.6, 1.1);
  let S = SIM.spawn(0), attempts = 1, total = 0, hitsAtt = [], failsAtGate = [], taps = 0, prevCy = null;
  for (;;) {
    const hist = [], lag = Math.max(1, Math.round(p.react / DT)); let bias = 0, nextBias = 0, lastTap = -9, retryAt = -1;
    for (let i = 0; i < 60 * 120 && S.end < 0 && !S.retry; i++) {
      const t = S.t, inp = { click: 0 };
      hist.push([S.y, S.vy]); const [oy, ovy] = hist[Math.max(0, hist.length - 1 - lag)];
      if (S.fail >= 0) {                                                                   // stuck: look at the card, then tap to retry (or give up)
        if (p.quit && attempts === 1) break; if (retryAt < 0) retryAt = t + p.wait; if (t >= retryAt) inp.click = 1;
      } else if (S.winT < 0) {
        if (S.firstIn < 0) { if (t > (attempts === 1 ? p.start : 0.6)) inp.click = 1; }
        else {
          const cx = S.sx + K.CARD_X, g = S.gates.find((q) => q.passed < 0), { mid } = SIM.lay();
          if (t >= nextBias) { bias = G() * p.sigma; nextBias = t + 0.4; }
          let ty = mid; if (g) { if (g.x - cx < p.look) { ty = g.cy; prevCy = g.cy; } else ty = prevCy === null ? mid : prevCy; }
          const want = oy + ovy * p.lead > ty + p.low + bias && ovy > -150;
          if (t - lastTap > p.gap && (want || (p.spam && R() < p.spam * DT))) inp.click = 1;
          if (inp.click) taps++;
        }
        if (inp.click) lastTap = t;
      }
      SIM.step(S, inp);
    }
    total += S.t;                                                                            // time from the start of each attempt (incl. the hover before the first tap and the pause on the retry card)
     hitsAtt.push(S.hits);
    if (S.end >= 0 || S.fail < 0 && !S.retry) break;                                       // won (or the loop timed out)
    if (S.fail >= 0 && !S.retry) break;                                                    // gave up
    failsAtGate.push(S.passed); if (attempts >= 6) break;
    S = SIM.respawn(S, 0); attempts++;
  }
  const win = S.endWhy === 'win';
  return { win, attempts, total, hits: hitsAtt, fails: failsAtGate, taps, kind, coins: S.coinsGot, money: S.money, quit: p.quit && !win && attempts === 1 };
}
const med = (a) => { const s = a.filter((x) => x !== null && !isNaN(x)).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const Rs = []; for (let i = 1; i <= N; i++) Rs.push(runBot(i));
const wins = Rs.filter((r) => r.win), pct = (n) => (100 * n / N).toFixed(0) + '%';
const first = Rs.filter((r) => r.win && r.attempts === 1).length / N, within3 = Rs.filter((r) => r.win && r.attempts <= 3).length / N;
const quit = Rs.filter((r) => r.quit).length / N, g1 = Rs.filter((r) => r.fails.length && r.fails[0] === 0).length / N, noTap = Rs.filter((r) => r.taps === 0).length;
const attHits = Rs.filter((r) => r.kind === 'normal').flatMap((r) => r.hits), allHits = Rs.flatMap((r) => r.hits), byKind = {}; Rs.forEach((r) => { const b = byKind[r.kind] || (byKind[r.kind] = [0, 0]); b[1]++; if (r.win && r.attempts === 1) b[0]++; });
const tMed = med(wins.map((r) => r.total)), stats = { first, within3, quit, g1, tMed, hitMed: med(attHits) };
console.log(`bots ${N}: win 1st try ${pct(first * N)} | win ≤3 tries ${pct(within3 * N)} | quit after 1st fail ${pct(quit * N)} | median time to endcard ${tMed.toFixed(1)} s | fail on gate 1 ${pct(g1 * N)} | median hits/attempt ${stats.hitMed} (normal bots; all bots ${med(allHits)}) | coins avg ${(Rs.reduce((a, r) => a + r.coins, 0) / N).toFixed(1)}`);
console.log('1st-try win by kind: ' + Object.entries(byKind).map(([k, [w, n]]) => `${k} ${(100 * w / n).toFixed(0)}%`).join(', ') + `; attempts hist: ` + [1, 2, 3, 4, 5, 6].map((a) => a + ':' + Rs.filter((r) => r.win && r.attempts === a).length).join(' '));
const bad = [], ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad.push(m); };
ok(first >= 0.55 && first <= 0.75, 'win with the first try 55–75 % (' + pct(first * N) + ')');
ok(within3 + quit >= 0.92, 'win within 3 tries ≥ 92 % among those who keep playing (' + pct(within3 * N) + ' + quit ' + pct(quit * N) + ')');
ok(tMed >= 20 && tMed <= 32, 'median time to endcard 20–32 s (' + tMed.toFixed(1) + ')');
ok(g1 <= 0.05, 'fail on gate 1 ≤ 5 % (' + pct(g1 * N) + ')');
ok(stats.hitMed <= 1, 'median hits per attempt of the normal bots ≤ 1 (' + stats.hitMed + ')');
ok(noTap === 0, 'no session without taps (' + noTap + ')');
console.log(bad.length ? 'CORRIDORS FAIL' : 'corridors ok'); process.exit(bad.length ? 1 : 0);
