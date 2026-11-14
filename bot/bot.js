"use strict";

const PIXBOT = (() => {
  const E = typeof module !== "undefined" ? require("./engine.js") : PIXIES;
  const DENY = 0.5, ROLLOUT_EPS = 0.15;

  const randomMove = (moves, r) => moves[Math.floor(r() * moves.length)];

  function greedy(s, r, eps = 0) {
    const moves = E.legalMoves(s);
    if (moves.length === 1) return moves[0];
    if (eps && r() < eps) return randomMove(moves, r);
    const p = s.turn, q = 1 - p, base = E.score(s, p).total, qBase = E.score(s, q).total, deny = new Map();
    let best = moves[0], bv = -Infinity;
    for (const m of moves) {
      const c = s.reveal.find((x) => x.id === m.id);
      if (!deny.has(c.k)) deny.set(c.k, Math.max(0, ...E.placements(s, q, c).map((pl) => E.scoreAfter(s, q, c, pl) - qBase)));
      const tie = m.kind === 3 && m.opt >= 0 ? 0.01 * s.numCount[m.opt] : 0;
      const v = E.scoreAfter(s, p, c, m) - base + DENY * deny.get(c.k) + tie + r() * 1e-6;
      if (v > bv) { bv = v; best = m; }
    }
    return best;
  }

  function determinize(s, r) {
    const d = E.clone(s), seen = new Set(s.reveal.map((c) => c.id));
    for (let p = 0; p < 2; p++) for (let i = 0; i < 9; i++) {
      if (s.up[p][i]) seen.add(s.up[p][i].id);
      if (s.down[p][i]) seen.add(s.down[p][i].id);
    }
    d.draw = E.shuffle(s.pool.filter((c) => !seen.has(c.id)), r);
    return d;
  }

  function monteCarlo(s, r, n) {
    const moves = E.legalMoves(s);
    if (moves.length === 1) return moves[0];
    const p = s.turn, round = s.round, tot = new Float64Array(moves.length);
    for (let i = 0; i < n; i++) {
      const det = determinize(s, r);
      moves.forEach((m, j) => {
        const t = E.apply(det, m);
        while (!t.over && t.round === round) E.step(t, greedy(t, r, ROLLOUT_EPS));
        const rs = t.roundScores[round - 1];
        tot[j] += rs[p] - rs[1 - p];
      });
    }
    let bj = 0;
    for (let j = 1; j < moves.length; j++) if (tot[j] > tot[bj]) bj = j;
    return moves[bj];
  }

  function make(spec) {
    const [kind, arg] = spec.split(":"), n = arg === undefined ? undefined : +arg;
    const choose = {
      random: (s, r) => randomMove(E.legalMoves(s), r),
      greedy: (s, r) => greedy(s, r, n || 0),
      mc: (s, r) => monteCarlo(s, r, n || 20),
    }[kind];
    if (!choose) throw new Error(`unknown bot "${spec}"`);
    return { name: spec, choose };
  }

  return { make, determinize, greedy };
})();

if (typeof module !== "undefined") module.exports = PIXBOT;
