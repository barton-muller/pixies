#!/usr/bin/env node
"use strict";

const E = require("../bot/engine.js");
const B = require("../bot/bot.js");

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i < 0 ? d : process.argv[i + 1];
};

const games = +arg("games", 100), seed = +arg("seed", 1);
const specs = [arg("a", "greedy"), arg("b", "random")];
const bots = specs.map(B.make);

let points = 0, wins = [0, 0], draws = 0, rounds = 0;
const margins = [];
const t0 = Date.now();

for (let g = 0; g < games; g++) {
  const swap = g % 2, s = E.newGame(seed + g), r = E.rng(seed * 7919 + g);
  const seat = (p) => bots[(p + swap) % 2];
  while (!s.over) E.step(s, seat(s.turn).choose(s, r));
  const { scores, winner } = E.result(s);
  const mine = swap ? 1 : 0;
  margins.push(scores[mine] - scores[1 - mine]);
  rounds += s.round;
  if (winner < 0) { draws++; points += 0.5; }
  else if (winner === mine) { wins[0]++; points += 1; }
  else wins[1]++;
}

const mean = margins.reduce((a, b) => a + b, 0) / games;
const sd = Math.sqrt(margins.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, games - 1));
const p = points / games, ci = 1.96 * Math.sqrt((p * (1 - p)) / games);
console.log(`${specs[0]} vs ${specs[1]}  (${games} games, seats alternated, ${((Date.now() - t0) / 1000).toFixed(1)}s)`);
console.log(`wins ${wins[0]}-${wins[1]}  draws ${draws}  score ${(100 * p).toFixed(1)}% ±${(100 * ci).toFixed(1)}`);
console.log(`mean margin ${mean.toFixed(1)} ±${((1.96 * sd) / Math.sqrt(games)).toFixed(1)}   avg rounds ${(rounds / games).toFixed(1)}`);
