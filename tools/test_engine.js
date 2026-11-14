#!/usr/bin/env node
"use strict";

const assert = require("assert");
const E = require("../bot/engine.js");
const B = require("../bot/bot.js");
const DECK = require("../bot/deck.js");

let nid = 1000;
const card = (n, c, o = {}) => E.mkCard({ n, c, ...o }, nid++);

function blank(round = 1) {
  const s = E.newGame(1);
  s.round = round;
  s.mult = round + 1;
  s.up = [Array(9).fill(null), Array(9).fill(null)];
  s.down = [Array(9).fill(null), Array(9).fill(null)];
  s.placed = [0, 0];
  s.reveal = [];
  s.turn = 0;
  s.starter = 0;
  s.pickIdx = 0;
  return s;
}

// Deck: counts per number as printed on the cards, 70 cards in total.
{
  const per = Array(9).fill(0);
  DECK.forEach((c) => per[c.n - 1]++);
  assert.deepStrictEqual(per, [5, 6, 8, 10, 12, 10, 8, 6, 5]);
  assert.strictEqual(DECK.length, 70);
  assert.strictEqual(DECK.filter((c) => c.c === "m").length, 6);
  assert.strictEqual(DECK.filter((c) => c.sp).length, 8);
  assert.ok(DECK.every((c) => !(c.sw && c.x) && !(c.sp && (c.sw || c.x))));
}

// Rulebook worked example, round 1: 21 + 11 + 8 = 40.
{
  const s = blank(1), up = s.up[0], down = s.down[0], back = () => card(1, "r");
  up[0] = card(1, "b", { sw: 6 }); down[0] = back();
  up[1] = card(2, "m");
  up[2] = card(3, "b", { sw: 3 });
  up[3] = card(4, "b", { sp: "b" });
  up[4] = card(5, "g", { x: 1 }); down[4] = back();
  down[5] = back();
  up[6] = card(7, "y", { sw: 1 }); down[6] = back();
  up[7] = card(8, "b", { x: 3 }); down[7] = back();
  down[8] = back();
  const sc = E.score(s, 0);
  assert.deepStrictEqual([sc.val, sc.sym, sc.zone, sc.total], [21, 11, 4, 40]);
  s.mult = 4;
  assert.strictEqual(E.score(s, 0).total, 21 + 11 + 16);
}

// Placement cases.
{
  const s = blank(), c = card(3, "g");
  assert.deepStrictEqual(E.placements(s, 0, c), [{ kind: 1, opt: -1 }]);
  s.down[0][2] = card(9, "r");
  assert.deepStrictEqual(E.placements(s, 0, c), [{ kind: 1, opt: -1 }]);
  s.reveal = [c];
  E.step(s, { id: c.id, kind: 1, opt: -1 });
  assert.strictEqual(s.up[0][2], c);
  assert.ok(s.down[0][2], "case 1 on a facedown card validates");
  assert.strictEqual(E.score(s, 0).val, 3);

  const s2 = blank(), old = card(4, "b"), nw = card(4, "y");
  s2.up[0][3] = old;
  assert.deepStrictEqual(E.placements(s2, 0, nw).map((p) => p.kind), [2, 2]);
  s2.reveal = [nw];
  E.step(s2, { id: nw.id, kind: 2, opt: 1 });
  assert.strictEqual(s2.up[0][3], old);
  assert.strictEqual(s2.down[0][3], nw);

  const s3 = blank();
  s3.up[0][4] = card(5, "b");
  s3.down[0][4] = card(8, "b");
  s3.up[0][0] = card(1, "b");
  const mv = E.placements(s3, 0, card(5, "g"));
  assert.ok(mv.every((p) => p.kind === 3));
  assert.deepStrictEqual(mv.map((p) => p.opt), [1, 2, 3, 5, 6, 7, 8]);
}

