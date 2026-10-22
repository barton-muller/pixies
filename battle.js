"use strict";

const BATTLE = (() => {
  const SW = `<svg viewBox="3 3 18 18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 12.4c-1.1.1-1.6-1.2-.8-1.9 1.1-.9 2.9-.1 3.2 1.4.4 2.1-1.5 3.8-3.7 3.5-2.8-.4-4.2-3.4-3.4-5.9.9-3 4.2-4.5 7.1-3.6 3.6 1.1 5 5.3 3.6 8.6"/></svg>`;
  const XX = `<svg viewBox="4 4 16 16" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>`;
  const rep = (s, n) => (n > 0 ? s.repeat(n) : "");
  const signed = (v) => (v < 0 ? `−${-v}` : `${v}`);
  const reduced = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  const CW = 56, CH = 86, STEP = 24, PAD = 8, CELL_W = 90, CELL_WB = 128;

  /* ---------- cards ---------- */

  function cardHtml(id, s, o = {}) {
    const inner = o.down ? "" : `
      <div class="bsw">${rep(SW, s.sw || 0)}</div><b>${s.n}</b><div class="bxx">${rep(XX, s.x || 0)}</div>
      ${s.sp ? `<span class="bsp">${SW}<i>/</i><u></u></span>` : ""}
      ${s.owner ? `<span class="bown">${s.owner}</span>` : ""}
      ${o.val !== undefined ? `<span class="bval">${signed(o.val)}</span>` : ""}
      ${o.mark ? `<span class="bmark ${o.mark === "✓" ? "ok" : "no"}">${o.mark}</span>` : ""}`;
    return `<div class="bc ${o.down ? "down" : "c-" + s.c}${s.sp && !o.down ? " sp" : ""}${o.cls ? " " + o.cls : ""}" data-id="${id}" data-rot="${o.rot || 0}" style="${o.style || ""}">${inner}</div>`;
  }

  const scard = (s, label = "", val) => `<figure class="pf">${cardHtml("", s, { cls: "inhand", val })}<figcaption>${label}</figcaption></figure>`;
  const row = (...x) => `<div class="brow">${x.join("")}</div>`;
  const rowFit = (...x) => `<div class="brow one">${x.join("")}</div>`;

  /* ---------- static boards ---------- */

  function board(c1 = {}, c2 = {}) {
    const cell = (c, n) => `<div class="mc">${c[n] || n}</div>`;
    let cells = "";
    for (let r = 0; r < 3; r++) {
      for (let k = 1; k <= 3; k++) cells += cell(c1, r * 3 + k);
      for (let k = 1; k <= 3; k++) cells += cell(c2, r * 3 + k);
    }
    return `<div class="mb"><div class="mbt"><span>Grid 1</span><span>Grid 2</span></div><div class="mbg">${cells}</div></div>`;
  }

  function tile(n, o = {}) {
    const mid = `${o.sw ? `<em>${SW}${o.sw}</em>` : ""}${o.x ? `<em>${XX}${o.x}</em>` : ""}`;
    return `<div class="mt c-${o.c}${o.fin === false ? " unf" : ""}${o.hi ? " hi" : ""}"><small>${n}</small>${mid}</div>`;
  }

  const G1 = [["g", 2], ["b", 1], ["y"], ["g", "3+1"], ["b", 0, 1, 0], ["b"], ["y"], ["b", 1], ["d", 0, 0, 0]];
  const G2 = [["y"], ["g", 1], ["r", 0, 1], ["b", 2], ["d", 0, 0, 0], ["r"], ["g", 0, 0, 0], ["d", 0, 0, 0], ["r"]];
  const boardOf = (G, details, hi) =>
    Object.fromEntries(G.map(([c, sw, x, fin], k) => [k + 1, tile(k + 1, { c, sw: details ? sw : 0, x: details ? x : 0, fin: fin !== 0, hi: hi.includes(k + 1) })]));

  /* ---------- animated scenes ---------- */

  const ent = (e) => (typeof e === "string" ? { id: e } : e);

  function dimsOf(step) {
    const dims = [];
    step.stages.forEach((st) => (st.fields || []).forEach((f, fi) => {
      const d = (dims[fi] ||= { w: {}, h: 98 });
      f.cells.forEach((n) => {
        const p = ((f.piles || {})[n] || []).map(ent);
        const boost = p.some((e) => e.boost);
        d.w[n] = Math.max(d.w[n] || CELL_W, boost ? CELL_WB : CELL_W);
        let need = PAD * 2 + CH + STEP * Math.max(0, p.length - 1);
        if (boost) need = Math.max(need, 160);
        d.h = Math.max(d.h, need);
      });
    }));
    return dims;
  }

  function geometry(entries, fin, h) {
    const g = {};
    const n = entries.length, cx = CELL_W / 2;
    entries.forEach((e, i) => {
      if (!fin) {
        const cy = PAD + CH / 2 + i * STEP;
        g[e.id] = { cx, cy, rot: 0, z: i * 3 + 1 };
        if (e.boost) g[e.boost] = { cx: cx + 36, cy, rot: 90, z: i * 3 };
      } else {
        const x = cx + (i - (n - 1) / 2) * 3, y = h / 2 + ((n - 1) / 2 - i) * 3;
        g[e.id] = { cx: x, cy: y, rot: -90, z: i * 3 + 1 };
        if (e.boost) g[e.boost] = { cx: x, cy: y - 22, rot: 0, z: i * 3 };
      }
    });
    return g;
  }

  function sceneHtml(step, k) {
    const st = step.stages[k], dims = dimsOf(step), first = step.stages[0];
    const spec = (id) => step.cards[id];
    const vals = st.vals || {}, marks = st.marks || {}, downs = st.down || [];
    const mk = (id, extra = {}) => cardHtml(id, spec(id), { val: vals[id], mark: marks[id], down: downs.includes(id), ...extra });

    const handIds = first.hand || [];
    const hand = handIds.length
      ? `<div class="hwho">${st.who || ""}</div><div class="hand">${handIds
        .map((id) => ((st.hand || []).includes(id) ? `<div class="hs">${mk(id, { cls: "inhand" })}</div>` : `<div class="hs gone"></div>`)).join("")}</div><div class="hdown">↓</div>`
      : "";

    const fields = (st.fields || []).map((f, fi) => {
      const d = dims[fi];
      const cells = f.cells.map((n) => {
        const entries = ((f.piles || {})[n] || []).map(ent);
        const fin = (f.fin || []).includes(n);
        const g = geometry(entries, fin, d.h);
        const cards = entries.flatMap((e) => [e.id, e.boost].filter(Boolean)).map((id) => {
          const p = g[id];
          return mk(id, { rot: p.rot, style: `left:${p.cx - CW / 2}px;top:${p.cy - CH / 2}px;transform:rotate(${p.rot}deg);z-index:${p.z}` });
        });
        return `<div class="cell" style="width:${d.w[n]}px;height:${d.h}px"><span class="cn">${n}</span>${cards.join("")}</div>`;
      });
      return `<div class="field"><div class="flabel">${f.label || ""}</div><div class="frow"><div class="cell edge"></div>${cells.join("")}<div class="cell edge r"></div></div></div>`;
    });
    return hand + fields.join("");
  }

  /* ---------- steps ---------- */

  const S = (label, cells, piles = {}, fin = []) => ({ label, cells, piles, fin });
  const ROW = [4, 5, 6];
  const LIVE = {
    g4: { n: 4, c: "g" }, g6: { n: 6, c: "g" },
    y: { n: 5, c: "y", sw: 1 }, b: { n: 5, c: "b", sw: 1 }, s: { n: 5, c: "g", sp: 1 },
    r: { n: 5, c: "r", sw: 2 }, rb: { n: 2, c: "r", sw: 2 },
  };

  const steps = [
    {
      t: "The idea",
      p: "Two players share <b>two 3×3 grids placed side by side</b>, one board of 18 cells. Every cell is a pile. A pile is finished at three cards: turn the whole pile sideways and square it up. Whoever's card is on top wins it. The game ends as soon as all 18 cells hold at least one card; a single card per cell is enough.",
      static: () => row(board()),
    },
    {
      t: "Your deck",
      p: "Split the cards by colour: <b>A</b> takes blue + green, <b>B</b> takes yellow + red. Shuffle the multicoloured jokers and deal them out equally.",
      static: () => `<div class="bdecks">
        <div><div class="who a">A</div>${row(scard({ n: 3, c: "b", sw: 1 }), scard({ n: 7, c: "g" }), scard({ n: 2, c: "j", sw: 1 }))}</div>
        <div><div class="who b">B</div>${row(scard({ n: 4, c: "y", sw: 1 }), scard({ n: 8, c: "r", x: 3 }), scard({ n: 5, c: "j", x: 1 }))}</div>
      </div>`,
    },
    {
      t: "Rounds and hands",
      p: "Draw up to six cards, then take turns playing <b>four</b> of them. Playing two cards at once (booster or joker) uses <b>two</b> of your four plays. Once you have made your four plays, your opponent keeps taking consecutive turns until they have made theirs. Before the next round, each of your two leftovers goes either to the bottom of your deck or stays in your hand. Most cards end up stacked on others, so a game usually takes many rounds.",
      static: () => rowFit(
        ...[{ n: 2, c: "g" }, { n: 6, c: "b", sw: 2 }, { n: 9, c: "g", x: 1 }, { n: 4, c: "b", sw: 1 }].map((c) => scard(c, "play")),
        ...[{ n: 5, c: "b" }, { n: 1, c: "g", sw: 3 }].map((c) => scard(c, "left over"))),
    },
    {
      t: "The number is the cell",
      p: "A card goes onto the cell that matches its number. You choose the left or right grid. Cards you play always start above the grid, and the dashed outlines are the cells.",
      cards: { a: { n: 5, c: "g", sw: 1 } },
      stages: [
        { who: "A plays", hand: ["a"], fields: [S("Grid 1", ROW), S("Grid 2", ROW)], cap: "A green 5 belongs on cell 5. Grid 1 or grid 2?" },
        { hand: [], fields: [S("Grid 1", ROW), S("Grid 2", ROW, { 5: ["a"] })], cap: "A chooses grid 2." },
      ],
    },
    {
      t: "Card value",
      p: "A card's value is its <b>swirls</b>, or minus its <b>crosses</b>. A card never has both. The value decides whether it may cover an opponent's card.",
      static: () => row(
        scard({ n: 2, c: "y", sw: 3 }, "3 swirls", 3),
        scard({ n: 4, c: "r", x: 2 }, "2 crosses", -2),
        scard({ n: 8, c: "g" }, "no symbols", 0)),
    },
    {
      t: "A first card",
      p: "Live play starts here and carries on for the next two steps. Two green cards of A's are already on cells 4 and 6. An empty cell takes any card with the right number: B opens cell 5 with a yellow 5, one swirl, value 1.",
      cards: LIVE,
      stages: [
        { who: "B plays", hand: ["y"], fields: [S("Grid 1", ROW, { 4: ["g4"], 6: ["g6"] })], cap: "Cell 5 is empty." },
        { hand: [], vals: { y: 1 }, fields: [S("Grid 1", ROW, { 4: ["g4"], 5: ["y"], 6: ["g6"] })], cap: "B's yellow 5 sits on cell 5, value 1." },
      ],
    },
    {
      t: "Special cards and covering",
      p: "To cover an opponent's top card your card's value must be <b>strictly higher</b>. A special card (swirl / colour square) is worth 1 for every card of its colour on the board: counting the cards already there while in your hand, and itself too once it is placed. Tap the card that can cover B's yellow 5.",
      cards: LIVE,
      quiz: { valid: ["s"], bad: { b: "A value of 1 is not higher than 1. Try the other card." } },
      stages: [
        { who: "A plays: tap a card", hand: ["b", "s"], vals: { b: 1, s: 2, y: 1 }, fields: [S("Grid 1", ROW, { 4: ["g4"], 5: ["y"], 6: ["g6"] })], cap: "Two green cards are on the board, so the special green is worth 2 in hand." },
        { hand: ["b"], vals: { s: 3, y: 1 }, marks: { s: "✓" }, fields: [S("Grid 1", ROW, { 4: ["g4"], 5: ["y", "s"], 6: ["g6"] })], cap: "Placed on the board it counts itself as well: 3 green cards, value 3. It beats 1." },
      ],
    },
    {
      t: "Boosters",
      p: "Play two cards of the same colour at once and put the second behind the first, turned sideways so its swirls show. Their values add up, they count as <b>one card</b> in the pile, and they use two of your four plays. When a pile reaches three cards, the whole pile is turned sideways and stacked neatly. The booster stays visible and its swirls still count at the end.",
      cards: LIVE,
      stages: [
        { who: "B plays two cards", hand: ["r", "rb"], vals: { s: 3, r: 2 }, fields: [S("Grid 1", ROW, { 4: ["g4"], 5: ["y", "s"], 6: ["g6"] })], cap: "A's special is on top with 3. B's red 5 alone is worth only 2." },
        { hand: [], vals: { r: 4 }, marks: { r: "✓" }, fields: [S("Grid 1", ROW, { 4: ["g4"], 5: ["y", "s", { id: "r", boost: "rb" }], 6: ["g6"] })], cap: "A red booster with 2 swirls behind it: 2 + 2 = 4. Higher than 3." },
        { hand: [], fields: [S("Grid 1", ROW, { 4: ["g4"], 5: ["y", "s", { id: "r", boost: "rb" }], 6: ["g6"] }, [5])], cap: "Three cards: the whole pile turns sideways. B wins cell 5." },
      ],
    },
    {
      t: "Your own pile",
      p: "If you own the top card of a pile, you may add a card above or below it with no value check. Slide a card underneath and the pile has three cards: finished, and you win it.",
      cards: { y: { n: 8, c: "y", sw: 1 }, g: { n: 8, c: "g", sw: 2 }, b: { n: 8, c: "b" } },
      stages: [
        { who: "A plays", hand: ["b"], vals: { g: 2 }, fields: [S("Grid 1", [7, 8, 9], { 8: ["y", "g"] })], cap: "A already holds the top card of cell 8." },
        { hand: [], fields: [S("Grid 1", [7, 8, 9], { 8: ["b", "y", "g"] })], cap: "A slides a blue 8 underneath. Any value is fine." },
        { hand: [], fields: [S("Grid 1", [7, 8, 9], { 8: ["b", "y", "g"] }, [8])], cap: "Three cards: finished. A wins cell 8." },
      ],
    },
    {
      t: "Nothing to play? Face down",
      p: "Any card can go face down on an <b>empty</b> cell, whatever its number. A card with no legal play must go there. It sits at the bottom of that pile, counts as one of the three cards and has value 0.",
      cards: { p1: { n: 1, c: "y" }, p3: { n: 3, c: "r", x: 1 }, f: { n: 9, c: "b", x: 1 } },
      stages: [
        { who: "A plays", hand: ["f"], fields: [S("Grid 2", [1, 2, 3], { 1: ["p1"], 3: ["p3"] })], cap: "A's blue 9 has no legal play." },
        { hand: [], down: ["f"], fields: [S("Grid 2", [1, 2, 3], { 1: ["p1"], 2: ["f"], 3: ["p3"] })], cap: "It goes face down on the empty cell 2, whatever its number." },
      ],
    },
    {
      t: "Jokers: finishing a pile",
      p: "A joker is never the top card; it always sits inside the pile. Played alone (one play) on a pile of <b>two</b>, it makes three: the pile is finished and you may reorder all three cards. Put one of your own cards on top to win it, even if it is worth less. You may play a joker on any pile, even one without a card of yours.",
      cards: { g: { n: 2, c: "g" }, y: { n: 2, c: "y", sw: 2 }, j: { n: 2, c: "j", sw: 1, owner: "A" } },
      stages: [
        { who: "A plays", hand: ["j"], vals: { y: 2 }, fields: [S("Grid 1", [1, 2, 3], { 2: ["g", "y"] })], cap: "B's yellow 2 is on top of a pile of two." },
        { hand: [], fields: [S("Grid 1", [1, 2, 3], { 2: ["g", "j", "y"] })], cap: "The joker goes in the middle, never on top. Three cards." },
        { hand: [], fields: [S("Grid 1", [1, 2, 3], { 2: ["y", "j", "g"] })], cap: "A reorders: its own green 2 on top, even though it is worth less." },
        { hand: [], fields: [S("Grid 1", [1, 2, 3], { 2: ["y", "j", "g"] }, [2])], cap: "Finished. A wins cell 2." },
      ],
    },
    {
      t: "Jokers: little value",
      p: "Played on a pile of one, a joker just slides underneath. The pile then has two cards and nothing is reordered, so it is worth little.",
      cards: { y: { n: 5, c: "y", sw: 1 }, j: { n: 5, c: "j", owner: "A" } },
      stages: [
        { who: "A plays", hand: ["j"], vals: { y: 1 }, fields: [S("Grid 1", ROW, { 5: ["y"] })], cap: "A has a joker and cell 5 holds one card." },
        { hand: [], fields: [S("Grid 1", ROW, { 5: ["j", "y"] })], cap: "Under B's card it goes. Two cards now; B still on top." },
      ],
    },
    {
      t: "Jokers: with a partner",
      p: "A joker can also go down together with a card of the same number: two cards, <b>two plays</b>. On a pile of one that makes three, so the pile is finished and you reorder it, again with a card of yours on top and the joker never on top.",
      cards: { y: { n: 8, c: "y", sw: 2 }, g: { n: 8, c: "g" }, j: { n: 8, c: "j", sw: 1, owner: "A" } },
      stages: [
        { who: "A plays two cards", hand: ["g", "j"], vals: { y: 2 }, fields: [S("Grid 1", [7, 8, 9], { 8: ["y"] })], cap: "A pairs the joker with a green 8." },
        { hand: [], fields: [S("Grid 1", [7, 8, 9], { 8: ["y", "g", "j"] })], cap: "Played together: three cards. The joker can't stay on top." },
        { hand: [], fields: [S("Grid 1", [7, 8, 9], { 8: ["y", "j", "g"] })], cap: "A reorders: green 8 on top, joker inside." },
        { hand: [], fields: [S("Grid 1", [7, 8, 9], { 8: ["y", "j", "g"] }, [8])], cap: "Finished. A wins cell 8." },
      ],
    },
    {
      t: "End of the game",
      p: "As soon as every cell has at least one card, the game is over. A single card per cell is enough, nothing has to be finished. Finished piles (three cards) are sideways and score their cell number. Unfinished piles still count for swirls, crosses and colour regions on top.",
      static: () => row(board(boardOf(G1, false, []), boardOf(G2, false, []))),
    },
    {
      t: "Scoring",
      p: "Score the whole board, both grids together. Here A holds the blue and green tiles. Dashed tiles are unfinished and card backs are face-down cards, worth nothing on top. Colour regions run across the gap between the grids.",
      static: () => `${row(board(boardOf(G1, true, [2, 5, 6, 8]), boardOf(G2, true, [4])))}
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

  /* ---------- player ---------- */

  let i = 0, timers = [];

  const centres = (root) => {
    const m = {};
    root.querySelectorAll("[data-id]").forEach((el) => {
      if (!el.dataset.id) return;
      const r = el.getBoundingClientRect();
      m[el.dataset.id] = { x: r.left + r.width / 2, y: r.top + r.height / 2, rot: +el.dataset.rot };
    });
    return m;
  };

  function flip(root, before) {
    if (!before || reduced()) return;
    root.querySelectorAll("[data-id]").forEach((el) => {
      const id = el.dataset.id;
      if (!id) return;
      const r = el.getBoundingClientRect(), now = { x: r.left + r.width / 2, y: r.top + r.height / 2, rot: +el.dataset.rot }, was = before[id];
      if (!was) {
        el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 350, easing: "ease-out" });
        return;
      }
      const dx = was.x - now.x, dy = was.y - now.y;
      if (!dx && !dy && was.rot === now.rot) return;
      el.classList.add("fly");
      const a = el.animate(
        [{ transform: `translate(${dx}px,${dy}px) rotate(${was.rot}deg)` }, { transform: `translate(0px,0px) rotate(${now.rot}deg)` }],
        { duration: 700, easing: "cubic-bezier(.25,.8,.25,1)" });
      a.onfinish = a.oncancel = () => el.classList.remove("fly");
    });
  }

  function draw(k, animate) {
    const step = steps[i], scene = document.getElementById("bscene"), cap = document.getElementById("bcap");
    const before = animate ? centres(scene) : null;
    scene.innerHTML = sceneHtml(step, k);
    cap.textContent = step.stages[k].cap || "";
    cap.classList.remove("warn");
    flip(scene, before);
    if (step.quiz && k === 0) bindQuiz(step, scene);
  }

  function bindQuiz(step, scene) {
    scene.querySelectorAll(".hand .bc").forEach((el) => {
      el.classList.add("pick");
      el.onclick = () => {
        const id = el.dataset.id;
        if (step.quiz.valid.includes(id)) draw(1, true);
        else {
          const cap = document.getElementById("bcap");
          cap.textContent = step.quiz.bad[id] || "Not that one.";
          cap.classList.add("warn");
          if (!reduced()) el.animate([{ transform: "translateX(0)" }, { transform: "translateX(-7px)" }, { transform: "translateX(7px)" }, { transform: "translateX(0)" }], { duration: 320 });
        }
      };
    });
  }

  function run() {
    timers.forEach(clearTimeout);
    timers = [];
    const step = steps[i];
    if (!step.stages) return;
    draw(0, false);
    if (step.quiz) return;
    if (reduced()) return draw(step.stages.length - 1, false);
    step.stages.slice(1).forEach((_, k) => timers.push(setTimeout(() => draw(k + 1, true), 1100 + k * 1900)));
  }

  function render() {
    timers.forEach(clearTimeout);
    timers = [];
    const el = document.getElementById("view-battle"), s = steps[i];
    el.innerHTML = `
      <div class="card">
        <div class="bar">Pix your battles<small>${i + 1} / ${steps.length}</small></div>
        <h2 class="bt">${s.t}</h2>
        <div class="bscene" id="bscene">${s.static ? s.static() : ""}</div>
        ${s.stages ? `<p class="bcap" id="bcap"></p><div class="breplay"><button class="link" id="b-replay">${s.quiz ? "Show me" : "Replay"}</button></div>` : ""}
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
    if (s.stages) {
      el.querySelector("#b-replay").onclick = () => (s.quiz ? draw(1, true) : run());
      run();
    }
  }

  return { render, steps };
})();
