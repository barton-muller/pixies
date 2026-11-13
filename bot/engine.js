"use strict";

const PIXIES = (() => {
  const SUITS = [["b", "g"], ["y", "r"]];
  const PLAYS = 4, HAND = 6, MAX_ROUNDS = 60, CELLS = 18;
  const DEFAULTS = { copies: 2, specials: 1, jokers: 4, areaMult: 3 };
  const SYMBOLS = [[0, 0, 0.34], [1, 0, 0.2], [2, 0, 0.13], [3, 0, 0.05], [0, 1, 0.15], [0, 2, 0.08], [0, 3, 0.05]];

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

  const symbols = (r) => {
    let u = r();
    for (const [sw, x, w] of SYMBOLS) if ((u -= w) < 0) return { sw, x };
    return { sw: 0, x: 0 };
  };

  // Cell index = grid * 9 + (number - 1). Grids sit side by side: a 3x6 board.
  const NB = Array.from({ length: CELLS }, (_, i) => {
    const g = Math.floor(i / 9), k = i % 9, row = Math.floor(k / 3), col = g * 3 + (k % 3);
    const at = (rr, cc) => (rr < 0 || rr > 2 || cc < 0 || cc > 5 ? -1 : Math.floor(cc / 3) * 9 + rr * 3 + (cc % 3));
    return [at(row - 1, col), at(row + 1, col), at(row, col - 1), at(row, col + 1)].filter((j) => j >= 0);
  });

  /* ---------- setup ---------- */

  function buildCards(r, o) {
    let id = 0;
    const cards = [[], []];
    SUITS.forEach((cols, p) => cols.forEach((c) => {
      const own = [];
      for (let k = 0; k < o.copies; k++) for (let n = 1; n <= 9; n++) own.push({ id: id++, n, c, ...symbols(r), sp: 0, owner: p });
      for (let k = 0; k < o.specials; k++) Object.assign(own[Math.floor(r() * own.length)], { sp: 1, sw: 0, x: 0 });
      cards[p].push(...own);
    }));
    for (let p = 0; p < 2; p++) {
      for (let k = 0; k < o.jokers; k++) cards[p].push({ id: id++, n: 1 + Math.floor(r() * 9), c: "j", sw: r() < 0.5 ? 1 : 0, x: 0, sp: 0, owner: p });
    }
    return cards;
  }

  function drawUp(s) {
    for (let p = 0; p < 2; p++) while (s.hands[p].length < HAND && s.decks[p].length) s.hands[p].push(s.decks[p].shift());
  }

  function newGame(seed, opts = {}) {
    const o = { ...DEFAULTS, ...opts }, r = rng(seed), cards = buildCards(r, o);
    const s = {
      cards, mult: o.areaMult, piles: Array.from({ length: CELLS }, () => []),
      hands: [[], []], decks: cards.map((c) => shuffle(c.slice(), r)),
      plays: [PLAYS, PLAYS], first: 0, turn: 0, round: 1, phase: "play", keeps: 0, over: false,
    };
    drawUp(s);
    return s;
  }

  const clone = (s) => ({
    ...s, piles: s.piles.map((p) => p.slice()), hands: s.hands.map((h) => h.slice()),
    decks: s.decks.map((d) => d.slice()), plays: s.plays.slice(),
  });

  /* ---------- values ---------- */

  const colourCounts = (s) => {
    const cc = { b: 0, g: 0, y: 0, r: 0 };
    for (const pl of s.piles) for (const e of pl) {
      if (e.down) continue;
      if (e.card.c in cc) cc[e.card.c]++;
      if (e.boost) cc[e.boost.c]++;
    }
    return cc;
  };

  const cardVal = (cc, c, inHand) => (c.sp ? cc[c.c] + (inHand ? 1 : 0) : c.sw - c.x);
  const entryVal = (cc, e) => (e.down ? 0 : cardVal(cc, e.card, false) + (e.boost ? e.boost.sw - e.boost.x : 0));
  const topOf = (pl) => pl[pl.length - 1];

  function positions(cc, p, pl, val) {
    if (!pl.length) return ["top"];
    if (pl.length >= 3) return [];
    const t = topOf(pl);
    if (t.card.owner === p) return ["top", "bottom"];
    return val > entryVal(cc, t) ? ["top"] : [];
  }

  /* ---------- scoring ---------- */

  function score(s, p) {
    const own = new Array(CELLS).fill(null);
    let full = 0, sw = 0, x = 0;
    s.piles.forEach((pl, i) => {
      const t = topOf(pl);
      if (!t || t.down || t.card.owner !== p) return;
      own[i] = t.card.c;
      if (pl.length >= 3) full += (i % 9) + 1;
      sw += t.card.sw + (t.boost ? t.boost.sw : 0);
      x += t.card.x + (t.boost ? t.boost.x : 0);
    });
    let area = 0;
    const seen = new Array(CELLS).fill(false);
    for (let i = 0; i < CELLS; i++) {
      if (!own[i] || seen[i]) continue;
      let size = 0;
      const stack = [i];
      seen[i] = true;
      while (stack.length) {
        const k = stack.pop();
        size++;
        for (const j of NB[k]) if (!seen[j] && own[j] === own[i]) { seen[j] = true; stack.push(j); }
      }
      if (size > area) area = size;
    }
    return { full, area, sw, x, total: full + area * s.mult + sw - x };
  }

  /* ---------- moves ---------- */

  const cellsOf = (n) => [n - 1, 8 + n];

  function keepMoves(s) {
    const h = s.hands[s.turn], n = Math.min(h.length, 5), tail = h.slice(n).map((c) => c.id), out = [];
    for (let m = 0; m < 1 << n; m++) out.push({ t: "keep", ids: h.slice(0, n).filter((_, i) => (m >> i) & 1).map((c) => c.id).concat(tail) });
    return out;
  }

  function legalMoves(s, opt = {}) {
    if (s.phase === "keep") return keepMoves(s);
    const p = s.turn, hand = s.hands[p], left = s.plays[p], cc = colourCounts(s), out = [];
    const empty = [];
    s.piles.forEach((pl, i) => { if (!pl.length) empty.push(i); });

    for (const c of hand) {
      const before = out.length;
      if (c.c !== "j") {
        const v = cardVal(cc, c, true);
        for (const cell of cellsOf(c.n)) {
          for (const pos of positions(cc, p, s.piles[cell], v)) out.push({ t: "play", id: c.id, cell, pos });
          if (left < 2) continue;
          for (const b of hand) {
            if (b.id === c.id || b.c !== c.c || b.sp) continue;
            for (const pos of positions(cc, p, s.piles[cell], v + b.sw - b.x)) out.push({ t: "boost", id: c.id, b: b.id, cell, pos });
          }
        }
      } else {
        for (const cell of cellsOf(c.n)) {
          const pl = s.piles[cell];
          if (pl.length === 1) out.push({ t: "joker", id: c.id, cell, top: -1 });
          else if (pl.length === 2) pl.forEach((e, i) => { if (!e.down && e.card.c !== "j") out.push({ t: "joker", id: c.id, cell, top: i }); });
          if (left < 2 || pl.length !== 1) continue;
          for (const q of hand) {
            if (q.c === "j" || q.n !== c.n) continue;
            if (!pl[0].down && pl[0].card.c !== "j") out.push({ t: "jpair", id: c.id, q: q.id, cell, top: 0 });
            out.push({ t: "jpair", id: c.id, q: q.id, cell, top: 1 });
          }
        }
      }
      if (opt.compactDown && out.length > before) continue;
      for (const cell of opt.compactDown ? empty.slice(0, 2) : empty) out.push({ t: "down", id: c.id, cell });
    }
    return out.length ? out : [{ t: "pass" }];
  }

  /* ---------- transitions ---------- */

  function startRound(s) {
    s.round++;
    s.first = 1 - s.first;
    s.turn = s.first;
    s.phase = "play";
    s.keeps = 0;
    s.plays = [PLAYS, PLAYS];
    drawUp(s);
    if (s.round > MAX_ROUNDS || (s.hands.every((h) => !h.length) && s.decks.every((d) => !d.length))) s.over = true;
  }

  function advance(s) {
    const p = s.turn, o = 1 - p;
    if (s.plays[o] > 0) s.turn = o;
    else if (s.plays[p] > 0) s.turn = p;
    else {
      s.phase = "keep";
      s.keeps = 0;
      s.turn = s.first;
    }
  }

  function keepStep(s, m) {
    const p = s.turn, keep = new Set(m.ids), h = s.hands[p];
    s.decks[p].push(...h.filter((c) => !keep.has(c.id)));
    s.hands[p] = h.filter((c) => keep.has(c.id));
    if (++s.keeps === 2) startRound(s);
    else s.turn = 1 - s.turn;
  }

  const put = (pl, e, pos) => (pos === "bottom" ? pl.unshift(e) : pl.push(e));

  function step(s, m) {
    if (s.phase === "keep") {
      keepStep(s, m);
      return s;
    }
    const p = s.turn, hand = s.hands[p], pl = s.piles[m.cell];
    const take = (id) => hand.splice(hand.findIndex((c) => c.id === id), 1)[0];
    let cost = 1;
    switch (m.t) {
      case "pass": cost = s.plays[p]; break;
      case "down": pl.push({ card: take(m.id), down: true }); break;
      case "play": put(pl, { card: take(m.id) }, m.pos); break;
      case "boost": cost = 2; put(pl, { card: take(m.id), boost: take(m.b) }, m.pos); break;
      case "joker": {
        const j = { card: take(m.id) };
        if (m.top < 0) pl.unshift(j);
        else s.piles[m.cell] = [j, ...pl.filter((_, i) => i !== m.top), pl[m.top]];
        break;
      }
      case "jpair": {
        cost = 2;
        const j = { card: take(m.id) }, both = [pl[0], { card: take(m.q) }];
        s.piles[m.cell] = [j, both[1 - m.top], both[m.top]];
        break;
      }
    }
    s.plays[p] -= cost;
    if (s.piles.every((l) => l.length)) s.over = true;
    else advance(s);
    return s;
  }

  const apply = (s, m) => step(clone(s), m);

  const result = (s) => {
    const a = score(s, 0), b = score(s, 1);
    return { scores: [a.total, b.total], winner: a.total === b.total ? -1 : a.total > b.total ? 0 : 1 };
  };

  return { newGame, clone, legalMoves, step, apply, score, result, rng, shuffle, SUITS, HAND, CELLS };
})();

if (typeof module !== "undefined") module.exports = PIXIES;
