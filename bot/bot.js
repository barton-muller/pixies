"use strict";

const PIXBOT = (() => {
  const E = typeof module !== "undefined" ? require("./engine.js") : PIXIES;
  const DENY = 0.5, ROLLOUT_EPS = 0.15, BLIND_SAMPLES = 40;

  const randomMove = (moves, r) => moves[Math.floor(r() * moves.length)];
  const hiddenCard = (s) => (s.hiddenId == null ? null : s.reveal.find((c) => c.id === s.hiddenId) || null);
  const without = (s, c) => ({ ...s, reveal: s.reveal.filter((x) => x !== c) });
  const only = (s, c) => ({ ...s, reveal: [c] });

  function bestOf(s, moves, r) {
    const p = s.turn, q = 1 - p, base = E.score(s, p).total, qBase = E.score(s, q).total, deny = new Map();
    let best = moves[0], bv = -Infinity;
    for (const m of moves) {
      const c = s.reveal.find((x) => x.id === m.id);
      if (!deny.has(c.k)) deny.set(c.k, Math.max(0, ...E.placements(s, q, c).map((pl) => E.scoreAfter(s, q, c, pl) - qBase)));
      const tie = m.kind === 3 && m.opt >= 0 ? 0.01 * s.numCount[m.opt] : 0;
      const v = E.scoreAfter(s, p, c, m) - base + DENY * deny.get(c.k) + tie + r() * 1e-6;
      if (v > bv) { bv = v; best = m; }
    }
    return { m: best, v: bv };
  }

  function greedy(s, r, eps = 0, cands) {
    const moves = cands || E.legalMoves(s);
    if (moves.length === 1) return moves[0];
    if (eps && r() < eps) return randomMove(moves, r);
    return bestOf(s, moves, r).m;
  }

  function unseenPool(s) {
    const hid = hiddenCard(s), seen = new Set(s.reveal.filter((c) => c !== hid).map((c) => c.id));
    for (let p = 0; p < 2; p++) for (let i = 0; i < 9; i++) {
      if (s.up[p][i]) seen.add(s.up[p][i].id);
      if (s.down[p][i]) seen.add(s.down[p][i].id);
    }
    return s.pool.filter((c) => !seen.has(c.id));
  }

  function determinize(s, r) {
    const d = E.clone(s), hid = hiddenCard(s), pool = E.shuffle(unseenPool(s), r);
    if (hid) {
      const x = pool.pop();
      d.reveal = s.reveal.map((c) => (c === hid ? x : c));
      d.hiddenId = x.id;
    }
    d.draw = pool;
    return d;
  }

  function playout(t, round, r) {
    while (!t.over && t.round === round) E.step(t, greedy(t, r, ROLLOUT_EPS));
    return t;
  }

  function monteCarlo(s, r, n, cands) {
    const moves = cands || E.legalMoves(s);
    if (moves.length === 1) return moves[0];
    const p = s.turn, round = s.round, tot = new Float64Array(moves.length);
    for (let i = 0; i < n; i++) {
      const det = determinize(s, r);
      moves.forEach((m, j) => {
        const rs = playout(E.apply(det, m), round, r).roundScores[round - 1];
        tot[j] += rs[p] - rs[1 - p];
      });
    }
    let bj = 0;
    for (let j = 1; j < moves.length; j++) if (tot[j] > tot[bj]) bj = j;
    return moves[bj];
  }

  /* hidden fourth card: the decision to take it sees only a sampled unknown card */

  function blindValue(s, r) {
    const p = s.turn, base = E.score(s, p).total, pool = E.shuffle(unseenPool(s), r).slice(0, BLIND_SAMPLES);
    let sum = 0;
    for (const x of pool) sum += Math.max(...E.placements(s, p, x).map((pl) => E.scoreAfter(s, p, x, pl) - base));
    return sum / pool.length;
  }

  function mcBlind(s, r, n, vis) {
    const p = s.turn, round = s.round, tot = new Float64Array(vis.length + 1);
    for (let i = 0; i < n; i++) {
      const det = determinize(s, r), x = det.reveal.find((c) => c.id === det.hiddenId);
      const run = (m) => {
        const rs = playout(E.apply(det, m), round, r).roundScores[round - 1];
        return rs[p] - rs[1 - p];
      };
      vis.forEach((m, j) => { tot[j] += run(m); });
      tot[vis.length] += run(greedy(det, r, 0, E.legalMoves(only(det, x))));
    }
    let bj = 0;
    for (let j = 1; j <= vis.length; j++) if (tot[j] > tot[bj]) bj = j;
    return bj === vis.length ? null : vis[bj];
  }

  function make(spec) {
    const [kind, arg] = spec.split(":"), n = arg === undefined ? undefined : +arg;
    const base = {
      random: (s, r) => randomMove(E.legalMoves(s), r),
      greedy: (s, r) => greedy(s, r, n || 0),
      mc: (s, r) => monteCarlo(s, r, n || 20),
    }[kind];
    if (!base) throw new Error(`unknown bot "${spec}"`);

    const place = (known, r, hid) => {
      const cands = E.legalMoves(only(known, hid));
      if (cands.length === 1) return cands[0];
      if (kind === "random") return randomMove(cands, r);
      if (kind === "greedy") return bestOf(known, cands, r).m;
      return monteCarlo(known, r, n || 20, cands);
    };

    return {
      name: spec,
      choose(s, r) {
        const hid = hiddenCard(s);
        if (!hid) return base(s, r);
        const vis = E.legalMoves(without(s, hid)), known = { ...s, hiddenId: null };
        const take = () => place(known, r, hid);
        const gamble = () => (r() < 1 / s.reveal.length ? take() : randomMove(vis, r));
        if (!vis.length) return take();
        if (kind === "random") return gamble();
        if (kind === "greedy") {
          if (n && r() < n) return gamble();
          const b = bestOf(without(s, hid), vis, r);
          return blindValue(s, r) > b.v ? take() : b.m;
        }
        return mcBlind(s, r, n || 20, vis) || take();
      },
    };
  }

  return { make, determinize, greedy, hiddenCard };
})();

if (typeof module !== "undefined") module.exports = PIXBOT;
