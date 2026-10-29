// smoke_test.mjs — plays a built single-file playable headless, like a QA tester on a phone would.
//   node tools/smoke_test.mjs [dist/default/applovin.html] [--shots dir]
// Mobile viewport + touch, a stub MRAID container that records mraid.open, real touch taps that play the ad to its endcard (flying through the gates, retrying when stuck), a tap on the endcard CTA.
// Fails (exit 1) on: page errors, any network request other than mraid.js, no endcard, no coins collected, touch stuck, CTA not reaching mraid.open, fps below 50.
import { createRequire } from 'node:module'; import path from 'node:path'; import fs from 'node:fs'; import { pathToFileURL } from 'node:url';
const req = createRequire(import.meta.url);
const { chromium } = req(process.env.PLAYWRIGHT || 'playwright');
const file = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'dist/default/applovin.html');
const si = process.argv.indexOf('--shots'), shots = si > 0 ? process.argv[si + 1] : 'frames/smoke'; fs.mkdirSync(shots, { recursive: true });

const browser = await chromium.launch({ args: ['--enable-gpu', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const errors = [], external = []; let touchFail = '';
ctx.on('request', (r) => { const u = r.url(); if (!u.startsWith('data:') && !u.startsWith('file:')) external.push(u); });
await ctx.route('**/mraid.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: `
  window.mraid = { _l: {}, opened: [], getState: () => 'default', isViewable: () => true,
    addEventListener(k, f) { (this._l[k] = this._l[k] || []).push(f); }, open(u) { this.opened.push(u); } };` }));
const p = await ctx.newPage();
p.on('pageerror', (e) => errors.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await p.goto(pathToFileURL(file).href);
try { await p.waitForFunction(() => window.__ready, null, { timeout: 20000 }); }
catch (e) { console.log(JSON.stringify({ file: path.basename(file), fails: ['did not boot: ' + (errors.join(' | ') || e.message)] })); await browser.close(); process.exit(1); }
await p.waitForTimeout(600); await p.screenshot({ path: path.join(shots, '0_start.png') });
const box = await p.locator('canvas').boundingBox(), VIEW = await p.evaluate(() => SIM.VIEW);
const V = (x, y) => [box.x + x / VIEW.W * box.width, box.y + y / VIEW.H * box.height];
// a real touch on the canvas (touch events, not the mouse): pointer events must keep flowing and the pointer must be released when the
// finger lifts. Without touch-action:none the browser fires pointercancel after a few moves and the control sticks.
const cdp = await ctx.newCDPSession(p), tp = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
{ const [tx, ty] = V(540, 1500); await tp('touchStart', tx, ty); let lastX = tx; for (let i = 1; i <= 12; i++) { lastX = tx + i * 6; await tp('touchMove', lastX, ty); await p.waitForTimeout(40); }
  const mid = await p.evaluate(() => ({ x: window.__ptr && __ptr.x, down: window.__ptr && __ptr.down })); await tp('touchEnd'); await p.waitForTimeout(300);
  const after = await p.evaluate(() => ({ down: window.__ptr && __ptr.down })), want = (lastX - box.x) / box.width * VIEW.W;
  if (!mid.down || Math.abs(mid.x - want) > 40) touchFail = 'touch drag stopped following the finger (pointer x ' + Math.round(mid.x) + ', finger at ' + Math.round(want) + ')';
  else if (after.down) touchFail = 'pointer still down after the finger lifted'; }
// play the whole ad with real taps: the attract planner decides WHEN (SIM.scriptInput), a touch tap does it; a stuck card is retried by a tap
// on the retry panel; the test passes through the finale to the endcard (fails if it does not get there in 150 s)
const [tapX, tapY] = V(540, 1500); let ended = false, tapN = 0, retries = 0, shot1 = false, lastAtt = 0; const tPlay = Date.now();
while (Date.now() - tPlay < 150000) {
  const st = await p.evaluate(() => { const s = SCENE.state; if (!s) return null; return { click: SIM.scriptInput(s.t, s).click, end: s.end, failAge: s.fail >= 0 ? s.t - s.fail : -1, att: s.att, passed: s.passed, t: s.t }; });
  if (!st) { await p.waitForTimeout(30); continue; }
  if (st.end >= 0) { ended = true; break; }
  if (st.att !== lastAtt) { lastAtt = st.att; retries++; }
  if (!shot1 && st.passed >= 3) { shot1 = true; await p.screenshot({ path: path.join(shots, '1_flying.png') }); }
  if (st.click || st.failAge > 0.8) { await tp('touchStart', tapX, tapY); await tp('touchEnd'); tapN++; await p.waitForTimeout(40); } else await p.waitForTimeout(6);
}
await p.waitForTimeout(1800);
const money = await p.evaluate(() => SCENE.state && SCENE.state.money);
const fps = await p.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else res(n); }; requestAnimationFrame(f); }));
// tap the CTA on the endcard (the game ends by itself after the finale)
const findCta = () => p.evaluate(() => (SCENE.hit || []).find((b) => b.id === 'cta'));
let cta = await findCta();
await p.screenshot({ path: path.join(shots, '1b_endcard.png') });
if (cta) { const [cx, cy] = V(cta.x + cta.w / 2, cta.y + cta.h / 2); await p.mouse.click(cx, cy); }
const opened = await p.evaluate(() => (window.mraid && window.mraid.opened) || []);
await p.screenshot({ path: path.join(shots, '2_after_cta.png') });
await browser.close();
const fails = [];
if (errors.length) fails.push('page errors: ' + errors.join(' | '));
const ext = external.filter((u) => !u.endsWith('/mraid.js')); if (ext.length) fails.push('external requests: ' + ext.join(', '));
if (!ended) fails.push('the ad did not reach the endcard by tapping (150 s)');
if (!(money > 0)) fails.push('no coins collected (money=' + money + ')');
if (touchFail) fails.push(touchFail);
if (!opened.length) fails.push('CTA did not call mraid.open');
if (fps < 50) fails.push('fps ' + fps);
console.log(JSON.stringify({ file: path.basename(file), view: VIEW, money, taps: tapN, retries, fps, cta: opened[0] || null, fails }));
process.exit(fails.length ? 1 : 0);
