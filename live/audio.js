// live/audio.js — «Полёт карты»: procedural sound (WebAudio, zero asset bytes) driven by the sim event bus S.ev.
// index.html calls AUDIO.tick(state) once per frame in play mode; the context starts on the first user gesture (autoplay policy) and
// AUDIO.mute(bool) is wired to ad-network viewability / audio-volume callbacks.
// Music: in the rival bank — a deliberately dull "hold the line" electric piano (90 BPM, muffled by a low-pass that opens as the exit gets closer);
// after the doors — a bright pad + arpeggio in the same key (110 BPM). SFX go through a soft bus (high-shelf −4 dB from 3.5 kHz + low-pass 9 kHz).
(function () {
  let ac = null, out = null, musicG = null, musicLP = null, sfxG = null, last = -1, muted = false, nbuf = null;
  let mode = 'office', stepI = 0, nextT = 0, lastTick = 0, lastFlap = 0, started = false, duck = 0.32;
  const SKs = (typeof window !== 'undefined' && window.SKIN && window.SKIN.sfx) || { pitch: 1 }, PM = SKs.pitch || 1, hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const start = () => {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    ac = new C(); const comp = ac.createDynamicsCompressor(); comp.threshold.value = -24; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.2;
    out = ac.createGain(); out.gain.value = muted ? 0 : 0.9; out.connect(comp); comp.connect(ac.destination);
    musicLP = ac.createBiquadFilter(); musicLP.type = 'lowpass'; musicLP.frequency.value = 700; musicLP.Q.value = 0.5; musicG = ac.createGain(); musicG.gain.value = 0; musicG.connect(musicLP); musicLP.connect(out);
    const sh = ac.createBiquadFilter(); sh.type = 'highshelf'; sh.frequency.value = 3500; sh.gain.value = -4; const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 9000;
    sfxG = ac.createGain(); sfxG.gain.value = 2.4; sfxG.connect(sh); sh.connect(lp); lp.connect(out);
  };
  addEventListener('pointerdown', start, { capture: true }); addEventListener('touchend', start, { capture: true }); addEventListener('keydown', start, { capture: true });
  const noise = () => { if (nbuf) return nbuf; nbuf = ac.createBuffer(1, ac.sampleRate * 0.8, ac.sampleRate); const d = nbuf.getChannelData(0);
    let s = 12345; for (let i = 0; i < d.length; i++) { s = (s * 16807) % 2147483647; d[i] = (s / 2147483647) * 2 - 1; } return nbuf; };
  const env = (node, dst, t0, a, peak, dur) => { const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); node.connect(g); g.connect(dst); return g; };
  const tone = (freq, t0, dur, type = 'sine', peak = 0.2, slide = 0, dst = sfxG, a = 0.006) => { const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq * PM, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(freq * PM * slide, t0 + dur); env(o, dst, t0, a, peak, dur); o.start(t0); o.stop(t0 + dur + 0.05); };
  const burst = (t0, dur, f0, f1, peak, q = 1.2, type = 'bandpass', dst = sfxG) => { const s = ac.createBufferSource(); s.buffer = noise(); const f = ac.createBiquadFilter();
    f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(f1, t0 + dur); s.connect(f); env(f, dst, t0, 0.004, peak, dur); s.start(t0); s.stop(t0 + dur + 0.05); };

  // ---------------- SFX ----------------
  const SFX = {
    flap: (t0) => { burst(t0, 0.09, 700 + 300 * Math.random(), 2200, 0.07, 1.4); tone(520 + 80 * Math.random(), t0, 0.06, 'sine', 0.03, 1.5); },
    coin: (t0, e) => { const n = Math.min(10, (e && e.n) || 1), f = hz([84, 86, 88, 91, 93, 96, 98, 100, 103, 105][n - 1]); tone(f, t0, 0.09, 'sine', 0.10); tone(f * 1.5, t0 + 0.055, 0.14, 'sine', 0.08); },
    gate: (t0, e) => { const up = e && e.clean ? 1 : 0.8; [523, 659, 784].forEach((f, i) => tone(f * up, t0 + i * 0.045, 0.30, 'triangle', 0.09)); burst(t0, 0.22, 3200, 600, 0.06, 0.9); },
    near: (t0) => { burst(t0, 0.18, 900, 5000, 0.09, 1.1); tone(1568, t0 + 0.03, 0.12, 'sine', 0.04); },
    hit: (t0) => { tone(220, t0, 0.20, 'triangle', 0.30, 0.45); tone(110, t0, 0.22, 'sine', 0.22, 0.5); burst(t0, 0.28, 2400, 500, 0.16, 0.8); burst(t0 + 0.05, 0.3, 1800, 400, 0.05, 0.7); },
    life: (t0) => { tone(196, t0 + 0.05, 0.28, 'sine', 0.16, 0.55); },
    fail: (t0) => [392, 311, 233].forEach((f, i) => tone(f, t0 + i * 0.16, 0.55, 'triangle', 0.10)),
    retry: (t0) => { tone(262, t0, 0.35, 'sine', 0.10, 2.0); burst(t0, 0.3, 400, 2400, 0.05, 1.0); },
    doors: (t0) => { burst(t0, 0.7, 300, 3800, 0.10, 0.8); [1047, 1319, 1568].forEach((f, i) => tone(f, t0 + 0.12 + i * 0.07, 0.6, 'sine', 0.06)); },
    win: (t0) => { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, t0 + i * 0.075, 0.55, 'triangle', 0.09)); burst(t0, 0.9, 500, 6000, 0.08, 0.7); },
    almost: (t0) => { [659, 880].forEach((f, i) => tone(f, t0 + i * 0.09, 0.3, 'triangle', 0.07)); },
    boom: (t0) => { burst(t0, 0.25, 1200, 200, 0.09, 0.8, 'lowpass'); burst(t0 + 0.04, 0.5, 5000, 1500, 0.03, 0.6, 'highpass'); },
    tick: (t0, e) => tone(900 + 60 * ((e && e.n) || 0), t0, 0.04, 'sine', 0.05),
    end: (t0) => [784, 988, 1175, 1568].forEach((f, i) => tone(f, t0 + i * 0.09, 0.5, 'sine', 0.08)),
  };

  // ---------------- music ----------------
  const CHORDS = [[57, 60, 64, 67], [62, 65, 69, 72], [55, 59, 62, 65], [60, 64, 67, 71]];          // Am7 Dm7 G7 Cmaj7 — the hold-music loop
  const SKY = [[60, 64, 67, 72], [55, 59, 62, 67], [57, 60, 64, 69], [53, 57, 60, 65]];             // C G Am F — the same key, bright
  const piano = (f, t0, dur, vel) => { const o = ac.createOscillator(), o2 = ac.createOscillator(); o.type = 'sine'; o2.type = 'triangle'; o.frequency.value = f; o2.frequency.value = f * 2.003;
    const g2 = ac.createGain(); g2.gain.value = 0.25; o2.connect(g2); const m = ac.createGain(); m.gain.value = 1; o.connect(m); g2.connect(m); env(m, musicG, t0, 0.008, vel, dur); o.start(t0); o2.start(t0); o.stop(t0 + dur + 0.05); o2.stop(t0 + dur + 0.05); };
  const pad = (notes, t0, dur, vel) => notes.forEach((n) => { for (const d of [-6, 7]) { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(n) * Math.pow(2, d / 1200);
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1600; o.connect(f); env(f, musicG, t0, dur * 0.35, vel / notes.length, dur); o.start(t0); o.stop(t0 + dur + 0.05); } });
  const music = (S, now) => {
    const want = S.winT >= 0 ? 'sky' : 'office';
    if (want !== mode) { mode = want; stepI = 0; nextT = now + 0.05; }
    const bpm = mode === 'sky' ? 110 : 90, sd = 60 / bpm / 2;
    if (nextT < now) nextT = now + 0.02;
    while (nextT < now + 0.3) {
      const bar = Math.floor(stepI / 8) % 4, s = stepI % 8, t0 = nextT;
      if (mode === 'office') { const c = CHORDS[bar];
        if (s === 0) { piano(hz(c[0]), t0, 0.9, 0.14); piano(hz(c[0] + 12), t0, 0.6, 0.12); }
        if (s === 2) piano(hz(c[2] + 12), t0, 0.5, 0.10); if (s === 3) piano(hz(c[1] + 12), t0, 0.5, 0.08); if (s === 5) piano(hz(c[3] + 12), t0, 0.5, 0.09); if (s === 6) piano(hz(c[2] + 12), t0, 0.4, 0.07);
      } else { const c = SKY[bar];
        if (s === 0) pad(c, t0, sd * 8, 0.26);
        piano(hz(c[s % 4] + 12 + (s >= 4 ? 12 : 0)), t0, sd * 1.6, s % 2 ? 0.07 : 0.10);
      }
      nextT += sd; stepI++;
    }
  };

  window.AUDIO = {
    mute: (m) => { muted = m; if (out) out.gain.value = m ? 0 : 0.9; },
    play: (name, e) => { if (ac && SFX[name]) SFX[name](ac.currentTime, e); },
    tick: (S) => {
      if (!ac || !S) return; const now = ac.currentTime;
      if (S.t < last) { last = -1; mode = 'office'; stepI = 0; nextT = 0; started = false; lastTick = 0; }                      // restart / retry / replay
      for (const e of S.ev) { if (e.t <= last) continue;
        if (e.k === 'flap') { if (now - lastFlap > 0.05) { SFX.flap(now); lastFlap = now; } continue; }
        if (e.k === 'hit') { SFX.hit(now); if (!e.free) SFX.life(now); continue; }
        if (e.k === 'win') { SFX.win(now); setTimeout(() => ac && SFX.boom(ac.currentTime), 450); setTimeout(() => ac && SFX.boom(ac.currentTime), 900); setTimeout(() => ac && SFX.boom(ac.currentTime), 1350); continue; }
        if (SFX[e.k]) SFX[e.k](now, e); }
      const p = Math.max(0, Math.min(1, S.sx / Math.max(1, (window.SIM ? SIM.doorX() - SIM.K.CARD_X : 6000))));
      if (S.firstIn >= 0) { started = true; music(S, now); }
      if (S.end >= 0 && S.endWhy === 'win') { const a = S.t - S.end; if (a < 1.2 && now - lastTick > 0.07) { SFX.tick(now, { n: Math.floor(a * 14) }); lastTick = now; } }
      const dead = S.fail >= 0 && S.end < 0, target = S.end >= 0 ? 0.5 : dead ? 0.25 : started ? 0.9 : 0;
      musicG.gain.setTargetAtTime(target, now, 0.2);
      musicLP.frequency.setTargetAtTime(mode === 'sky' || S.end >= 0 ? 7000 : 600 + 3000 * p * p, now, 0.2);
      last = S.t;
    },
  };
})();
