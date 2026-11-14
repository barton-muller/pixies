"use strict";

// Rows: [number, colour, spirals, crosses, special]. Colours: b g y r, m = multi-coloured.
// A special earns one spiral per faceup card of its own colour (multi-coloured cards included).
// Transcribed from photos of the physical deck; per-number counts match the printed "x N".
const PIXIES_DECK = (() => {
  const ROWS = [
    [3, "y"], [4, "y", 3], [6, "y"], [6, "m", 0, 1], [4, "r", 2], [5, "y"], [3, "y", 5], [5, "r", 0, 1], [3, "r", 4], [7, "m", 0, 1],
    [1, "y", 4], [7, "y", 0, 5], [2, "b", 4], [7, "b", 0, 3], [5, "y", 0, 0, 1],
    [4, "b", 0, 0, 1], [7, "r", 0, 4], [8, "g", 0, 2], [4, "y", 0, 1], [1, "b", 6], [1, "r", 0, 0, 1], [4, "g", 4], [9, "y", 0, 2], [5, "r"],
    [2, "r", 5], [9, "r"], [5, "r", 0, 0, 1], [8, "m", 0, 1], [8, "r", 0, 5], [6, "r"], [6, "r", 0, 2], [2, "g", 3], [3, "m"],
    [6, "b", 1], [2, "y", 0, 0, 1], [3, "b", 3], [2, "m"], [6, "y", 0, 3], [8, "r"], [1, "r", 3], [4, "r"], [8, "y", 0, 1], [5, "b", 0, 0, 1],
    [5, "g", 0, 1], [5, "b"], [1, "g", 5], [3, "b", 1], [6, "b", 0, 1], [6, "g", 0, 1], [4, "m"], [4, "b", 1],
    [6, "g", 0, 4], [5, "y", 0, 2], [4, "g", 0, 1], [7, "y", 1], [2, "y", 2], [7, "g"], [3, "g", 0, 0, 1], [4, "b"], [8, "b", 0, 3], [9, "g", 0, 4],
    [9, "b", 0, 6], [7, "r", 0, 1], [3, "g", 2], [9, "b", 0, 1], [7, "g", 0, 2], [5, "b", 0, 2], [6, "g", 1], [5, "g"], [5, "g", 0, 0, 1],
  ];
  return ROWS.map(([n, c, sw = 0, x = 0, sp = 0]) => ({ n, c, sw, x, sp: sp ? c : null }));
})();

if (typeof module !== "undefined") module.exports = PIXIES_DECK;
