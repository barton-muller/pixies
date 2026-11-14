"use strict";

importScripts("deck.js", "engine.js", "bot.js");

onmessage = (e) => {
  const { id, state, spec, seed } = e.data;
  postMessage({ id, move: PIXBOT.make(spec).choose(state, PIXIES.rng(seed)) });
};
