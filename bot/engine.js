"use strict";

const PIXIES = (() => {
  const DECK = typeof module !== "undefined" ? require("./deck.js") : PIXIES_DECK;
  const COLOURS = ["b", "g", "y", "r"];
  const REVEAL = 4, ROUNDS = 3;

  const rng = (seed) => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  const shuffle = (a, r) => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const rnd = (s) => {
    s.seed = (s.seed + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s.seed ^ (s.seed >>> 15), 1 | s.seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const NBM = Array.from({ length: 9 }, (_, i) => {
    const row = (i / 3) | 0, col = i % 3;
    let m = 0;
    if (row > 0) m |= 1 << (i - 3);
    if (row < 2) m |= 1 << (i + 3);
    if (col > 0) m |= 1 << (i - 1);
    if (col < 2) m |= 1 << (i + 1);
    return m;
  });

  const popcount = (m) => {
    let n = 0;
    for (; m; m &= m - 1) n++;
    return n;
  };

  const mkCard = (c, id) => ({ sw: 0, x: 0, sp: null, ...c, id, k: `${c.n}${c.c}${c.sw || 0}${c.x || 0}${c.sp || ""}` });

  /* ---------- setup ---------- */

  function deal(s) {
    s.reveal = s.draw.splice(0, REVEAL);
    s.hiddenId = s.hideFourth ? s.reveal[REVEAL - 1].id : null;
  }

  function startRound(s, starter) {
    s.round++;
    s.mult = s.round + 1;
    s.up = [Array(9).fill(null), Array(9).fill(null)];
    s.down = [Array(9).fill(null), Array(9).fill(null)];
    s.placed = [0, 0];
    s.draw = shuffle(s.pool.slice(), () => rnd(s));
    deal(s);
    s.starter = starter;
    s.turn = starter;
    s.pickIdx = 0;
  }

  function newGame(seed, deck = DECK, opts = {}) {
    const pool = deck.map(mkCard), numCount = Array(9).fill(0);
    pool.forEach((c) => numCount[c.n - 1]++);
    const s = { pool, numCount, seed: seed >>> 0, round: 0, mult: 0, totals: [0, 0], roundScores: [], last: 0, over: false, hideFourth: !!opts.hideFourth, hiddenId: null };
    startRound(s, rnd(s) < 0.5 ? 0 : 1);
    return s;
  }

  const clone = (s) => ({
    ...s, up: s.up.map((a) => a.slice()), down: s.down.map((a) => a.slice()), draw: s.draw.slice(),
    reveal: s.reveal.slice(), placed: s.placed.slice(), totals: s.totals.slice(), roundScores: s.roundScores.slice(),
  });

  /* ---------- scoring ---------- */

  function score(s, p) {
    const up = s.up[p], down = s.down[p], cnt = { b: 0, g: 0, y: 0, r: 0 };
    let val = 0, sym = 0, multi = 0;
    for (let i = 0; i < 9; i++) {
      const c = up[i];
      if (!c) continue;
      if (down[i]) val += c.n;
      sym += c.sw - c.x;
      if (c.c === "m") multi++;
      else cnt[c.c]++;
    }
    for (let i = 0; i < 9; i++) if (up[i] && up[i].sp) sym += cnt[up[i].sp] + multi;
    let zone = 0;
    for (const col of COLOURS) {
      if (cnt[col] + multi < 2) continue;
      let mask = 0;
      for (let i = 0; i < 9; i++) if (up[i] && (up[i].c === col || up[i].c === "m")) mask |= 1 << i;
      let rest = mask;
      while (rest) {
        let comp = rest & -rest, frontier = comp;
        while (frontier) {
          const b = frontier & -frontier;
          frontier ^= b;
          const nb = NBM[31 - Math.clz32(b)] & mask & ~comp;
          comp |= nb;
          frontier |= nb;
        }
        rest &= ~comp;
        const size = popcount(comp);
        if (size > zone) zone = size;
      }
    }
    if (zone < 2) zone = 0;
    return { val, sym, zone, total: val + sym + zone * s.mult };
  }

  /* ---------- moves ---------- */

  function placements(s, p, card) {
    const k = card.n - 1, up = s.up[p], down = s.down[p];
    if (!up[k]) return [{ kind: 1, opt: -1 }];
    if (!down[k]) return [{ kind: 2, opt: 0 }, { kind: 2, opt: 1 }];
    const out = [];
    for (let i = 0; i < 9; i++) if (!up[i] && !down[i]) out.push({ kind: 3, opt: i });
    return out.length ? out : [{ kind: 3, opt: -1 }];
  }

  function legalMoves(s) {
    if (s.over) return [];
    const seen = new Set(), out = [];
    for (const c of s.reveal) {
      if (seen.has(c.k)) continue;
      seen.add(c.k);
      for (const pl of placements(s, s.turn, c)) out.push({ id: c.id, ...pl });
    }
    return out;
  }

  function put(up, down, card, pl) {
    const k = card.n - 1;
    if (pl.kind === 1) up[k] = card;
    else if (pl.kind === 2) {
      if (pl.opt === 0) { down[k] = up[k]; up[k] = card; }
      else down[k] = card;
    } else if (pl.opt >= 0) down[pl.opt] = card;
  }

  function scoreAfter(s, p, card, pl) {
    if (pl.kind === 3) return score(s, p).total;
    const k = card.n - 1, up = s.up[p], down = s.down[p], u = up[k], d = down[k];
    put(up, down, card, pl);
    const t = score(s, p).total;
    up[k] = u;
    down[k] = d;
    return t;
  }

  /* ---------- transitions ---------- */

  function endRound(s) {
    const bd = [score(s, 0), score(s, 1)], a = bd[0].total, b = bd[1].total;
    s.lastBoard = { round: s.round, mult: s.mult, up: s.up.map((x) => x.slice()), down: s.down.map((x) => x.slice()), bd };
    s.roundScores.push([a, b]);
    s.totals[0] += a;
    s.totals[1] += b;
    if (s.round >= ROUNDS) s.over = true;
    else startRound(s, s.last);
  }

  const full = (s, p) => s.up[p].every((c, i) => c || s.down[p][i]);

  function step(s, m) {
    const p = s.turn, i = s.reveal.findIndex((c) => c.id === m.id), [card] = s.reveal.splice(i, 1);
    put(s.up[p], s.down[p], card, m);
    s.placed[p]++;
    s.last = p;
    if (s.placed[0] === s.placed[1] && (full(s, 0) || full(s, 1))) endRound(s);
    else if (++s.pickIdx === REVEAL) {
      if (s.draw.length < REVEAL) endRound(s);
      else {
        deal(s);
        s.starter = s.last;
        s.turn = s.starter;
        s.pickIdx = 0;
      }
    } else s.turn = s.pickIdx % 2 ? 1 - s.starter : s.starter;
    return s;
  }

  const apply = (s, m) => step(clone(s), m);

  const result = (s) => ({ totals: s.totals.slice(), winner: s.totals[0] === s.totals[1] ? -1 : s.totals[0] > s.totals[1] ? 0 : 1 });

  return { newGame, clone, legalMoves, placements, scoreAfter, step, apply, score, result, rng, shuffle, mkCard, COLOURS };
})();

if (typeof module !== "undefined") module.exports = PIXIES;
