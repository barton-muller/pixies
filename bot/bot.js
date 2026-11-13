"use strict";

const PIXBOT = (() => {
  const E = typeof module !== "undefined" ? require("./engine.js") : PIXIES;
  const COMPACT = { compactDown: true };

  const evaluate = (s, p) => {
    let own = 0;
    for (const pl of s.piles) {
      const t = pl[pl.length - 1];
      if (t && !t.down) own += t.card.owner === p ? 1 : -1;
    }
    return E.score(s, p).total - E.score(s, 1 - p).total + 0.2 * own;
  };

  const keepValue = (c) => (c.c === "j" ? 3 : c.sp ? 2 : c.sw - c.x) - 1;

  function chooseKeep(s, moves) {
    const byId = new Map(s.hands[s.turn].map((c) => [c.id, c]));
    let best = moves[0], bv = -Infinity;
    for (const m of moves) {
      const v = m.ids.reduce((a, id) => a + keepValue(byId.get(id)), 0);
      if (v > bv) { bv = v; best = m; }
    }
    return best;
  }

  function greedyPick(s, moves, r) {
    const p = s.turn;
    let best = moves[0], bv = -Infinity;
    for (const m of moves) {
      const v = evaluate(E.apply(s, m), p) + r() * 1e-6;
      if (v > bv) { bv = v; best = m; }
    }
    return best;
  }

  const randomPick = (moves, r) => moves[Math.floor(r() * moves.length)];

  function sampled(s, moves, r, k) {
    const p = s.turn;
    let best = null, bv = -Infinity;
    for (let i = 0; i < k; i++) {
      const m = randomPick(moves, r), v = evaluate(E.apply(s, m), p);
      if (v > bv) { bv = v; best = m; }
    }
    return best;
  }

  function determinize(s, p, r) {
    const d = E.clone(s), o = 1 - p;
    const seen = [new Set(), new Set()];
    let hidden = 0;
    for (const pl of d.piles) for (const e of pl) {
      if (e.down && e.card.owner === o) { hidden++; continue; }
      seen[e.card.owner].add(e.card.id);
      if (e.boost) seen[e.boost.owner].add(e.boost.id);
    }
    const mine = new Set(s.hands[p].map((c) => c.id));
    d.decks[p] = E.shuffle(s.cards[p].filter((c) => !seen[p].has(c.id) && !mine.has(c.id)), r);
    const pool = E.shuffle(s.cards[o].filter((c) => !seen[o].has(c.id)), r).slice(hidden);
    const k = s.hands[o].length;
    d.hands[o] = pool.slice(0, k);
    d.decks[o] = pool.slice(k);
    return d;
  }

  function playout(s, r) {
    while (!s.over && s.phase === "play") E.step(s, sampled(s, E.legalMoves(s, COMPACT), r, 3));
    return s;
  }

  function pimcPick(s, moves, r, samples) {
    const p = s.turn, tot = new Float64Array(moves.length), base = Math.floor(r() * 2 ** 30);
    for (let i = 0; i < samples; i++) {
      const det = determinize(s, p, r);
      moves.forEach((m, j) => { tot[j] += evaluate(playout(E.apply(det, m), E.rng(base + i)), p); });
    }
    let bj = 0;
    for (let j = 1; j < moves.length; j++) if (tot[j] > tot[bj]) bj = j;
    return moves[bj];
  }

  function make(spec) {
    const [kind, arg] = spec.split(":"), n = arg === undefined ? undefined : +arg;
    const policy = {
      random: (s, moves, r) => randomPick(moves, r),
      greedy: (s, moves, r) => (r() < (n || 0) ? randomPick(moves, r) : greedyPick(s, moves, r)),
      pimc: (s, moves, r) => (moves.length === 1 ? moves[0] : pimcPick(s, moves, r, n || 16)),
    }[kind];
    if (!policy) throw new Error(`unknown bot "${spec}"`);
    return {
      name: spec,
      choose(s, r) {
        const moves = E.legalMoves(s, kind === "random" ? {} : COMPACT);
        if (s.phase === "keep") return kind === "random" ? randomPick(moves, r) : chooseKeep(s, moves);
        return moves.length === 1 ? moves[0] : policy(s, moves, r);
      },
    };
  }

  return { make, determinize, evaluate };
})();

if (typeof module !== "undefined") module.exports = PIXBOT;
