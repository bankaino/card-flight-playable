// live/scene.js — «Полёт карты» (БАНК). Pure function of t and the sim state (no Math.random, no accumulated state).
// Layers: wall / ceiling / floor of the rival bank branch (parallax) → gates (hanging item + stack + minus plate) → doors → coins →
// night finale → card (+ trail, FX) → HUD (lives, coin pill, progress, headline, hint + hand, callouts, retry panel) → endcard.
// Art (phase 2): generated sprites and tiles; the «БАНК» mark, all text, plates, strike-throughs, HUD and the endcard are code.
(function () {
  const S = (window.SCENE = {}), A = window.ASSETS, L = LIB, M = L.M, W = SIM.VIEW.W, H = SIM.VIEW.H, Z = window.SIZES, K = SIM.K;
  S.REPEAT = ['wall_tile', 'ceiling_tile', 'floor_tile', 'stack_tile', 'duct_tile', 'aurora_ribbon', 'city_night'];
  const has = (n) => !!A[n], SS = L.SS;
  const SK = window.SKIN, FONT = SK.font;                                               // look-and-feel lives in skin.js; the scene only asks for tokens
  const TXT = { font: FONT, outW: SK.txt.outW, shadow: SK.txt.shadow, weight: SK.txt.weight };
  const label = (slot, str, x, y, o = {}) => { const q = Object.assign({}, TXT, o); if (o.ink) { const k = SK.ink[o.ink] || SK.ink.base; q.col = k[0]; q.out = k[1]; } delete q.ink; return L.label(slot, str, x, y, q); };
  const labelW = (slot, str, o = {}) => L.labelW(slot, str, Object.assign({}, TXT, o));
  const rr = (x, y, w, h, round, c0, c1, a) => L.rrect(x, y, w, h, round <= 1 ? Math.min(w, h) * round : round, c0, c1, a);   // round <= 1: a fraction of the short side (0.5 = pill)
  const panel = (x, y, w, h, k = 1, rPx) => { const rad = SK.panel.round <= 1 ? Math.min(w, h) * SK.panel.round : SK.panel.round; if (rPx) { rr(x, y, w, h, Math.min(rPx, rad), SK.panel.a, SK.panel.b, Math.min(1, SK.panel.alpha * k)); return; } rr(x, y, w, h, rad, SK.panel.a, SK.panel.b, Math.min(1, SK.panel.alpha * k));
    if (SK.panel.rim) L.ring(x + w / 2, y + h / 2, w / 2, h / 2, [1, 1, 1], 0.22 * Math.min(1, k), 0.03); };
  const ghost = (x, y, w, h, a = 1, c0 = [0.07, 0.11, 0.19], c1 = [0.05, 0.08, 0.15]) => { rr(x, y, w, h, 0.5, [0.62, 0.70, 0.85], [0.62, 0.70, 0.85], 0.65 * a); rr(x + 3, y + 3, w - 6, h - 6, 0.5, c0, c1, 0.96 * a); };   // pill with a 3 px outline
  const EASE = { out: (x) => 1 - (1 - x) * (1 - x), back: (x) => 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2), soft: (x) => x * x * (3 - 2 * x) };
  const ease = EASE.out, clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const MINT = [0.243, 0.949, 0.784], VIOLET = [0.541, 0.361, 1.0], CYAN = [0.353, 0.82, 1.0], GOLD0 = [1.0, 0.80, 0.32], GOLD1 = [0.91, 0.64, 0.13];
  const MINUS = ['Очередь 2 часа', 'Справка из 5 мест', 'Комиссия за переводы', 'Кэшбэк 0,5 %', 'Платное обслуживание', 'Мелкий шрифт', 'Перезвоним завтра', 'Окно закрыто'];
  const PLUS = ['Онлайн за 5 минут', 'Нужен только паспорт', 'Переводы без комиссии', 'Кэшбэк до 10 %', 'Обслуживание 0 ₽', 'Условия на одном экране', 'Поддержка 24/7 в чате', 'Карту привезём завтра'];
  const fmt = (n) => String(Math.max(0, Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const HUD_Y = 168;                                                          // HUD row: keep the top 120 px corners clear (network close / mute buttons)
  S.hit = [];                                                                // tappable HUD rects (index.html: CTA → store, replay)
  const hudCoin = [W - 36 - 190, HUD_Y];

  // art helpers: SIZES holds display sizes in view px ([w, 0] / [0, h] keeps the texture aspect)
  const sz = (n) => { const z = Z[n] || [0, 0], t = G.tex(n); return [z[0] || z[1] * t.w / t.h, z[1] || z[0] * t.h / t.w]; };
  const spr = (n, x, y, w, h, o = {}) => L.sprite(n, x, y, Object.assign({ w, h }, o));
  const TOPS = ['top_queue', 'top_stamp', 'top_pct', 'top_balloon', 'top_tag', 'top_scroll', 'top_phone', 'top_break'];
  const BOTS = ['bot_ticket', 'bot_papers', 'bot_till', 'bot_piggy', 'bot_turnstile', 'bot_magnifier', 'bot_folders', 'bot_window'];
  const PEOPLE = ['man_sit', 'woman_sit', 'man_stand', 'old_cane', 'kid_stand'];
  let MARK = [100, 40];
  // the «БАНК» mark on the card: a small baked text texture, drawn with the card's matrix
  const bakeMark = () => {
    const k = 2, cv = document.createElement('canvas'), g = cv.getContext('2d'), f = `800 ${30 * k}px ${FONT}`; g.font = f; try { g.letterSpacing = (3.6 * k) + 'px'; } catch (e) {}
    const tw = Math.ceil(g.measureText('БАНК').width) + 12 * k, th = 44 * k; cv.width = tw; cv.height = th; g.font = f; try { g.letterSpacing = (3.6 * k) + 'px'; } catch (e) {}
    g.textBaseline = 'middle'; g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillText('БАНК', 6 * k, th / 2 + 1.5 * k); g.fillStyle = '#ffffff'; g.fillText('БАНК', 6 * k, th / 2);
    G.canvasTex('bank_mark', cv); MARK = [tw / k, th / k];
  };
  S.programs = () => { L.init(W, H); bakeMark(); };
  // the card with its mark (centre x, y, tilt, scale, opacity)
  const drawCard = (cx, cy, rot, k, al, rim = 3) => { const [cw, ch] = sz('card'), w = cw * k, h = ch * k;
    const body = () => L.sprite('card', 0, 0, { m: M.of(M.t(cx, cy), M.r(rot)), w, h, pivot: [w / 2, h / 2], u: { alpha: al } });
    if (rim > 0) L.inked(body, { r: rim * k, n: 8, col: [0.88, 0.95, 1.0], dy: 0 }); else body();                         // a thin white rim: the hero is as dark as the columns, the rim and the colour set it apart
    L.sprite('bank_mark', 0, 0, { m: M.of(M.t(cx, cy), M.r(rot), M.t(-w / 2 + 22 * k, -h / 2 + 12 * k)), w: MARK[0] * k, h: MARK[1] * k, pivot: [0, 0], u: { alpha: al } }); };
  // a glint that runs over the card every 2.6 s (a star on its top-right corner)
  const glint = (cx, cy, rot, k, tt) => { const q = (tt % 2.6) / 0.5; if (q >= 1) return; const lx = 98 * k, ly = -56 * k;
    L.star(cx + Math.cos(rot) * lx - Math.sin(rot) * ly, cy + Math.sin(rot) * lx + Math.cos(rot) * ly, 54 * k * Math.sin(Math.PI * q), [1, 1, 1], 0.95); };
  const coinSpr = (x, y, d, sx = 1, al = 1) => L.sprite('coin', 0, 0, { m: M.of(M.t(x, y), M.s(sx, 1)), w: d, h: d, pivot: [d / 2, d / 2], u: { alpha: al } });
  const stars = (k, n, ymax, tt) => { for (let i = 0; i < n; i++) L.star(W * L.rnd(i, 1), ymax * L.rnd(i, 2), 6 + 8 * L.rnd(i, 3), [1, 1, 1], k * (0.35 + 0.35 * Math.sin(tt * 2 + i))); };
  // aurora ribbon: additive, tiled in x, drifting; (x0, w0) limits it to a window (the door opening)
  const aurora = (tt, k, y, h, par, a, shift, x0 = 0, w0 = W) => { const t = G.tex('aurora_ribbon'), tw = h * t.w / t.h, u0 = (tt * par * 40 + shift) / tw; G.blend('add');
    L.sprite('aurora_ribbon', x0, y + 22 * Math.sin(tt * 0.5 + shift), { w: w0, h, src: [u0, 0, u0 + w0 / tw, 1], u: { alpha: a * k } }); G.blend(); };
  const cityStrip = (tt, k, baseY, wide, ca = 1) => { const t = G.tex('city_night'), tw = wide, h = tw * t.h / t.w, u0 = (tt * 6) / tw; L.sprite('city_night', 0, baseY - h, { w: W, h, src: [u0, 0, u0 + W / tw, 1], u: { alpha: k * ca } }); };
  // the night world: sky gradient, stars, aurora, city (finale + endcard)
  const night = (tt, k, baseY, ca = 1) => { rr(0, 0, W, H, 0, SK.end.bg[0], SK.end.bg[1], k); stars(k, 40, H * 0.55, tt);
    aurora(tt, k, H * 0.04, 640, 1, 0.9, 0, 0, W); aurora(tt, k, H * 0.17, 560, -0.7, 0.7, 700); aurora(tt, k, H * 0.28, 500, 0.5, 0.5, 1500); cityStrip(tt, k, baseY, 1500, ca); };

  // world text scrolls through the screen edge by design: QA records only the HUD texts
  const world = (fn) => { const t0 = L.uiText, b0 = L.uiBox; L.uiText = L.uiBox = () => {}; try { fn(); } finally { L.uiText = t0; L.uiBox = b0; } };
  // the minus plate: a light sign; two lines when long; the strike-through grows after the pass. plateLay measures, plateDraw draws at (cx, top)
  const plateLay = (slot, str) => {
    const base = 46, w1 = labelW(slot + 'a', str, { size: base }); let l1 = str, l2 = '';
    if (w1 > 400) { const mid = Math.floor(str.length / 2); let at = str.lastIndexOf(' ', mid); if (at < 1 || (str.indexOf(' ', mid) > 0 && str.indexOf(' ', mid) - mid < mid - at)) at = str.indexOf(' ', mid); if (at > 0) { l1 = str.slice(0, at); l2 = str.slice(at + 1); } }
    const wa = labelW(slot + 'a', l1, { size: base }), wb = l2 ? labelW(slot + 'b', l2, { size: base }) : 0, mw = Math.max(wa, wb), s = Math.round(base * Math.min(1, 380 / mw));
    const lh = Math.round(s * 1.2); return { l1, l2, sz: s, lh, pw: Math.min(440, Math.max(mw * s / base, 200) + 50), ph: (l2 ? 2 : 1) * lh + 26, slot };
  };
  const plateDraw = (P, cx, top, struck, fade) => { const px = cx - P.pw / 2, py = top;
    rr(px + 4, py + 8, P.pw, P.ph, 22, [0.1, 0.1, 0.12], [0.1, 0.1, 0.12], 0.22 * fade); rr(px, py, P.pw, P.ph, 22, [0.96, 0.94, 0.90], [0.88, 0.86, 0.81], fade);
    world(() => { label(P.slot + 'a', P.l1, cx, py + 13 + P.lh / 2, { size: P.sz, ink: 'plate', al: 0.5, a: fade * (1 - 0.35 * struck) });
      if (P.l2) label(P.slot + 'b', P.l2, cx, py + 13 + P.lh * 1.5, { size: P.sz, ink: 'plate', al: 0.5, a: fade * (1 - 0.35 * struck) }); });
    if (struck > 0) rr(px - 6, py + P.ph / 2 - 6, (P.pw + 12) * struck, 12, 6, MINT, VIOLET); };
  // the gates must read first: a soft shadow on the wall + a dark graphite outline around every obstacle piece, columns pulled darker
  const INK = [0.07, 0.08, 0.11], INK_T = [0.20, 0.22, 0.27, 0.38];
  const WEAK = { top_balloon: 0.35, bot_piggy: 0.35, bot_magnifier: 0.35, top_break: 0.35, top_tag: 0.25, top_scroll: 0.25 };   // light props that sit near the wall's value: pulled darker
  const solid = (draw, r) => L.inked(draw, { r, n: 8, col: INK, dy: 0 });                                                       // items are tight-cropped sprites: outline only (a blurred shadow gets clipped by the quad)
  const column = (n, x, y, w, h, src, u) => { rr(x + 10, y + 14, w, h, 8, [0, 0, 0], [0, 0, 0], 0.20); rr(x - 5, y - 5, w + 10, h + 10, 6, INK, INK); spr(n, x, y, w, h, { src, u }); };   // columns are plain rectangles: outline = one dark rect
  // chain links between the duct cap and the hanging item's ring
  const chain = (x, y0, y1) => { for (let y = y0, i = 0; y < y1 - 4; y += 15, i++) rr(i % 2 ? x - 4 : x - 7, y, i % 2 ? 8 : 14, 20, 6, [0.20, 0.21, 0.24], [0.34, 0.36, 0.40]); };

  S.render = (t) => {
    const ST = S.state || SIM.at(t), GT = ST.t, rnd = L.rnd, lay = SIM.lay(), ceil = lay.ceil, floor = lay.floor;
    const winK = ST.winT >= 0 ? SS(0, 0.8, GT - ST.winT) : 0;                       // finale: the world turns to night
    // ---- trauma shake from hits ----
    let tr = 0; for (const e of ST.ev) { const a = GT - e.t; if (a < 0) continue; if (e.k === 'hit' && a < 0.3) tr = Math.max(tr, 1 - a / 0.3); if (e.k === 'win' && a < 0.5) tr = Math.max(tr, 0.4 * (1 - a / 0.5)); }
    const sh = 14 * tr * tr, shx = sh * Math.sin(GT * 83), shy = sh * Math.sin(GT * 101 + 1);
    const X = (x) => x - ST.sx + shx, cardY = ST.y + shy;
    const fin = ST.winT >= 0 ? SS(0, 1.8, GT - ST.winT) : 0, cardX = K.CARD_X + (W / 2 - K.CARD_X) * fin + shx, cardS = 1 + 0.5 * fin;

    // ===== the rival bank branch: ceiling, wall (parallax), floor, waiting people =====
    L.beginBG([0.70, 0.72, 0.75, 1]); L.beginComp();
    const tiled = (n, y, h, par, tileH, v0 = 0, sh0 = 0) => { const t = G.tex(n), tw = tileH * t.w / t.h, u0 = (ST.sx * par + sh0) / tw; L.sprite(n, 0, y, { w: W, h, src: [u0, v0, u0 + W / tw, v0 + h / tileH] }); };
    const drift = 120 * (ST.firstIn < 0 ? GT : ST.firstIn);                                                                       // before the first tap the far wall and the people drift (the gates stand)
    { const wy = ceil - 30, wh = floor - wy + 6; tiled('wall_tile', wy, wh, 0.5, wh, 0, drift * 0.5); }                                    // wall: the baseboard sits on the floor line
    L.solid(0, ceil - 30, W, floor - ceil + 40, [0.80, 0.84, 0.89], 0, 0, 0, 0.42);                                           // depth haze: the far layers are paler and calmer than the gates
    for (let k = 0; k < 6; k++) { const nm = PEOPLE[k % 5], [pw, ph] = sz(nm), x = ((k * 470 + 90 - (ST.sx + drift) * 0.6) % 2820 + 2820) % 2820 - 250; if (x > W + 100) continue;   // waiting people, parallax 0.6
      spr(nm, x - pw / 2, floor - 4 - ph, pw, ph); }
    tiled('floor_tile', floor - 2, H - floor + 2, 1, 620);                                                                   // floor: scrolls with the gates
    // ---- aurora leaking through the walls as the exit gets closer ----
    const near = clamp(1 - (SIM.doorX() - (ST.sx + K.CARD_X)) / 2400, 0, 1);
    if (near > 0) for (let i = 0; i < 3; i++) L.glow(W * (0.2 + 0.3 * i), ceil + 300 + 200 * i, 360, i % 2 ? VIOLET : MINT, 0.22 * near * (0.6 + 0.4 * Math.sin(GT + i)), 2.2);

    // ===== gates: duct from the ceiling → cap + chain → hanging item | item standing on a cabinet column; the plate sits where there is room =====
    const dTile = G.tex('duct_tile'), sTile = G.tex('stack_tile'), CW = K.GATE_W;
    for (const g of ST.gates) {
      const gx = X(g.x); if (gx < -380 || gx > W + 380) continue;
      const top = g.cy - g.gap / 2, bot = g.cy + g.gap / 2, hurt = g.hitT > 0 ? Math.max(0, 1 - (GT - g.hitT) / 0.45) : 0, after = g.passed >= 0 ? GT - g.passed : -1;
      const tn = TOPS[g.c], bn = BOTS[g.c], [tw, th] = sz(tn), [bw, bh] = sz(bn), tintFor = (n) => ({ tint: hurt > 0 ? [1, 0.35, 0.3, 0.55 * hurt] : WEAK[n] ? [0.22, 0.24, 0.30, WEAK[n]] : [1, 1, 1, 0] }), colT = { tint: hurt > 0 ? [1, 0.35, 0.3, 0.55 * hurt] : INK_T };
      const itemTop = top - th + 4, capY = itemTop - 30, sw = (0.012 * Math.sin(GT * 1.6 + g.i) + 0.10 * hurt * Math.sin(GT * 22)) ;
      if (capY > -60) { const dh = capY + 60, tH = CW * dTile.h / dTile.w; column('duct_tile', gx - CW / 2, -60, CW, dh, [0, 0, 1, dh / tH], colT);
        rr(gx - CW / 2 - 8, capY, CW + 16, 24, 8, [0.30, 0.31, 0.35], [0.20, 0.21, 0.24]); chain(gx, capY + 22, itemTop + 6); }
      solid(() => spr(tn, 0, 0, tw, th, { m: M.of(M.t(gx, itemTop), M.r(sw)), pivot: [tw / 2, 0], u: tintFor(tn) }), 6);
      const stY = bot + bh - 6;                                                                                                // the item's feet = the cabinet's top
      solid(() => spr(bn, gx - bw / 2, bot, bw, bh, { u: tintFor(bn) }), 6);
      if (stY < floor + 40) { const sh2 = floor + 40 - stY, sH = CW * sTile.h / sTile.w; column('stack_tile', gx - CW / 2, stY, CW, sh2, [0, 0, 1, sh2 / sH], colT); rr(gx - CW / 2 - 6, stY - 6, CW + 12, 14, 6, [0.66, 0.64, 0.60], [0.50, 0.48, 0.45]); }
      const st = after < 0 ? 0 : SS(0, 0.25, after), fade = after < 0 ? 1 : 1 - 0.45 * SS(0, 0.5, after), P = plateLay('mp' + g.i, MINUS[g.c]);
      if (capY - 14 - ceil >= P.ph + 26) plateDraw(P, gx, capY - 14 - P.ph, st, fade);                                           // room on the duct above the item
      else if (floor - 14 - (stY + 20) >= P.ph) plateDraw(P, gx, stY + 24, st, fade);                                           // room on the cabinet below
      else plateDraw(P, gx, top - 14 - P.ph, st, fade);                                                                          // no room: over the item
    }
    { const ch = ceil + 40, tH = 563; tiled('ceiling_tile', -20, ch + 20, 0.8, tH, 1 - (ch + 20) / tH); }                   // ceiling over the duct tops: its lamps are in the lower part of the tile
    { const Zl = Z.lamps, tH = 563, tt_ = G.tex('ceiling_tile'), tw = tH * tt_.w / tt_.h, u0 = ST.sx * 0.8 / tw, ly = -20 + (Zl.y[0] - (1 - (ceil + 60) / tH)) * tH, lh = (Zl.y[1] - Zl.y[0]) * tH;      // ceiling lamps: some flicker, one dies for a moment
      for (let k = Math.floor(u0); k < u0 + W / tw + 1; k++) for (let li = 0; li < 2; li++) { const x0 = (k - u0 + Zl.x[li][0]) * tw, lw = (Zl.x[li][1] - Zl.x[li][0]) * tw, kk = ((k % 5) + 5) % 5 * 2 + li;
        const bad = Math.sin(GT * 0.9 + kk * 3.1) > 0.93, off = bad && L.rnd(Math.floor(GT * 22), kk) > 0.45; if (x0 > W || x0 + lw < 0) continue;
        if (off) rr(x0 - 6, ly - 8, lw + 12, lh + 16, 6, [0.78, 0.80, 0.84], [0.74, 0.77, 0.81], 0.9); else L.glow(x0 + lw / 2, ly + lh / 2, lw * 0.55, [1, 0.98, 0.9], bad ? 0.20 : 0.07, 2.2); } }
    // ---- the exit doors: the frame is a sprite, its opening shows the night; two glass leaves slide into the jambs ----
    { const dx = X(SIM.doorX()), dp = ST.doorT >= 0 ? SS(0, 0.6, GT - ST.doorT) : 0, D = Z.door || {}, op = D.open || [0.14, 0.11, 0.86, 0.96], dh = floor - ceil + 80, dw = dh * (D.aspect || 0.6667), fx = dx - dw / 2, fy = ceil - 50;
      if (dx > -dw && dx < W + dw) {
        const ox0 = fx + op[0] * dw, oy0 = fy + op[1] * dh, ox1 = fx + op[2] * dw, oy1 = fy + op[3] * dh, ow = ox1 - ox0, oh = oy1 - oy0;
        L.glow(dx, (ceil + floor) / 2, 560, MINT, 0.18 + 0.28 * near, 2.2);
        rr(ox0, oy0, ow, oh, 0, SK.end.bg[0], SK.end.bg[1]); for (let i = 0; i < 12; i++) L.star(ox0 + ow * L.rnd(i, 5), oy0 + oh * 0.5 * L.rnd(i, 6), 5 + 5 * L.rnd(i, 7), [1, 1, 1], 0.6);
        aurora(GT, dp, oy0 + oh * 0.12, ow * 0.9, 0.6, 0.9, 0, ox0, ow); aurora(GT, dp, oy0 + oh * 0.34, ow * 0.8, -0.5, 0.6, 400, ox0, ow);
        for (let i = 0; i < 3; i++) L.glow(dx, oy0 + oh * (0.25 + 0.25 * i), ow * 0.55, i === 1 ? VIOLET : MINT, 0.34 * dp, 2.2);
        const lw = ow / 2; spr('door_leaf', ox0 - lw * dp, oy0, lw, oh, { u: { alpha: 0.92 } }); spr('door_leaf', 0, 0, lw, oh, { m: M.of(M.t(ox1 + lw * dp, oy0), M.s(-1, 1)), pivot: [0, 0], u: { alpha: 0.92 } });
        spr('door_frame', fx, fy, dw, dh); } }
    // ---- coins ----
    for (const c of ST.coins) { if (c.got >= 0) continue; const x = X(c.x); if (x < -60 || x > W + 60) continue;
      const bob = 6 * Math.sin(GT * 3 + c.x * 0.02), sx = Math.max(0.12, Math.abs(Math.cos(GT * 3.2 + c.x * 0.01)));
      L.glow(x, c.y + bob, 60, GOLD0, 0.30, 2.4); coinSpr(x, c.y + bob, 64, sx); }
    // ---- night finale: the world beyond the doors (sky, aurora, city) ----
    if (winK > 0) night(GT, winK, H + 8);
    if (ST.winT >= 0) { const wa = GT - ST.winT;                                                                                     // fireworks (6 salvos) and a coin fountain from the card
      for (let i = 0; i < 6; i++) { const a = wa - (0.35 + 0.33 * i); if (a < 0 || a > 1.3) continue; const cx0 = W * (0.18 + 0.64 * rnd(i, 31)), cy0 = H * (0.10 + 0.20 * rnd(i, 32)), col = [MINT, VIOLET, GOLD0, CYAN, [1, 1, 1], MINT][i], f = 1 - a / 1.3;
        L.glow(cx0, cy0, 120 + 200 * f, col, 0.34 * Math.max(0, 1 - a / 0.5), 2.2);
        for (let j = 0; j < 26; j++) { const an = j / 26 * 6.283 + rnd(i, j), v = 320 + 220 * rnd(j, i + 40), r = v * a * (1 - 0.22 * a); L.star(cx0 + Math.cos(an) * r, cy0 + Math.sin(an) * r + 260 * a * a, 6 + 16 * f, col, f); } }
      for (let j = 0; j < 16; j++) { const a = wa - j * 0.03; if (a < 0 || a > 1.8) continue; const an = -Math.PI / 2 + (rnd(j, 50) - 0.5) * 1.9, v = 600 + 500 * rnd(j, 51);
        coinSpr(cardX + Math.cos(an) * v * a, cardY + Math.sin(an) * v * a + 1300 * a * a, 52, Math.abs(Math.cos(a * 9 + j)) * 0.9 + 0.1, 1 - SS(1.3, 1.8, a)); } }

    // ===== the card: trail, flap rings, body =====
    const dead = ST.fail >= 0, cardA0 = dead ? 1 : GT - ST.invT < K.INVUL && ST.end < 0 ? (Math.floor(GT * 24) % 2 ? 0.35 : 1) : 1, cardA = cardA0 * (ST.end >= 0 ? 1 - SS(0, 0.45, GT - ST.end) : 1);
    if ((ST.end < 0 || winK > 0) && cardA > 0.01) {
      { const tl = (ST.firstIn >= 0 ? 1 : 0.6) * cardA;
        for (let j = 0; j < 9; j++) { const u = j / 9, c0 = L.lerpP(MINT, VIOLET, u), wd = (96 - 8 * j) * cardS, ht = (46 - 4.2 * j) * cardS, tx = cardX - (100 + j * 36) * cardS, ty = cardY + 10 - ST.vy * 0.012 * j + 5 * Math.sin(GT * 8 + j * 0.9);
          rr(tx - wd / 2, ty - ht / 2, wd, ht, ht / 2, c0, c0, 0.92 * (1 - u * 0.9) * tl); }
        for (let j = 0; j < 4; j++) { const ph = (GT * 2.6 + j * 0.27) % 1; L.star(cardX - (150 + ph * 280) * cardS, cardY + 8 + 32 * Math.sin(j * 2.3 + GT * 2), (12 + 18 * (1 - ph)) * cardS, [1, 1, 1], 0.95 * (1 - ph) * tl); } }
      for (let j = 0; j < 8; j++) { const q = ((GT * 2.2 + j / 8) % 1), tx = cardX - 110 * cardS - q * 150, ty = cardY - ST.vy * 0.02 * j * 0.6 + 14 * Math.sin(GT * 9 + j * 1.7) + 16;
        L.puff(tx, ty, (10 + 14 * (1 - q)) * cardS, j % 2 ? VIOLET : MINT, 0.5 * (1 - q) * (ST.firstIn >= 0 ? 1 : 0.5) * cardA, j + 3); }
      for (const e of ST.ev) { const a = GT - e.t; if (a < 0 || a > 0.4) continue; const q = a / 0.4;
        if (e.k === 'flap') L.ring(K.CARD_X - 30 + shx, e.y + 70, (40 + 90 * ease(q)), (14 + 30 * ease(q)), [1, 1, 1], 0.45 * (1 - q), 0.08); }
      L.glow(cardX, cardY, 230 * cardS, MINT, 0.20 * cardA, 2.4);
      drawCard(cardX, cardY, ST.rot, cardS, cardA); if (cardA > 0.9) glint(cardX, cardY, ST.rot, cardS, GT);
      for (const e of ST.ev) { const a = GT - e.t; if (a < 0) continue;
        if (e.k === 'flap' && a < 0.35) { const q = a / 0.35; for (let j = 0; j < 3; j++) L.puff(cardX - 60 + j * 28 - 20 * q, e.y + 60 + 50 * ease(q) + j * 6, (12 + 16 * q) * cardS, [1, 1, 1], 0.5 * (1 - q), j + 11); }
        if (e.k === 'coin' && a < 0.4) { const q = a / 0.4, x0 = e.x - e.sx + shx; for (let j = 0; j < 5; j++) { const an = j * 1.2566 + e.t * 7, d = 18 + 56 * ease(q); L.star(x0 + Math.cos(an) * d, e.y + Math.sin(an) * d, 4 + 10 * (1 - q), GOLD0, 1 - q); } }
        if (e.k === 'near' && a < 0.45) { const q = a / 0.45, sg = e.side === 'top' ? -1 : 1; for (let j = 0; j < 7; j++) L.star(K.CARD_X - 120 + j * 38 + 30 * q + shx, e.y + sg * (66 + 8 * Math.sin(j * 2.1)) + sg * 14 * q, 8 + 22 * (1 - q), [1, 0.95, 0.7], 1 - q); }
        if (e.k === 'hit' && a < 0.9) for (let j = 0; j < 9; j++) { const an = -Math.PI / 2 + (rnd(j, Math.floor(e.t * 13)) - 0.5) * 2.7, v = 320 + 320 * rnd(j, 7), px = K.CARD_X + shx + Math.cos(an) * v * a, py = e.y + Math.sin(an) * v * a + 0.5 * 900 * a * a;
          L.solid(px - 11, py - 15, 22, 30, [0.96, 0.94, 0.88], rnd(j, 3) * 6.28 + a * (5 + 8 * rnd(j, 5)), 11, 15, 1 - SS(0.5, 0.9, a)); } }
      for (const e of ST.ev) { const a = GT - e.t; if (a < 0 || a > 0.5) continue; const q = a / 0.5;
        if (e.k === 'hit') { L.glow(K.CARD_X + shx, e.y, 260, [1, 0.45, 0.4], 0.7 * (1 - q), 2); for (let j = 0; j < 8; j++) { const an = j * 0.785 + e.t, d = (30 + 140 * ease(q)); L.star(K.CARD_X + shx + Math.cos(an) * d, e.y + Math.sin(an) * d, 18, [1, 0.85, 0.6], 1 - q); } } }
    }
    L.finish(t, SK.grade);

    // ===================== HUD (screen space) =====================
    S.hit = [];
    if (ST.end < 0) rr(0, 108, W, 126, 0, [0.04, 0.07, 0.13], [0.04, 0.07, 0.13], 0.36);                                      // scrim behind the HUD row (also hides the lamp tube)
    // ---- lives: three small cards (top left) ----
    for (let i = 0; i < K.LIVES && ST.end < 0; i++) { let x = 44 + i * 78; const y = HUD_Y - 22, on = i < ST.lives;
      for (const e of ST.ev) { const a = GT - e.t; if (e.k === 'hit' && !e.free && e.lives === i && a >= 0 && a < 0.45) x += 9 * Math.sin(a * 70) * (1 - a / 0.45); }       // the lost life shakes
      if (on) { rr(x, y, 66, 42, 10, MINT, VIOLET); rr(x + 9, y + 15, 15, 12, 3, GOLD0, GOLD1); } else { rr(x, y, 66, 42, 10, [0.35, 0.4, 0.48], [0.3, 0.34, 0.42], 0.55); L.ring(x + 33, y + 21, 33, 21, [1, 1, 1], 0.2, 0.08); }
      for (const e of ST.ev) { const a = GT - e.t; if (e.k === 'hit' && !e.free && e.lives === i && a >= 0 && a < 0.5) for (let j = 0; j < 6; j++) { const an = j * 1.05, d = 70 * ease(a / 0.5); L.star(x + 33 + Math.cos(an) * d, y + 21 + Math.sin(an) * d, 14, [1, 0.8, 0.6], 1 - a / 0.5); } } }
    // ---- coin pill: coins fly to it from where they were grabbed ----
    let inFlight = 0;
    for (const e of ST.ev) { const a = GT - e.t; if (e.k !== 'coin' || a < 0 || a >= 0.6) continue; inFlight += e.v;
      const x0 = e.x - e.sx, y0 = e.y, q = Math.pow(clamp(a / 0.6, 0, 1), 1.6), x = x0 + (hudCoin[0] - x0) * q, y = y0 + (hudCoin[1] - y0) * q - 80 * Math.sin(Math.PI * q);
      coinSpr(x, y, 40, 1, 1 - 0.3 * q); }
    for (const e of ST.ev) { const a = GT - e.t; if (e.k !== 'gate' || a < 0 || a >= 0.8) continue; inFlight += e.v;                       // the pass bonus: three coins fly from the card to the pill
      for (let j = 0; j < 3; j++) { const qj = clamp((a - 0.08 * j) / 0.6, 0, 1); if (qj <= 0 || qj >= 1) continue; const x0 = K.CARD_X + shx + 30 * j, y0 = e.y - 40 * j, u = Math.pow(qj, 1.6);
        coinSpr(x0 + (hudCoin[0] - x0) * u, y0 + (hudCoin[1] - y0) * u - 90 * Math.sin(Math.PI * qj), 40, 1, 1 - 0.3 * u); } }
    const shown = Math.max(0, ST.money - inFlight), txt = fmt(shown) + ' ₽', tw = Math.max(labelW('money', txt, { size: 46 }), 80), pw = 44 + 24 + tw + 36, px = W - 36 - pw;
    hudCoin[0] = px + 44;
    if (!(ST.end >= 0)) { let bump = 0; for (const e of ST.ev) { const a = GT - e.t - 0.6; if (e.k === 'coin' && a >= 0 && a < 0.12) bump = Math.max(bump, 1 - a / 0.12); }
      panel(px, HUD_Y - 38, pw, 76); L.uiBox('money', px, HUD_Y - 38, pw, 76, 4); const sc = 1 + 0.12 * bump; coinSpr(hudCoin[0], HUD_Y, 50 * sc);
      label('money', txt, px + 44 + 24 + 14, HUD_Y, { size: 46, ink: 'gold' });
      // ---- progress: dots + a door ----
      const n = K.GATES, sp = 42, w0 = (n - 1) * sp + 70, x0 = W / 2 - w0 / 2 + 46;
      for (let i = 0; i < n; i++) { const on = i < ST.passed, x = x0 + i * sp; rr(x - 12, HUD_Y - 12, 24, 24, 12, [0.07, 0.10, 0.18], [0.07, 0.10, 0.18], 0.85);
        if (on) rr(x - 9, HUD_Y - 9, 18, 18, 9, MINT, VIOLET); else rr(x - 8, HUD_Y - 8, 16, 16, 8, [0.62, 0.68, 0.78], [0.55, 0.61, 0.72], 0.9); }
      { const x = x0 + n * sp + 6, open = ST.doorT >= 0; rr(x - 16, HUD_Y - 25, 32, 50, 7, [0.07, 0.10, 0.18], [0.07, 0.10, 0.18], 0.85); rr(x - 12, HUD_Y - 21, 24, 42, 5, open ? MINT : [0.62, 0.68, 0.78], open ? VIOLET : [0.55, 0.61, 0.72]); } }
    for (const e of ST.ev) { const a = GT - e.t; if (a < 0 || ST.end >= 0) continue;
      if (e.k === 'hit' && a < 0.3) L.solid(0, 0, W, H, [1, 0.22, 0.18], 0, 0, 0, 0.20 * (1 - a / 0.3) * (e.free ? 0.5 : 1));                    // red flash on a hit
      if (e.k === 'win' && a < 0.35) L.solid(0, 0, W, H, [1, 1, 1], 0, 0, 0, 0.55 * (1 - a / 0.35)); }                                                // white flash as the card flies out
    // ---- gate-pass chips (the brand plus over the card) + callouts ----
    if (ST.end < 0) for (const e of ST.ev) { const a = GT - e.t; if (a < 0) continue;
      if (e.k === 'gate' && K.PLUS_CHIPS && a < 0.9) { const q = a / 0.9, w = labelW('plus' + e.i, PLUS[e.c], { size: 40 }) + 56, sc = a < 0.15 ? 0.7 + 0.3 * EASE.back(a / 0.15) : 1, al = 1 - SS(0.7, 1, q), y = clamp(ST.y - 235, ceil + 70, floor - 120) - 30 * ease(q), cx = clamp(K.CARD_X + 150, w / 2 + 24, W - w / 2 - 24);
        rr(cx - w * sc / 2, y - 29 * sc, w * sc, 58 * sc, 29 * sc, MINT, VIOLET, al); L.uiBox('plus' + e.i, cx - w / 2, y - 29, w, 58, 6); label('plus' + e.i, PLUS[e.c], cx, y, { size: Math.round(40 * sc), ink: 'plus', al: 0.5, a: al }); }
      if (e.k === 'near' && a < 0.9) { const q = a / 0.9, al = 1 - SS(0.6, 1, q), w = labelW('near', 'Почти!', { size: 46 }) + 60, y = clamp(ST.y + (e.side === 'top' ? 150 : -150), ceil + 60, floor - 110) - 15 * ease(q);
        panel(K.CARD_X + 60 - w / 2, y - 36, w, 72, al); L.uiBox('near', K.CARD_X + 60 - w / 2, y - 36, w, 72, 6); label('near', 'Почти!', K.CARD_X + 60, y, { size: 46, ink: 'hero', al: 0.5, a: al }); }
      if (e.k === 'coin' && e.c === 1 && K.BONUS && a < 2.0) { const q = a / 2.0, al = SS(0, 0.15, a) * (1 - SS(0.75, 1, q)), w = labelW('bhint', 'Копи бонус на карту!', { size: 38 }) + 56;
        panel(W - 36 - w, 318, w, 68, al); L.uiBox('bhint', W - 36 - w, 318, w, 68, 6); label('bhint', 'Копи бонус на карту!', W - 36 - w / 2, 352, { size: 38, ink: 'gold', al: 0.5, a: al }); }
      if (e.k === 'almost' && a < 1.4) { const q = a / 1.4, al = 1 - SS(0.7, 1, q), w = labelW('almost', 'Ещё немного!', { size: 70 }) + 80; panel(W / 2 - w / 2, 214, w, 100, al); L.uiBox('almost', W / 2 - w / 2, 214, w, 100, 6); label('almost', 'Ещё немного!', W / 2, 264 - 10 * q, { size: 70, ink: 'hero', al: 0.5, a: al }); } }
    // ---- hook: headline, hint plaque, tutorial hand (before the first tap; in the demo the hand taps with the planner) ----
    const hook = ST.firstIn < 0 ? 1 : 1 - SS(0.3, 1.5, GT - ST.firstIn);
    if (hook > 0.01 && ST.end < 0) {
      const hw = labelW('head', 'Пролети мимо минусов других банков', { size: 46 }) + 80; panel(W / 2 - hw / 2, 218, hw, 84, hook); L.uiBox('head', W / 2 - hw / 2, 218, hw, 84, 6);
      label('head', 'Пролети мимо минусов других банков', W / 2, 260, { size: 46, ink: 'base', al: 0.5, a: hook });
      const pwid = labelW('hint', 'Тапай, чтобы лететь', { size: 44 }) + 70, hy = cardY - 190; panel(K.CARD_X + 20 - pwid / 2, hy - 42, pwid, 84, hook); L.uiBox('hint', K.CARD_X + 20 - pwid / 2, hy - 42, pwid, 84, 6);
      label('hint', 'Тапай, чтобы лететь', K.CARD_X + 20, hy, { size: 44, ink: 'base', al: 0.5, a: hook }); }
    if (ST.end < 0 && ST.fail < 0 && (ST.firstIn < 0 || ST.demo && GT - ST.firstIn < 4)) {
      let lastF = -9; for (const e of ST.ev) if (e.k === 'flap') lastF = e.t;
      const down = ST.firstIn < 0 ? (GT * 1.3) % 1 < 0.3 : GT - lastF < 0.14, hx = K.CARD_X + 70, hy = cardY + 150 + (down ? 8 : 0);
      if (down) L.glow(hx, hy - 10, 70, [1, 1, 1], SK.hand.glow, 2.5);
      if (has('hand')) { const hh = Z.hand[1] * SK.hand.size * (down ? 0.92 : 1), hw = L.hsz('hand', hh); L.sprite('hand', hx - hw * 0.33, hy - hh * 0.03, { w: hw, h: hh, u: { alpha: ST.firstIn < 0 ? 1 : 1 - SS(2.5, 4, GT - ST.firstIn) } }); }
      else { rr(hx - 34, hy - 34, 68, 68, 34, [1, 1, 1], [0.86, 0.86, 0.9], 0.9); L.ring(hx, hy, 52, 52, [1, 1, 1], down ? SK.hand.ring : SK.hand.ring * 0.4, 0.12); } }
    // ---- stuck card: the retry panel (a tap anywhere starts again from gate 1) ----
    if (ST.fail >= 0 && ST.end < 0) { const a = GT - ST.fail, k = SS(0.15, 0.6, a); L.solid(0, 0, W, H, [0.02, 0.04, 0.08], 0, 0, 0, 0.55 * k);
      const cw = 820, ch = 650, cx0 = W / 2 - cw / 2, cy0 = H * 0.5 - ch / 2 - 40 * (1 - k); panel(cx0, cy0, cw, ch, k, 56); L.uiBox('failp', cx0, cy0, cw, ch, 10);
      label('fail1', 'Карта застряла в очереди', W / 2, cy0 + 100, { size: 56, ink: 'base', al: 0.5, a: k }); L.uiBox('fail1', cx0 + 20, cy0 + 50, cw - 40, 100, 4);
      label('fail2', 'Пройдено ' + ST.passed + ' из ' + K.GATES, W / 2, cy0 + 190, { size: 46, ink: 'muted', al: 0.5, a: k });
      const bw = 520, bh = 130, bx = W / 2 - bw / 2, by = cy0 + 270, pul = 1 + 0.03 * Math.sin(GT * 6) * (a > K.FAIL_WAIT ? 1 : 0);
      rr(bx - (pul - 1) * bw / 2, by - (pul - 1) * bh / 2, bw * pul, bh * pul, 0.5, SK.cta.end[0], SK.cta.end[1], k * (a > K.FAIL_WAIT ? 1 : 0.5)); L.uiBox('retry', bx, by, bw, bh, 6);
      label('retry', 'Ещё раз', W / 2, by + bh / 2, { size: 60, ink: 'cta', al: 0.5, a: k, shadow: 0 });
      const sw2 = 500, sh2 = 120, sx2 = W / 2 - sw2 / 2, sy2 = by + bh + 36; ghost(sx2, sy2, sw2, sh2, k);
      L.uiBox('failcta', sx2, sy2, sw2, sh2, 6); label('failcta', 'Оформить карту', W / 2, sy2 + sh2 / 2, { size: 42, ink: 'base', al: 0.5, a: k }); S.hit.push({ id: 'cta', x: sx2, y: sy2, w: sw2, h: sh2 }); }
    if (ST.att > 0 && GT < 0.5) L.solid(0, 0, W, H, [0.02, 0.04, 0.08], 0, 0, 0, 1 - SS(0, 0.45, GT));

    // ---- persistent store button (only when the network demands it: variant `adnet`) ----
    if ((ST.ctaBar !== undefined ? ST.ctaBar : K.CTA_BAR) && ST.end < 0) { const bw = 700, bh = 110, bx = W / 2 - bw / 2, by = H - 205, pul = 1 + 0.02 * Math.sin(t * 5);
      rr(bx - (pul - 1) * bw / 2, by - (pul - 1) * bh / 2, bw * pul, bh * pul, 0.5, SK.cta.bar[0], SK.cta.bar[1]); L.uiBox('cta', bx, by, bw, bh, 6);
      label('cta', 'Оформить карту', W / 2, by + bh / 2, { size: 54, ink: 'cta', al: 0.5, shadow: 0 }); S.hit.push({ id: 'cta', x: bx, y: by, w: bw, h: bh }); }
    // ===== endcard (its own opaque sheet): the collected rubles become a welcome bonus; otherwise the cashback is the hero =====
    if (ST.end >= 0) { const a = GT - ST.end, k = SS(0, 0.45, a), zf = clamp((H - 170) / 1650, 1, 1.3), oy = (H - 1920 * zf) / 2, Y = (y) => y * zf + oy, pop = (d) => { const q = clamp((a - d) / 0.35, 0, 1); return q < 1 ? 1.12 * ease(q) - 0.12 * q * q : 1; };
      const win = ST.endWhy === 'win', bonus = K.BONUS && win && ST.money >= K.BONUS_MIN, amt = fmt(ST.money * ease(Math.min(1, a / 1.3))) + ' ₽', amtFull = fmt(ST.money) + ' ₽';
      night(GT, k, H + 8, 0.42);
      const c1 = pop(0.1); if (c1 > 0.01) { const sc = 1.93 * c1, fl = 10 * Math.sin(GT * 1.6), cy = Y(470) + fl; L.glow(W / 2, cy, 420, MINT, 0.3 * k, 2.2);
        for (let i = 0; i < 5; i++) { const an = GT * 0.6 + i * 1.2566, rx = 380 + 20 * Math.sin(GT + i), ry = 150; coinSpr(W / 2 + Math.cos(an) * rx, cy + Math.sin(an) * ry - 20, 56 + 14 * Math.sin(an), Math.abs(Math.cos(GT * 3 + i)) * 0.8 + 0.2, k * c1); }
        drawCard(W / 2, cy, -0.1 + 0.05 * Math.sin(GT * 1.1), sc, 1, 4); glint(W / 2, cy, -0.1 + 0.05 * Math.sin(GT * 1.1), sc, GT); }
      const s1 = pop(0.25), s2 = pop(0.35);
      if (bonus) {                                                                                                                       // «Вам начислено 520 ₽ + кэшбэк 10 % первые 3 месяца»
        if (s1 > 0.01) { const w1 = labelW('e1', 'Вам начислено', { size: 52 }) + 60; L.uiBox('e1', W / 2 - w1 / 2, Y(765) - 45, w1, 90, 6); label('e1', 'Вам начислено', W / 2, Y(765), { size: Math.round(52 * s1), ink: 'base', al: 0.5 }); }
        if (s2 > 0.01) { const w2 = labelW('e2m', amtFull, { size: 150 }) + 60; L.uiBox('e2', W / 2 - w2 / 2, Y(905) - 95, w2, 190, 6); L.glow(W / 2, Y(905), 330, GOLD0, 0.16 * k, 2.2); label('e2', amt, W / 2, Y(905), { size: Math.round(150 * s2), ink: 'gold', al: 0.5 });
          const t3 = '+ кэшбэк 10 % первые 3 месяца', w3 = labelW('e3', t3, { size: 46 }) + 60; L.uiBox('e3', W / 2 - w3 / 2, Y(1035) - 40, w3, 80, 6); label('e3', t3, W / 2, Y(1035), { size: 46, ink: 'base', al: 0.5, a: s2 > 0.9 ? 1 : 0 }); }
      } else {
        const hd = win ? 'Карта БАНК' : 'Улети от очередей';
        if (s1 > 0.01) { const w1 = labelW('e1', hd, { size: 60 }) + 60; L.uiBox('e1', W / 2 - w1 / 2, Y(770) - 50, w1, 100, 6); label('e1', hd, W / 2, Y(770), { size: Math.round(60 * s1), ink: 'base', al: 0.5 }); }
        if (s2 > 0.01) { const w2 = labelW('e2', 'Кэшбэк 10 %', { size: 140 }) + 60; L.uiBox('e2', W / 2 - w2 / 2, Y(910) - 90, w2, 180, 6); label('e2', 'Кэшбэк 10 %', W / 2, Y(910), { size: Math.round(140 * s2), ink: 'hero', al: 0.5 });
          const w3 = labelW('e3', 'первые 3 месяца', { size: 52 }) + 60; L.uiBox('e3', W / 2 - w3 / 2, Y(1030) - 40, w3, 80, 6); label('e3', 'первые 3 месяца', W / 2, Y(1030), { size: 52, ink: 'base', al: 0.5, a: s2 > 0.9 ? 1 : 0 }); }
      }
      const s3 = pop(0.5); if (s3 > 0.01) { const rows = [['Обслуживание 0 ₽', 'Онлайн за 5 минут'], ['Карту привезём завтра']], fs = 40, chh = Math.round(fs * 1.9), ci = { n: 0 };           // the same words as the plus chips in flight
        rows.forEach((row, ri) => { const ws = row.map((c, i) => labelW('ch' + (ri * 2 + i), c, { size: fs }) + 44), tot = ws.reduce((x, y) => x + y, 0) + 16 * (row.length - 1), cy = Y(1135) + ri * (chh + 14); let x = W / 2 - tot / 2;
          row.forEach((c, i) => { const id = 'ch' + (ri * 2 + i); ghost(x, cy - chh / 2, ws[i], chh, s3, [0.20, 0.28, 0.44], [0.14, 0.21, 0.36]); L.uiBox(id, x, cy - chh / 2, ws[i], chh, 4); label(id, c, x + ws[i] / 2, cy, { size: fs, ink: 'base', al: 0.5, a: s3 }); x += ws[i] + 16; }); }); }
      const s4 = pop(0.65); if (s4 > 0.01 && bonus) { const t4 = 'за монеты, собранные в полёте', w4 = labelW('e4', t4, { size: 36 }) + 60; L.uiBox('e4', W / 2 - w4 / 2, Y(1305) - 36, w4, 72, 6); label('e4', t4, W / 2, Y(1305), { size: 36, ink: 'muted', al: 0.5, a: s4 }); }
      const s5 = pop(0.8), pul = 1 + 0.03 * Math.sin(t * 6), bw = 700 * s5 * pul, bh = 150 * s5 * pul, bx = W / 2 - bw / 2, by = Y(1440) - bh / 2;
      if (s5 > 0.01) { L.glow(W / 2, Y(1440), 440, MINT, 0.25 * k, 2.2); rr(bx, by + 10, bw, bh, 0.5, SK.cta.endBase[0], SK.cta.endBase[1]); rr(bx, by, bw, bh, 0.5, SK.cta.end[0], SK.cta.end[1]); L.uiBox('endcta', bx, by, bw, bh, 6);
        { const q = (GT * 0.6) % 1, x1 = bx + bh * 0.7 + (bw - bh * 1.4 - 120) * q, al = Math.sin(Math.PI * q) * s5; for (let i = 0; i < 6; i++) rr(x1 + i * 18, by + 20, 18, bh - 40, 0, [1, 1, 1], [1, 1, 1], 0.07 * al * Math.sin(Math.PI * (i + 0.5) / 6)); }       // soft shine band
        label('endcta', bonus ? 'Забрать ' + amtFull : 'Оформить карту', W / 2, by + bh / 2, { size: Math.round(64 * s5), ink: 'ctaEnd', al: 0.5, shadow: 0 }); S.hit.push({ id: 'cta', x: bx, y: by, w: bw, h: bh }); }
      if (a > 1.0) { const rw = 330, ry = Y(1630), q = SS(1.0, 1.4, a); ghost(W / 2 - rw / 2, ry - 40, rw, 80, 0.8 * q);
        L.uiBox('replayb', W / 2 - rw / 2, ry - 40, rw, 80, 4); label('replayb', 'Ещё раз', W / 2, ry, { size: 42, ink: 'base', al: 0.5, a: q }); S.hit.unshift({ id: 'replay', x: W / 2 - rw / 2 - 20, y: ry - 75, w: rw + 40, h: 150 }); } }
  };

  // QA hooks: every HUD screen at its worst case, staged from the attract replay where it happens naturally
  S.QA = () => {
    const at = (tt, o = {}) => Object.assign(JSON.parse(JSON.stringify(SIM.at(tt))), o);
    const endAt = (why, o = {}) => { const s = at(SIM.L - 0.01); return Object.assign(s, { endWhy: why }, o); };
    const g = at(3.0), hit = at(4.4); hit.ev.push({ k: 'hit', t: hit.t - 0.1, side: 'bot', i: 1, free: false, lives: 2, x: 0, y: hit.y }); hit.lives = 2; hit.invT = hit.t - 0.1;
    const failed = at(8); Object.assign(failed, { fail: failed.t - 1, lives: 0 });
    const nearS = at(3.0); nearS.ev.push({ k: 'near', t: nearS.t - 0.1, i: 0, side: 'bot', x: 0, y: nearS.y }); const lowW = endAt('win', { money: 40 }), firstC = at(1.4); firstC.ev.push({ k: 'coin', t: firstC.t - 0.3, x: 0, y: 0, sx: firstC.sx, n: 1, v: 20, c: 1 });
    return { states: [['start', at(0.3)], ['near', nearS], ['coin1', firstC], ['end_lowwin', lowW], ['ctabar', at(5, { ctaBar: true })], ['fly', at(5)], ['gate', g], ['hit', hit], ['almost', at(12.2)], ['doors', at(16.0)], ['finale', at(18.0)], ['fail', failed],
      ['end_win', endAt('win')], ['end_passive', endAt('passive')], ['end_idle', endAt('idle')], ['end_timeout', endAt('timeout')], ['money_worst', at(10, { money: 99999 })]], cycles: {}, sprites: {}, box: () => [0, 0, W, H] };
  };
})();