// Zone rules: diagonals do not connect, singletons score nothing, multi is wild.
{
  const s = blank(1);
  s.up[0][0] = card(1, "b");
  s.up[0][4] = card(5, "b");
  assert.strictEqual(E.score(s, 0).zone, 0);
  s.up[0][1] = card(2, "m");
  assert.strictEqual(E.score(s, 0).zone, 3);
  s.up[0][8] = card(9, "b");
  assert.strictEqual(E.score(s, 0).zone, 3);
}

// Two-player round end: filling first player's area ends the round once placements are equal.
{
  const s = blank(1);
  for (let i = 0; i < 8; i++) s.down[0][i] = card(1, "r");
  s.draw = Array.from({ length: 8 }, () => card(9, "r"));
  const a = card(9, "g"), b = card(9, "y"), c = card(2, "b"), d = card(2, "g");
  s.reveal = [a, b, c, d];
  E.step(s, { id: a.id, kind: 1, opt: -1 });
  assert.strictEqual(s.round, 1, "second player must still place");
  assert.strictEqual(s.turn, 1);
  E.step(s, { id: b.id, kind: 1, opt: -1 });
  assert.strictEqual(s.round, 2);
  assert.strictEqual(s.roundScores.length, 1);
  assert.strictEqual(s.starter, 1, "last player to place starts the next round");
}

// Full games: conservation, termination, legality, three rounds.
for (const spec of [["random", "random"], ["greedy", "greedy:0.2"], ["mc:3", "greedy"]]) {
  const bots = spec.map(B.make);
  for (let g = 0; g < 5; g++) {
    const s = E.newGame(g + 1), r = E.rng(g + 99);
    let guard = 0;
    while (!s.over) {
      const m = bots[s.turn].choose(s, r);
      assert.ok(E.legalMoves(s).some((x) => JSON.stringify(x) === JSON.stringify(m)), "illegal move chosen");
      E.step(s, m);
      if (!s.over) {
        const n = s.draw.length + s.reveal.length + [0, 1].reduce((a, p) => a + s.up[p].filter(Boolean).length + s.down[p].filter(Boolean).length, 0);
        assert.strictEqual(n, 70, "cards not conserved");
      }
      assert.ok(++guard < 1000, "no termination");
    }
    assert.strictEqual(s.roundScores.length, 3);
  }
}

// Hidden fourth card: the engine marks one card per reveal, and bots never use its identity.
{
  const h = E.newGame(5, undefined, { hideFourth: true });
  assert.strictEqual(h.hiddenId, h.reveal[3].id);
  assert.strictEqual(E.newGame(5).hiddenId, null);

  for (const spec of ["random", "greedy", "greedy:0.2", "mc:6"]) {
    const bot = B.make(spec);
    for (let g = 0; g < 4; g++) {
      const s = E.newGame(g + 40, undefined, { hideFourth: true }), r = E.rng(g + 7);
      let checked = 0;
      while (!s.over) {
        const hid = s.reveal.find((c) => c.id === s.hiddenId);
        if (hid && s.draw.length > 6 && checked < 6) {
          // swap the hidden card's identity with a different card from the draw pile
          const alt = s.draw.find((c) => c.k !== hid.k);
          const t = E.clone(s);
          t.reveal = t.reveal.map((c) => (c === hid ? { ...alt, id: hid.id } : c));
          t.draw = t.draw.map((c) => (c === alt ? hid : c));
          const a = bot.choose(E.clone(s), E.rng(g * 31 + checked)), b = bot.choose(t, E.rng(g * 31 + checked));
          assert.strictEqual(a.id === hid.id, b.id === hid.id, `${spec}: decision depends on the hidden card`);
          if (a.id !== hid.id) assert.deepStrictEqual(a, b, `${spec}: visible move depends on the hidden card`);
          checked++;
        }
        const m = bot.choose(s, r);
        assert.ok(E.legalMoves(s).some((x) => JSON.stringify(x) === JSON.stringify(m)), `${spec}: illegal move in hidden mode`);
        E.step(s, m);
      }
      assert.strictEqual(s.roundScores.length, 3);
    }
  }
}

console.log("ok");
