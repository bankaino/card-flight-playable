// live/sim.js — «Полёт карты» (БАНК) playable ad: deterministic one-tap flight sim, fixed 120 Hz.
// Loop: tap = the card flaps up (gravity pulls it down) → fly through 8 gates of "rival bank" minuses, grabbing cashback coins → lives out =
// retry from gate 1 (each retry a little easier) → doors open after the last gate → finale → endcard. Every reaction lives here; the scene only draws.
(function (root) {
  const DT = 1 / 120, L = 25.0;
  const ASPECT = typeof window !== 'undefined' && window.innerWidth ? window.innerHeight / window.innerWidth : 16 / 9;
  const VIEW = { W: 1080, H: Math.round(1080 * Math.max(16 / 9, Math.min(19.5 / 9, ASPECT))) };
  const HINT = 'tap / click / Space — flap the card · fly through the gaps · grab the coins';
  const K = {
    GATES: 8, GATE_W: 200, GATE_X0: 950, GATE_DX: 780, DOOR_AFTER: 900, DOOR_OPEN_AT: 430,   // world x of gate 1 (on screen at the start), spacing, door distance after the last gate
    CARD_X: 324, HB_W: 232, HB_H: 124,                                                       // card screen x (0.30 W), forgiving hitbox (the art is 290 × 183)
    GRAV: 3600, FLAP_V: -1150, VMAX: 1500, SPD0: 400, SPD1: 470,                             // px/s², flap impulse (sets vy), world speed at gate 1 → gate 8
    CEIL_Y: 300, FLOOR_PAD: 220, CEIL_MARGIN: 70,                                            // playfield: ceiling line, floor = H - FLOOR_PAD, soft ceiling for the card centre
    GAP: [650, 630, 610, 590, 570, 550, 530, 500], OFF: [0, -0.30, 0.30, -0.40, 0.25, 0.40, -0.45, 0.45],   // the last gates: narrower and with a sharp step
    LIVES: 3, INVUL: 1.2, GRACE: 2.0, HIT_STOP: 0.06, HIT_SLOW: 0.25, FAIL_WAIT: 0.6, FIN_T: 2.7,
    COIN_V: 20, GATE_V: 30, NEAR: 34, V_START: 120, MAG: 90, COIN_R: 36,
    GAP_ADD: 0, OFF_K: 1, MERCY_ATT: 130, MERCY_MAX: 260, MERCY_HITS: 50,                                           // hidden help: +gap per retry (max), +gap after two hits
    DEMO_START: 0.9, DEMO_LOW: 165, DEMO_LOOK: 700, PLUS_CHIPS: true, BONUS: true, CTA_BAR: false, BONUS_MIN: 100, HOOK: 'minus',
    END_NO_INPUT: 1e9, END_IDLE: 1e9, END_MAX: 1e9,                                          // endcard timers are OFF (portfolio); the `adnet` variant turns them on
  };

  const ss = (e0, e1, x) => { const q = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return q * q * (3 - 2 * q); };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lay = () => { const ceil = K.CEIL_Y, floor = VIEW.H - K.FLOOR_PAD; return { ceil, floor, mid: (ceil + floor) / 2, half: (floor - ceil) / 2 }; };
  const lastGateX = () => K.GATE_X0 + (K.GATES - 1) * K.GATE_DX;
  const doorX = () => lastGateX() + K.DOOR_AFTER;
  const speedAt = (cx) => K.SPD0 + (K.SPD1 - K.SPD0) * clamp((cx - K.GATE_X0) / (lastGateX() - K.GATE_X0), 0, 1);

  function create(att = 0) {
    const n = K.GATES, { ceil, floor, mid, half } = lay(), add = Math.min(K.MERCY_MAX, K.MERCY_ATT * att), gates = [], coins = [];
    for (let j = 0; j < n; j++) {
      const di = n === 8 ? j : Math.round(j * 7 / (n - 1)), ci = n === 8 ? j : [0, 2, 3, 4, 7][j];     // difficulty index / content (minus text) index
      const g0 = K.GAP[di] + K.GAP_ADD, A = Math.max(0, Math.min(420, half - (g0 + 110) / 2 - 20));
      gates.push({ i: j, c: ci, x: K.GATE_X0 + j * K.GATE_DX, cy: mid + K.OFF[di] * K.OFF_K * A, gap: g0 + add, passed: -1, hitT: -9 });
    }
    coins.push({ x: gates[0].x - 450, y: mid, got: -1 });                                           // one coin before gate 1, then one in each gap and one between gates: single, far apart
    for (let j = 0; j < n; j++) {
      coins.push({ x: gates[j].x, y: gates[j].cy, got: -1 });
      if (j < n - 1) coins.push({ x: (gates[j].x + gates[j + 1].x) / 2, y: clamp((gates[j].cy + gates[j + 1].cy) / 2 + (j % 2 ? -90 : 90), ceil + 130, floor - 130), got: -1 });
    }
    return { t: 0, steps: 0, wt0: 0, ev: att > 0 ? [{ k: 'retry', t: 0 }] : [], freeze: 0, att, sx: 0, y: mid, vy: 0, rot: 0, v: 0,
      lives: K.LIVES, hits: 0, invT: -9, slowT: -9, money: 0, passed: 0, coinsGot: 0, gates, coins, mercy: 0, streak: 0, lastCoinT: -9,
      firstIn: -1, lastIn: 0, end: -1, endWhy: '', winT: -9, doorT: -9, fail: -9, retry: false, kh: 0 };
  }
  const spawn = (worldT) => Object.assign(create(0), { wt0: worldT });
  const respawn = (S, worldT) => Object.assign(create((S.att || 0) + 1), { wt0: worldT });
  const outOfPlay = (S) => !!S.retry;

  function step(S, inp) {
    const t = S.t + DT; S.t = t; S.steps++;
    if (S.ev.length > 220) S.ev.splice(0, S.ev.length - 220);
    if (S.freeze > 0) { S.freeze -= DT; return S; }
    const { ceil, floor, mid } = lay(), hbh = K.HB_H / 2;
    const key = !!(inp.jump || inp.up || inp.act), flap = !!inp.click || (key && !S.kh); S.kh = key ? 1 : 0;
    const dead = S.fail >= 0, fin = S.winT >= 0, alive = S.end < 0 && !dead && !fin;
    if (flap && S.end < 0) {
      if (dead) { if (t - S.fail > K.FAIL_WAIT) S.retry = true; }
      else if (alive) {
        if (S.firstIn < 0) { S.firstIn = t; S.v = K.V_START; S.ev.push({ k: 'start', t }); }
        S.vy = K.FLAP_V; S.lastIn = t; S.ev.push({ k: 'flap', t, y: S.y });
      }
    }
    const started = S.firstIn >= 0;
    if (S.end < 0) {
      if (!started) { S.y = mid + 18 * Math.sin(t * 2 * Math.PI / 1.7); S.rot = -0.05 + 0.04 * Math.sin(t * 2 * Math.PI / 1.7 + 1); }
      else {
        // ---- world speed: ramps up along the path, halves for a moment after a hit, stops when the card is stuck, eases in the finale ----
        const cx0 = S.sx + K.CARD_X;
        let tv = fin ? 220 : dead ? 0 : speedAt(cx0);
        if (!fin && !dead) tv *= 0.5 + 0.5 * ss(0, K.HIT_SLOW, t - S.slowT);
        S.v += (tv - S.v) * Math.min(1, (dead ? 9 : 6) * DT);
        S.sx += S.v * DT;
        // ---- card: gravity + flap; autopilot to the endcard height in the finale; soft ceiling; floor is a hit ----
        if (fin) { S.y += (K.FIN_Y() - S.y) * Math.min(1, 3.5 * DT); S.vy = 0; S.rot += (0 - S.rot) * Math.min(1, 4 * DT); }
        else {
          S.vy = Math.min(K.VMAX, S.vy + K.GRAV * DT); S.y += S.vy * DT;
          if (dead) S.rot += 5 * DT * (S.y + hbh < floor ? 1 : 0.2); else S.rot += (clamp(S.vy * 0.022, -18, 32) * Math.PI / 180 - S.rot) * Math.min(1, 12 * DT);
        }
        if (S.y < ceil + K.CEIL_MARGIN) { S.y = ceil + K.CEIL_MARGIN; if (S.vy < 0) S.vy = 0; }
        const cx = S.sx + K.CARD_X;
        const hit = (side, g) => {
          if (t - S.invT < K.INVUL) return;
          const free = t - S.firstIn < K.GRACE;
          S.invT = t; S.slowT = t; S.freeze = K.HIT_STOP; S.hits++; if (!free) S.lives--;
          S.vy = side === 'top' ? 450 : side === 'floor' ? -1300 : -900; if (g) g.hitT = t;
          S.ev.push({ k: 'hit', t, side, i: g ? g.i : -1, free, lives: S.lives, x: cx, y: S.y });
          if (S.hits >= 2 && !S.mercy) { S.mercy = 1; for (const q of S.gates) if (q.x - S.sx > VIEW.W + 150) q.gap += K.MERCY_HITS; }
          if (S.lives <= 0) { S.fail = t; S.ev.push({ k: 'fail', t, x: cx, y: S.y, passed: S.passed }); }
        };
        if (!fin && !dead && S.passed < K.GATES && S.y + hbh > floor) hit('floor', null);   // after the last gate the run to the doors is safe
        if (dead && S.y + hbh > floor) { S.y = floor - hbh; S.vy = 0; }
        // ---- gates: collision, pass bonus ----
        for (const g of S.gates) {
          if (!fin && S.fail < 0 && Math.abs(g.x - cx) < K.GATE_W / 2 + K.HB_W / 2) {
            const cT = S.y - hbh - (g.cy - g.gap / 2), cB = g.cy + g.gap / 2 - (S.y + hbh);                                  // clearance to the gap edges
            if (cT < 0) hit('top', g); else if (cB < 0) hit('bot', g);
            else if (g.hitT < 0) { const m = Math.min(cT, cB); if (g.minC === undefined || m < g.minC) { g.minC = m; g.minSide = cT < cB ? 'top' : 'bot'; } }
          }
          if (g.passed < 0 && cx > g.x + K.GATE_W / 2) {
            g.passed = t; S.passed++; S.money += K.GATE_V;
            S.ev.push({ k: 'gate', t, i: g.i, c: g.c, x: cx, y: S.y, sx: S.sx, v: K.GATE_V, clean: g.hitT < 0, n: S.passed });
            if (g.hitT < 0 && g.minC !== undefined && g.minC < K.NEAR) S.ev.push({ k: 'near', t, i: g.i, side: g.minSide, x: cx, y: S.y });                      // the art brushed the edge, the hitbox did not
            if (S.passed === K.GATES - 2) S.ev.push({ k: 'almost', t });
          }
        }
        // ---- coins: magnet pulls close ones in, the hitbox grabs them ----
        for (const c of S.coins) {
          if (c.got >= 0 || S.fail >= 0) continue;
          if (Math.hypot(c.x - cx, c.y - S.y) < K.MAG) { const q = Math.min(1, 12 * DT); c.x += (cx - c.x) * q; c.y += (S.y - c.y) * q; }
          if (Math.abs(c.x - cx) < K.HB_W / 2 + K.COIN_R * 0.6 && Math.abs(c.y - S.y) < hbh + K.COIN_R * 0.6) {
            c.got = t; S.money += K.COIN_V; S.coinsGot++; S.streak = t - S.lastCoinT < 1.5 ? S.streak + 1 : 1; S.lastCoinT = t;
            S.ev.push({ k: 'coin', t, x: c.x, y: c.y, sx: S.sx, n: S.streak, v: K.COIN_V, c: S.coinsGot });
          }
        }
        // ---- doors: open as the card nears them; passing them starts the finale ----
        const dx = doorX();
        if (S.doorT < 0 && S.fail < 0 && dx - cx < K.DOOR_OPEN_AT) { S.doorT = t; S.ev.push({ k: 'doors', t }); }
        if (S.winT < 0 && S.fail < 0 && cx >= dx) { S.winT = t; S.ev.push({ k: 'win', t, x: cx, y: S.y }); }
      }
    }
    // ---- endcard: the finale ends, or (ad-network variant only) a timer runs out ----
    const why = S.winT >= 0 && t - S.winT > K.FIN_T ? 'win' : S.winT >= 0 ? '' : S.firstIn < 0 && t > K.END_NO_INPUT ? 'passive'
      : S.firstIn >= 0 && t - S.lastIn > K.END_IDLE ? 'idle' : S.firstIn >= 0 && t - S.firstIn > K.END_MAX ? 'timeout' : '';
    if (S.end < 0 && why) { S.end = t; S.endWhy = why; S.ev.push({ k: 'end', t, x: S.sx + K.CARD_X, y: S.y }); }
    return S;
  }
  K.FIN_Y = () => VIEW.H * 0.40;

  // ---- attract demo: a planner that plays like a good player (taps when the card sinks below its target) ----
  const scriptInput = (t, S) => {
    const inp = { click: 0 };
    if (S.end >= 0 || S.winT >= 0 || S.fail >= 0) return inp;
    if (S.firstIn < 0) { if (t >= K.DEMO_START) inp.click = 1; return inp; }
    const { mid } = lay(), cx = S.sx + K.CARD_X;
    const g = S.gates.find((q) => cx < q.x + K.GATE_W / 2 + K.HB_W / 2), coin = S.coins.find((c) => c.got < 0 && c.x > cx - 30);
    const ty = g && g.x - cx < K.DEMO_LOOK ? g.cy : coin && coin.x - cx < 800 ? coin.y : g ? g.cy : mid;
    if (S.y > ty + K.DEMO_LOW && S.vy > -150) inp.click = 1;
    return inp;
  };
  let cache = null;
  function at(t) {
    const loop = Math.floor(t / L), q = t - loop * L, n = Math.round(q / DT);
    if (!cache || cache.loop !== loop || cache.S.steps > n) { const S0 = Object.assign(create(), { wt0: loop * L }); cache = { loop, S: S0 }; }
    const S = cache.S; while (S.steps < n) step(S, scriptInput(S.t, S));
    return Object.assign({}, S, { loop, q, demo: true, inp: scriptInput(S.t, S) });
  }
  // the demo must hit every beat of the ad inside its loop (timing: first tap → endcard 18–21 s on the 8-gate build)
  const demoCheck = (S) => {
    const f = [], took = S.end - S.firstIn;
    if (S.hits > 0) f.push('demo took ' + S.hits + ' hits'); if (S.passed < K.GATES) f.push('only ' + S.passed + '/' + K.GATES + ' gates');
    if (S.coinsGot < Math.ceil(0.8 * S.coins.length)) f.push('coins ' + S.coinsGot + '/' + S.coins.length);
    if (S.end < 0 || S.end > L - 3) f.push('endcard late: ' + S.end.toFixed(1)); else if (K.GATES === 8 && (took < 18 || took > 21)) f.push('first tap → endcard ' + took.toFixed(1) + ' s (want 18–21)');
    return f;
  };

  root.SIM = { DT, L, K, VIEW, HINT, create, spawn, respawn, outOfPlay, step, at, scriptInput, demoCheck, lay, doorX, lastGateX, speedAt };
  if (typeof module !== 'undefined') module.exports = root.SIM;
})(typeof window !== 'undefined' ? window : globalThis);
