"use strict";

const BATTLE = (() => {
  const SW = `<svg viewBox="3 3 18 18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 12.4c-1.1.1-1.6-1.2-.8-1.9 1.1-.9 2.9-.1 3.2 1.4.4 2.1-1.5 3.8-3.7 3.5-2.8-.4-4.2-3.4-3.4-5.9.9-3 4.2-4.5 7.1-3.6 3.6 1.1 5 5.3 3.6 8.6"/></svg>`;
  const XX = `<svg viewBox="4 4 16 16" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>`;
  const rep = (s, n) => (n > 0 ? s.repeat(n) : "");
  const signed = (v) => (v < 0 ? `−${-v}` : `${v}`);

  /* cards: {n, c: b|g|y|r|j, sw, x, sp, val, owner, down, side, boost, ghost} */
  function card(c) {
    if (c.down) return `<div class="bc down"></div>`;
    return `<div class="bc c-${c.c}${c.ghost ? " ghost" : ""}">
      <div class="bsw">${rep(SW, c.sw || 0)}</div><b>${c.n}</b><div class="bxx">${rep(XX, c.x || 0)}</div>
      ${c.sp ? `<span class="bsp">${SW}</span>` : ""}
      ${c.owner ? `<span class="bown">${c.owner}</span>` : ""}
      ${c.val !== undefined ? `<span class="bval">${signed(c.val)}</span>` : ""}
    </div>`;
  }

  function pile(cards, label = "", mark = "") {
    const step = 24, W = 56, H = 78, base = 11;
    const boosted = cards.some((c) => c.boost);
    const w = boosted ? 114 : 78;
    const h = H + step * (cards.length - 1);
    const parts = cards.map((c, i) => {
      const top = i * step, z = i * 3;
      let out = "";
      if (c.boost) out += `<div class="bw" style="left:${base + 25}px;top:${top + 11}px;z-index:${z}">${card(c.boost)}</div>`;
      out += c.side
        ? `<div class="bw" style="left:${base - 11}px;top:${top + 11}px;z-index:${z + 1}">${card(c)}</div>`
        : `<div class="bm" style="left:${base}px;top:${top}px;z-index:${z + 1}">${card(c)}</div>`;
      return out;
    });
    return `<figure class="pf"><div class="pile" style="width:${w}px;height:${h + (cards.some((c) => c.side) ? 0 : 0)}px">${parts.join("")}</div>${mark ? `<div class="mark">${mark}</div>` : ""}<figcaption>${label}</figcaption></figure>`;
  }

  const single = (c, label = "", mark = "") => pile([c], label, mark);
  const arrow = (t = "→") => `<div class="arr">${t}</div>`;
  const row = (...x) => `<div class="brow">${x.join("")}</div>`;

  function board(c1 = {}, c2 = {}, hi1 = [], hi2 = []) {
    const cell = (c, n, hi) => `<div class="mc${hi.includes(n) ? " hi" : ""}">${c[n] || n}</div>`;
    let cells = "";
    for (let r = 0; r < 3; r++) {
      for (let k = 1; k <= 3; k++) cells += cell(c1, r * 3 + k, hi1);
      for (let k = 1; k <= 3; k++) cells += cell(c2, r * 3 + k, hi2);
    }
    return `<div class="mb"><div class="mbt"><span>Grid 1</span><span>Grid 2</span></div><div class="mbg">${cells}</div></div>`;
  }

  const G1 = [["g", 2, 0], ["b", 1, 0], ["y"], ["g", "3+1", 0], ["b", 0, 1, 0], ["b"], ["y"], ["b", 1], ["r", 0, 0, 0]];
  const G2 = [["y"], ["g", 1], ["r", 0, 1], ["b", 2], ["y", 0, 0, 0], ["r"], ["g", 0, 0, 0], ["y"], ["r"]];
  const boardOf = (G, details, hi) => Object.fromEntries(G.map(([c, sw, x, fin], k) => [k + 1, tile(k + 1, { c, sw: details ? sw : 0, x: details ? x : 0, fin: fin !== 0, hi: hi.includes(k + 1) })]));

  function tile(n, o = {}) {
    const mid = `${o.sw ? `<em>${SW}${o.sw}</em>` : ""}${o.x ? `<em>${XX}${o.x}</em>` : ""}`;
    return `<div class="mt c-${o.c}${o.fin === false ? " unf" : ""}${o.hi ? " hi" : ""}"><small>${n}</small>${mid}</div>`;
  }

  const steps = [
    {
      t: "The idea",
      p: "Two players share <b>two 3×3 grids placed side by side</b>, one board of 18 cells. Every cell is a pile. Three cards finish a pile, and whoever's card is on top wins it. The game ends as soon as all 18 cells hold at least one card. A single card per cell is enough; no stack has to be finished.",
      s: () => row(board()),
    },
    {
      t: "Your deck",
      p: "Split the cards by colour: <b>A</b> takes blue + green, <b>B</b> takes yellow + red. Shuffle the multicoloured jokers and deal them out equally.",
      s: () => `<div class="bdecks">
        <div><div class="who a">A</div>${row(single({ n: 3, c: "b", sw: 1 }), single({ n: 7, c: "g" }), single({ n: 2, c: "j", sw: 1 }))}</div>
        <div><div class="who b">B</div>${row(single({ n: 4, c: "y", sw: 1 }), single({ n: 8, c: "r", x: 3 }), single({ n: 5, c: "j", x: 1 }))}</div>
      </div>`,
    },
    {
      t: "Rounds and hands",
      p: "Draw up to six cards, then take turns playing <b>four</b> of them. Playing two cards at once (booster or joker) uses <b>two</b> of your four plays. Once you have made your four plays, your opponent keeps taking consecutive turns until they have made theirs. Before the next round, each of your two leftovers goes either to the bottom of your deck or stays in your hand. Most cards end up stacked on others, so a game usually takes many rounds.",
      s: () => row(
        ...[{ n: 2, c: "g" }, { n: 6, c: "b", sw: 2 }, { n: 9, c: "g", x: 1 }, { n: 4, c: "b", sw: 1 }].map((c) => single(c, "play")),
        ...[{ n: 5, c: "b" }, { n: 1, c: "g", sw: 3 }].map((c) => single(c, "left over"))),
    },
    {
      t: "The number is the cell",
      p: "A card goes onto the cell that matches its number. You choose the left or right grid.",
      s: () => row(single({ n: 5, c: "g", sw: 1 }), arrow(), board({}, {}, [5], [5])),
    },
    {
      t: "Card value",
      p: "A card's value is <b>swirls minus crosses</b>. A special card (swirl + colour symbol) also gains +1 for every <i>other</i> card of its colour on the board right now. Cards in a hand or in the deck don't count.",
      s: () => row(
        single({ n: 2, c: "y", sw: 3, val: 3 }, "3 swirls"),
        single({ n: 4, c: "r", x: 2, val: -2 }, "2 crosses"),
        single({ n: 6, c: "g", sw: 1, sp: 1, val: 3 }, "1 swirl + 2 green cards on the board")),
    },
    {
      t: "Example: cell 4, first card",
      p: "B opens cell 4 with yellow 4: one swirl, value 1.",
      s: () => row(pile([{ n: 4, c: "y", sw: 1, val: 1 }], "cell 4")),
    },
    {
      t: "Covering an opponent",
      p: "To cover an opponent's top card, your card's value must be <b>strictly higher</b>. A blue 4 worth 1 can't cover a 1. A green 4 worth 2 can.",
      s: () => row(
        pile([{ n: 4, c: "y", sw: 1 }, { n: 4, c: "b", sw: 1, val: 1, ghost: 1 }], "1 is not higher than 1", "✗"),
        pile([{ n: 4, c: "y", sw: 1 }, { n: 4, c: "g", sw: 2, val: 2 }], "2 beats 1", "✓")),
    },
    {
      t: "Your own pile is free",
      p: "If you own the top card of a pile, you may add a card above or below it without a value check. Slide a card underneath and the pile has three cards: finished, and you win it.",
      s: () => row(
        pile([{ n: 6, c: "y", sw: 1 }, { n: 6, c: "g", sw: 2, val: 2 }], "A is on top"),
        single({ n: 6, c: "b" }, "any value"),
        arrow("⤵"),
        pile([{ n: 6, c: "b" }, { n: 6, c: "y", sw: 1 }, { n: 6, c: "g", sw: 2, side: 1 }], "finished: A wins cell 6")),
    },
    {
      t: "Boosters",
      p: "Play two cards of the same colour at once and put the second behind the first, turned sideways so its swirls show. Their values add up but they count as <b>one card</b> in the pile, while using two of your four plays. Red 4 (1) + red 2 swirls = 3, enough to cover A's 2.",
      s: () => row(
        pile([{ n: 4, c: "y", sw: 1 }, { n: 4, c: "g", sw: 2, val: 2 }], "B to move"),
        single({ n: 4, c: "r", sw: 1 }, "card"),
        `<div class="arr">+</div>`,
        single({ n: 2, c: "r", sw: 2 }, "booster"),
        arrow("="),
        pile([{ n: 4, c: "y", sw: 1 }, { n: 4, c: "g", sw: 2 }, { n: 4, c: "r", sw: 1, val: 3, boost: { n: 2, c: "r", sw: 2 } }], "value 3")),
    },
    {
      t: "A finished pile",
      p: "The pile now has three cards, so its top card is turned sideways and nothing can change it any more. B wins cell 4. The booster's swirls still count when scoring.",
      s: () => row(pile([{ n: 4, c: "y", sw: 1 }, { n: 4, c: "g", sw: 2 }, { n: 4, c: "r", sw: 1, side: 1, boost: { n: 2, c: "r", sw: 2 } }], "B wins cell 4")),
    },
    {
      t: "Nothing to play? Face down",
      p: "Any card can go face down on an <b>empty</b> cell, whatever its number. A card with no legal play must go there. It sits at the bottom of that pile, counts as one of the three cards and has value 0.",
      s: () => row(
        single({ n: 9, c: "g", x: 1 }, "no legal play"),
        arrow(),
        board({}, { 2: `<div class="dn"></div>`, 4: `<div class="dn"></div>`, 8: `<div class="dn"></div>` })),
    },
    {
      t: "Jokers: finishing a pile",
      p: "A joker is never the top card; it always sits inside the pile. Played alone (one play) on a pile of <b>two</b>, it makes three: the pile is finished and you may reorder all three cards. Put one of your own cards on top to win it, even if it is worth less. You may play a joker on any pile, even one without a card of yours. On a pile of one it just slides underneath, which is worth little.",
      s: () => `${row(
        pile([{ n: 7, c: "g" }, { n: 7, c: "y", sw: 2, val: 2 }], "B's 2 is on top"),
        `<div class="arr">+</div>`,
        single({ n: 7, c: "j", sw: 1, owner: "A" }, "joker, alone"),
        arrow(),
        pile([{ n: 7, c: "y", sw: 2 }, { n: 7, c: "j", sw: 1, owner: "A" }, { n: 7, c: "g", side: 1 }], "reordered: A wins with a 0"))}
        <div class="bsep"></div>
        ${row(
          pile([{ n: 3, c: "y", sw: 1, val: 1 }], "a pile of one"),
          `<div class="arr">+</div>`,
          single({ n: 3, c: "j", owner: "A" }, "joker"),
          arrow(),
          pile([{ n: 3, c: "j", owner: "A" }, { n: 3, c: "y", sw: 1 }], "underneath, no reorder"))}`,
    },
    {
      t: "Jokers: with a partner",
      p: "A joker can also go down together with a card of the same number: two cards, <b>two plays</b>. On a pile of one that makes three, so the pile is finished and you reorder it, again with a card of yours on top and the joker never on top.",
      s: () => row(
        pile([{ n: 7, c: "y", sw: 2, val: 2 }], "B's 2 is on top"),
        single({ n: 7, c: "g" }, "partner"),
        `<div class="arr">+</div>`,
        single({ n: 7, c: "j", sw: 1, owner: "A" }, "joker"),
        arrow(),
        pile([{ n: 7, c: "y", sw: 2 }, { n: 7, c: "j", sw: 1, owner: "A" }, { n: 7, c: "g", side: 1 }], "A wins cell 7 with a 0")),
    },
    {
      t: "End of the game",
      p: "As soon as every cell has at least one card, the game is over. A single card per cell is enough, nothing has to be finished. Finished piles (three cards) are sideways and score their cell number. Unfinished piles still count for swirls, crosses and colour regions on top.",
      s: () => row(board(boardOf(G1, false, []), boardOf(G2, false, []))),
    },
    {
      t: "Scoring",
      p: "Score the whole board, both grids together. Here A holds the blue and green tiles. Dashed tiles are unfinished. Colour regions run across the gap between the grids.",
      s: () => `${row(board(boardOf(G1, true, [2, 5, 6, 8]), boardOf(G2, true, [4])))}
      <table class="bscore">
        <tr><td>Finished piles on top: grid 1 (1+2+4+6+8) and grid 2 (2+4)</td><td>27</td></tr>
        <tr><td>Biggest colour region: blue, 5 cells across both grids × 3</td><td>15</td></tr>
        <tr><td>Swirls on top, boosters included</td><td>+11</td></tr>
        <tr><td>Crosses on top</td><td>−1</td></tr>
        <tr class="tot"><td>A's total</td><td>52</td></tr>
      </table>
      <p class="bnote">Score card: put 27 in <i>full cells</i>, 5 in <i>colour area</i>, 11 in swirls and 1 in crosses, all in the Round 2 block (colour area ×3). Pixies count +1 each if you play that rule.</p>`,
    },
  ];

  let i = 0;

  function render() {
    const el = document.getElementById("view-battle");
    const s = steps[i];
    el.innerHTML = `
      <div class="card">
        <div class="bar">Pix your battles<small>${i + 1} / ${steps.length}</small></div>
        <h2 class="bt">${s.t}</h2>
        <div class="bscene">${s.s()}</div>
        <p class="btext">${s.p}</p>
        <div class="bnav">
          <button class="btn ghost small" id="b-prev" ${i === 0 ? "disabled" : ""}>Back</button>
          <div class="dots">${steps.map((_, k) => `<button data-k="${k}" class="${k === i ? "on" : ""}" aria-label="Step ${k + 1}"></button>`).join("")}</div>
          <button class="btn small" id="b-next" ${i === steps.length - 1 ? "disabled" : ""}>Next</button>
        </div>
      </div>`;
    el.querySelector("#b-prev").onclick = () => { i = Math.max(0, i - 1); render(); };
    el.querySelector("#b-next").onclick = () => { i = Math.min(steps.length - 1, i + 1); render(); };
    el.querySelectorAll(".dots button").forEach((b) => (b.onclick = () => { i = +b.dataset.k; render(); }));
  }

  return { render };
})();
