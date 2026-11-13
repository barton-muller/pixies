#!/usr/bin/env node
"use strict";

const assert = require("assert");
const E = require("../bot/engine.js");
const B = require("../bot/bot.js");

const card = (id, owner, n, c, o = {}) => ({ id, owner, n, c, sw: 0, x: 0, sp: 0, ...o });
const own = { b: 0, g: 0, y: 1, r: 1 };
let nid = 1000;
const ent = (n, c, sw = 0, x = 0, extra = {}) => ({ card: card(nid++, own[c], n, c, { sw, x }), ...extra });

function blank() {
  const s = E.newGame(1);
  s.piles = s.piles.map(() => []);
  s.hands = [[], []];
  s.decks = [[], []];
  return s;
}

// Scoring worked example from the Battles tab (A holds blue + green): expect 52.
{
  const s = blank();
  const fill = (cell, c, n, sw, x, fin, boost) => {
    const e = ent(n, c, sw, x);
    if (boost) e.boost = card(nid++, own[c], 2, c, { sw: boost });
    const pl = [e];
    if (fin) pl.unshift(ent(n, "y"), ent(n, "y"));
    s.piles[cell] = pl;
  };
  const G1 = [["g", 2], ["b", 1], ["y"], ["g", 3, 0, 1, 1], ["b", 0, 1, 0], ["b"], ["y"], ["b", 1], ["d"]];
  const G2 = [["y"], ["g", 1], ["r", 0, 1], ["b", 2], ["d"], ["r"], ["g", 0, 0, 0], ["d"], ["r"]];
  [G1, G2].forEach((G, g) => G.forEach(([c, sw = 0, x = 0, fin, bo = 0], k) => {
    const cell = g * 9 + k;
    if (c === "d") s.piles[cell] = [{ card: card(nid++, 1, k + 1, "g"), down: true }];
    else fill(cell, c, k + 1, sw, x, fin !== 0, bo);
  }));
  const a = E.score(s, 0);
  assert.deepStrictEqual([a.full, a.area, a.sw, a.x, a.total], [27, 5, 11, 1, 52]);
}

// Covering: strict value, own pile free, special counts itself.
{
  const s = blank();
  s.piles[3] = [ent(4, "g")];
  s.piles[5] = [ent(6, "g")];
  s.piles[4] = [ent(5, "y", 1)];
  s.turn = 0;
  const blue = card(1, 0, 5, "b", { sw: 1 }), special = card(2, 0, 5, "g", { sp: 1 });
  s.hands[0] = [blue, special];
  const plays = E.legalMoves(s).filter((m) => m.t === "play" && m.cell === 4);
  assert.deepStrictEqual(plays.map((m) => m.id), [2]);
  const after = E.apply(s, plays[0]);
  assert.strictEqual(after.piles[4].length, 2);
}

// Booster: 2 + 2 beats a 3 special.
{
  const s = blank();
  s.piles[4] = [ent(5, "y", 1), { card: card(77, 0, 5, "g", { sp: 1 }) }];
  s.piles[3] = [ent(4, "g")];
  s.piles[5] = [ent(6, "g")];
  const r5 = card(1, 1, 5, "r", { sw: 2 }), r2 = card(2, 1, 2, "r", { sw: 2 });
  s.hands[1] = [r5, r2];
  s.turn = 1;
  const moves = E.legalMoves(s).filter((m) => m.t === "boost" && m.cell === 4);
  assert.ok(moves.some((m) => m.id === 1 && m.b === 2));
  assert.ok(!E.legalMoves(s).some((m) => m.t === "play" && m.cell === 4));
}

// Joker on a pile of two finishes it and lets the owner pick the top.
{
  const s = blank();
  s.piles[1] = [ent(2, "g"), ent(2, "y", 2)];
  s.hands[0] = [card(9, 0, 2, "j", { sw: 1 })];
  s.turn = 0;
  const mv = E.legalMoves(s).filter((m) => m.t === "joker" && m.cell === 1);
  assert.strictEqual(mv.length, 2);
  const done = E.apply(s, mv.find((m) => s.piles[1][m.top].card.owner === 0));
  assert.strictEqual(done.piles[1].length, 3);
  assert.strictEqual(done.piles[1][2].card.owner, 0);
}

// Full games: conservation, pile limits, termination, bots stay legal.
{
  for (const spec of [["random", "random"], ["greedy", "greedy:0.2"], ["pimc:4", "greedy"]]) {
    const bots = spec.map(B.make);
    for (let g = 0; g < 6; g++) {
      const s = E.newGame(g + 1), r = E.rng(g + 99), total = s.cards[0].length + s.cards[1].length;
      let guard = 0;
      while (!s.over) {
        const m = bots[s.turn].choose(s, r);
        assert.ok(E.legalMoves(s).some((x) => JSON.stringify(x) === JSON.stringify(m)) || m.t === "keep", "illegal move chosen");
        E.step(s, m);
        const n = s.piles.reduce((a, p) => a + p.reduce((b, e) => b + 1 + (e.boost ? 1 : 0), 0), 0)
          + s.hands.concat(s.decks).reduce((a, h) => a + h.length, 0);
        assert.strictEqual(n, total, "cards not conserved");
        assert.ok(s.piles.every((p) => p.length <= 3));
        assert.ok(++guard < 2000, "no termination");
      }
    }
  }
}

console.log("ok");
