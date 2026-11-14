"use strict";

const PRACTICE = (() => {
  const E = PIXIES;
  const YOU = 0, BOT = 1, KEY = "pixies.practice", THINK_MS = 700, HINT_SPEC = "mc:120";
  const LEVELS = [
    { id: "easy", name: "Easy", spec: "greedy:0.35", note: "Takes the best-scoring card, but blunders a third of the time." },
    { id: "medium", name: "Medium", spec: "greedy", note: "Always takes the best-scoring card and snatches cards you would want." },
    { id: "hard", name: "Hard", spec: "mc:20", note: "Simulates 20 possible futures for every move." },
    { id: "expert", name: "Expert", spec: "mc:120", note: "Simulates 120 possible futures for every move." },
  ];
  const NAMES = { b: "blue", g: "green", y: "yellow", r: "red", m: "multi-colour" };
  const SW = '<svg viewBox="3 3 18 18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 12.4c-1.1.1-1.6-1.2-.8-1.9 1.1-.9 2.9-.1 3.2 1.4.4 2.1-1.5 3.8-3.7 3.5-2.8-.4-4.2-3.4-3.4-5.9.9-3 4.2-4.5 7.1-3.6 3.6 1.1 5 5.3 3.6 8.6"/></svg>';
  const XX = '<svg viewBox="4 4 16 16" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>';
  const UNDO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>';
  const rep = (s, n) => (n > 0 ? s.repeat(n) : "");
  const signed = (v) => (v < 0 ? `−${-v}` : `+${v}`);
  const who = (p) => (p === YOU ? "You" : "Bot");
  const plural = (n, w, pl = w + "s") => `${n} ${n === 1 ? w : pl}`;

  const saved = (() => {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
  })();
  let level = LEVELS.some((l) => l.id === saved.level) ? saved.level : "medium";
  const rec = saved.rec || {};
  let s = saved.game ? saved.game.s : null;
  let summary = saved.game ? saved.game.summary : null;
  let log = saved.game ? saved.game.log : "";
  let sel = null, choosing = false, warn = "", hint = null, hintBusy = false, hist = [];
  let busy = false, token = 0, ver = 0, worker, workerOff = false;

  const persist = () => {
    try { localStorage.setItem(KEY, JSON.stringify({ level, rec, game: s ? { s, summary, log } : null })); } catch { /* storage unavailable */ }
  };

  /* ---------- bot ---------- */

  const spec = () => LEVELS.find((l) => l.id === level).spec;
  const hideDraw = (x) => ({ ...x, draw: [] });

  function ask(state, botSpec) {
    const seed = (Math.random() * 2 ** 31) | 0;
    const local = () => new Promise((res) => setTimeout(() => res(PIXBOT.make(botSpec).choose(hideDraw(state), E.rng(seed))), 20));
    if (workerOff || !window.Worker) return local();
    try {
      worker ||= new Worker("bot/worker.js");
    } catch {
      workerOff = true;
      return local();
    }
    return new Promise((res) => {
      const id = Math.random();
      const done = (ev) => {
        if (ev.data.id !== id) return;
        worker.removeEventListener("message", done);
        worker.removeEventListener("error", fail);
        res(ev.data.move);
      };
      const fail = () => {
        worker.removeEventListener("message", done);
        worker.removeEventListener("error", fail);
        workerOff = true;
        worker = null;
        local().then(res);
      };
      worker.addEventListener("message", done);
      worker.addEventListener("error", fail);
      worker.postMessage({ id, state: hideDraw(state), spec: botSpec, seed });
    });
  }

  function maybeBot() {
    if (!s || s.over || summary || s.turn !== BOT || busy) return;
    busy = true;
    const mine = token, t0 = performance.now();
    render();
    ask(s, spec()).then((m) => new Promise((res) => setTimeout(() => res(m), Math.max(0, THINK_MS - (performance.now() - t0)))))
      .then((m) => {
        if (mine !== token) return;
        busy = false;
        apply(m);
      });
  }

  function askHint() {
    if (!s || s.turn !== YOU || busy || hintBusy || summary) return;
    hintBusy = true;
    const mine = ver;
    render();
    ask(s, HINT_SPEC).then((m) => {
      if (mine !== ver) return;
      hintBusy = false;
      hint = m;
      render();
    });
  }

  /* ---------- moves ---------- */

  const desc = (c) => {
    const sym = c.sp ? ", special" : c.sw ? `, ${plural(c.sw, "spiral")}` : c.x ? `, ${plural(c.x, "cross", "crosses")}` : "";
    return `${NAMES[c.c]} ${c.n}${sym}`;
  };

  function describe(c, m) {
    const p = s.turn, n = c.n, dn = s.down[p][n - 1];
    if (m.kind === 1) return `${who(p)} placed ${desc(c)} on space ${n}${dn ? ", validating it" : ""}.`;
    if (m.kind === 2) return `${who(p)} added ${desc(c)} to space ${n}: ${m.opt === 0 ? "new card on top" : "new card underneath"}.`;
    return m.opt >= 0 ? `${who(p)} put ${desc(c)} face-down on space ${m.opt + 1}.` : `${who(p)} discarded ${desc(c)}.`;
  }

  function hintText(c, m) {
    const gain = E.scoreAfter(s, YOU, c, m) - E.score(s, YOU).total, n = c.n;
    const where = m.kind === 1 ? `place it on space ${n}` : m.kind === 2 ? `put it ${m.opt === 0 ? "on top of" : "underneath"} the card on space ${n}` : m.opt >= 0 ? `put it face-down on space ${m.opt + 1}` : "discard it";
    return `Hint: take ${desc(c)} and ${where} (${signed(gain)} now).`;
  }

  function apply(m) {
    const c = s.reveal.find((x) => x.id === m.id);
    if (s.turn === YOU) hist.push(JSON.stringify({ s, summary, log, rec }));
    const flight = lift(m.id);
    log = describe(c, m);
    const rounds = s.roundScores.length;
    E.step(s, m);
    ver++;
    sel = null;
    choosing = false;
    hint = null;
    hintBusy = false;
    warn = "";
    if (s.roundScores.length > rounds) {
      summary = s.lastBoard;
      if (s.over) {
        const r = (rec[level] ||= [0, 0, 0]), i = s.totals[0] > s.totals[1] ? 0 : s.totals[0] < s.totals[1] ? 1 : 2;
        r[i]++;
      }
    }
    persist();
    render();
    land(flight, m.id);
    maybeBot();
  }

  function undo() {
    if (!hist.length) return;
    const o = JSON.parse(hist.pop());
    token++;
    ver++;
    busy = false;
    s = o.s;
    summary = o.summary;
    log = o.log;
    Object.keys(rec).forEach((k) => delete rec[k]);
    Object.assign(rec, o.rec);
    sel = null;
    choosing = false;
    hint = null;
    hintBusy = false;
    warn = "";
    persist();
    render();
  }

  function tapCell(i) {
    if (!s || summary || busy || s.turn !== YOU || sel === null) return;
    const c = s.reveal.find((x) => x.id === sel), pl = E.placements(s, YOU, c), n = c.n;
    if (pl[0].kind === 3) {
      if (pl[0].opt >= 0 && !s.up[YOU][i] && !s.down[YOU][i]) return apply({ id: c.id, kind: 3, opt: i });
      warn = pl[0].opt < 0 ? "No empty space is left." : i === n - 1 ? `Space ${n} is already validated. Tap an empty space.` : "That space is taken. Tap an empty space.";
    } else if (i !== n - 1) warn = `This card goes on space ${n}.`;
    else if (pl[0].kind === 1) return apply({ id: c.id, ...pl[0] });
    else choosing = true;
    render();
  }

  /* ---------- rendering ---------- */

  const reduced = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const flying = new Set();

  function lift(id) {
    const el = document.querySelector(`.prev .pc[data-id="${id}"]`);
    if (!el || reduced()) return null;
    const r = el.getBoundingClientRect(), ghost = el.cloneNode(true);
    ghost.classList.add("ghost");
    Object.assign(ghost.style, { position: "fixed", left: `${r.left}px`, top: `${r.top}px`, margin: "0", transformOrigin: "0 0" });
    ghost.style.setProperty("--cw", `${r.width}px`);
    ghost.style.setProperty("--ch", `${r.height}px`);
    document.body.appendChild(ghost);
    return { ghost, r };
  }

  const board = (id) => document.querySelector(`.parea [data-id="${id}"]`);

  function land(l, id) {
    if (!l) return;
    const target = board(id);
    if (!target) return l.ghost.remove();
    flying.add(id);
    target.style.visibility = "hidden";
    const t = target.getBoundingClientRect();
    const a = l.ghost.animate(
      [{ transform: "none" }, { transform: `translate(${t.left - l.r.left}px, ${t.top - l.r.top}px) scale(${t.width / l.r.width})` }],
      { duration: 420, easing: "cubic-bezier(.25,.8,.25,1)", fill: "forwards" });
    a.onfinish = a.oncancel = () => {
      flying.delete(id);
      const now = board(id);
      if (now) now.style.visibility = "";
      l.ghost.remove();
    };
  }

  function card(c, o = {}) {
    if (o.down) return `<div class="pc down ${o.cls || ""}" data-id="${c.id}"></div>`;
    const two = (n) => (n >= 4 ? " two" : "");
    const sp = c.sp ? `<span class="psp">${SW}<i>/</i><u class="c-${c.sp}"></u></span>` : "";
    const dots = c.c === "m" ? '<span class="pcol"><s class="c-b"></s><s class="c-g"></s><s class="c-y"></s><s class="c-r"></s></span>' : "";
    return `<div class="pc c-${c.c}${c.sp ? " sp" : ""} ${o.cls || ""}" data-id="${c.id}">
      <div class="psw${two(c.sw)}">${rep(SW, c.sw)}</div><b>${c.n}</b><div class="pxx${two(c.x)}">${rep(XX, c.x)}</div>${sp}${dots}</div>`;
  }

  function area(up, down, cls, o = {}) {
    let cells = "";
    for (let i = 0; i < 9; i++) {
      const free = !up[i] && !down[i];
      const hi = o.hintCell === i ? " hc" : o.target === i ? " target" : o.pick && free ? " pick" : "";
      cells += `<div class="pcell${up[i] && down[i] ? " v" : ""}${hi}" data-cell="${i}"><span class="pn">${i + 1}</span>${down[i] ? card(down[i], { down: true, cls: "peek" }) : ""}${up[i] ? card(up[i], { cls: "up" }) : ""}</div>`;
    }
    return `<div class="parea ${cls}">${cells}</div>`;
  }

  const breakdown = (b) => `valid ${b.val} · symbols ${signed(b.sym)} · zone ${b.zone}×${s ? s.mult : b.mult}`;

  function areaCard(p, cls, o) {
    const b = E.score(s, p);
    return `<div class="phead"><span class="pwho ${p === YOU ? "me" : "bot"}">${who(p)}</span><span class="pbd">${breakdown(b)}</span><b>${b.total}</b></div>${area(s.up[p], s.down[p], cls, o)}`;
  }

  function setupHtml() {
    const l = LEVELS.find((x) => x.id === level), r = rec[level] || [0, 0, 0];
    return `<div class="card">
      <div class="bar">Practice vs bot</div>
      <div class="seg">${LEVELS.map((x) => `<button data-level="${x.id}" class="${x.id === level ? "on" : ""}">${x.name}</button>`).join("")}</div>
      <p class="hint">${l.note}</p>
      <p class="hint">Your record on ${l.name}: ${r[0]} won · ${r[1]} lost · ${r[2]} tied</p>
      <button class="btn" id="p-start">Start game</button>
    </div>
    <div class="card">
      <div class="bar">How it works</div>
      <p class="btext">Each turn, 4 cards are revealed and you take turns picking one, you first or second, twice each. Tap a card, then tap a space. A card belongs on the space with its number. If that space already holds a face-up card, you choose which of the two stays on top and the other goes face-down underneath. Once a space is validated, further cards of that number go face-down on any empty space. A round ends when someone has filled all 9 spaces. Three rounds, with the colour zone worth ×2, ×3, ×4.</p>
    </div>`;
  }

  function stackBtn(top, opt, text, hinted) {
    return `<button class="pch${hinted ? " hint" : ""}" data-place='${JSON.stringify({ kind: 2, opt })}'><span class="pprev"><span class="pcell v">${card(top, { down: true, cls: "peek" })}${card(top, { cls: "up" })}</span></span><span>${text}</span></button>`;
  }

  function turnPanel() {
    const mine = s.turn === YOU && !busy;
    const hinted = hint && s.reveal.find((x) => x.id === hint.id);
    const cards = s.reveal.map((c) => `<button class="prev${sel === c.id ? " sel" : ""}${hinted && hinted.k === c.k ? " hint" : ""}" data-pick="${c.id}" ${mine ? "" : "disabled"}>${card(c)}</button>`).join("");
    let body = `<div class="preveal">${cards}${rep('<div class="pghost"></div>', 4 - s.reveal.length)}</div>`;
    let head = busy ? "Bot is thinking…" : mine ? `Your pick · card ${s.pickIdx + 1} of 4${s.round === 1 ? ". Tap a card, then a space." : ""}` : "";
    if (mine && sel !== null) {
      const c = s.reveal.find((x) => x.id === sel), pl = E.placements(s, YOU, c), n = c.n;
      const hm = hinted && hinted.k === c.k ? hint : null;
      if (pl[0].kind === 1) head = `Tap space ${n}${s.down[YOU][n - 1] ? " (validates it)" : ""}.`;
      else if (pl[0].kind === 2) {
        head = choosing ? "Which card stays on top?" : `Space ${n} has a card. Tap it.`;
        if (choosing) body = `<div class="pchoice">${stackBtn(c, 0, "New card on top", hm && hm.opt === 0)}${stackBtn(s.up[YOU][n - 1], 1, "New card underneath", hm && hm.opt === 1)}</div>`;
      } else if (pl[0].opt < 0) {
        head = `Space ${n} is validated and the board is full.`;
        body = `<div class="pchoice"><button class="pch" data-place='${JSON.stringify(pl[0])}'>Discard this card</button></div>`;
      } else head = `Space ${n} is validated. Tap an empty space.`;
    }
    if (hinted && !choosing) head = hintText(hinted, hint);
    if (warn) head = warn;
    const side = `<div class="pside"><button class="pico" id="p-hint" aria-label="Hint" title="Hint" ${mine && !hintBusy ? "" : "disabled"}>${hintBusy ? "…" : "?"}</button><button class="pico" id="p-undo" aria-label="Undo" title="Undo" ${hist.length ? "" : "disabled"}>${UNDO}</button></div>`;
    return { head: `<div class="phint${warn ? " warn" : hinted && !choosing ? " tip" : ""}">${head}</div>`, panel: `<div class="pturn">${body}${side}</div>` };
  }

  function gameHtml() {
    const c = sel !== null && s.turn === YOU ? s.reveal.find((x) => x.id === sel) : null;
    const pl = c ? E.placements(s, YOU, c) : null;
    const hinted = hint && s.reveal.find((x) => x.id === hint.id);
    const o = pl ? (pl[0].kind === 3 ? { pick: pl[0].opt >= 0 } : { target: c.n - 1 }) : {};
    if (pl && hinted && hinted.k === c.k && hint.kind === 3 && hint.opt >= 0) o.hintCell = hint.opt;
    const tot = (p) => s.totals[p] + E.score(s, p).total;
    const t = turnPanel(), ob = E.score(s, BOT);
    return `<div class="card pgame">
      <div class="bar"><span>Round ${s.round}/3 · ×${s.mult}</span><small>You ${tot(YOU)} · Bot ${tot(BOT)}</small><button class="pquit" id="p-quit" aria-label="Quit game">✕</button></div>
      ${t.head}
      <div class="ptop">
        <div class="popp"><div class="phead"><span class="pwho bot">Bot</span><b>${ob.total}</b></div>${area(s.up[BOT], s.down[BOT], "opp")}</div>
        ${t.panel}
      </div>
      ${areaCard(YOU, "me", o)}
      <p class="plog">${log || "&nbsp;"}</p>
    </div>`;
  }

  function summaryHtml() {
    const b = summary, row = (name, f) => `<tr><td>${name}</td><td>${f(b.bd[0])}</td><td>${f(b.bd[1])}</td></tr>`;
    const [t0, t1] = s.totals, over = s.over;
    const verdict = t0 === t1 ? "Tie" : t0 > t1 ? "You win" : "Bot wins";
    return `<div class="card">
      <div class="bar">Round ${b.round} scored${over ? "<small>final</small>" : ""}</div>
      <div class="phead"><span class="pwho bot">Bot</span></div>${area(b.up[BOT], b.down[BOT], "sum")}
      <div class="phead"><span class="pwho me">You</span></div>${area(b.up[YOU], b.down[YOU], "sum")}
      <table class="bscore">
        <tr><th></th><th>You</th><th>Bot</th></tr>
        ${row("Validated cards", (x) => x.val)}
        ${row("Spirals and crosses", (x) => signed(x.sym))}
        ${row(`Colour zone ×${b.mult}`, (x) => `${x.zone} → ${x.zone * b.mult}`)}
        ${row("Round", (x) => `<b>${x.total}</b>`)}
        <tr class="tot"><td>${over ? "Final" : "Total so far"}</td><td>${t0}</td><td>${t1}</td></tr>
      </table>
      ${over ? `<p class="bt pv">${verdict}</p>` : ""}
      <div class="actions">
        <button class="btn" id="p-next">${over ? "Play again" : `Start round ${b.round + 1}`}</button>
        <button class="btn ghost small" id="p-undo" ${hist.length ? "" : "disabled"}>↶ Undo last move</button>
        ${over ? '<button class="link dark" id="p-done">Back to start</button>' : ""}
      </div>
    </div>`;
  }

  function render() {
    const el = document.getElementById("view-practice");
    el.innerHTML = !s ? setupHtml() : summary ? summaryHtml() : gameHtml();
    document.body.classList.toggle("pplay", !!s && !el.hidden);
    flying.forEach((id) => { const t = board(id); if (t) t.style.visibility = "hidden"; });
    warn = "";
    const on = (q, fn) => el.querySelectorAll(q).forEach((b) => b.addEventListener("click", () => fn(b)));
    on("[data-level]", (b) => { level = b.dataset.level; persist(); render(); });
    on("#p-start", start);
    on("[data-pick]", (b) => {
      sel = sel === +b.dataset.pick ? null : +b.dataset.pick;
      choosing = false;
      render();
    });
    on(".parea.me .pcell", (b) => tapCell(+b.dataset.cell));
    on("[data-place]", (b) => { if (s.turn === YOU && !busy && sel !== null) apply({ id: sel, ...JSON.parse(b.dataset.place) }); });
    on("#p-hint", askHint);
    on("#p-undo", undo);
    on("#p-quit", () => { if (confirm("Quit this practice game?")) reset(); });
    on("#p-done", reset);
    on("#p-next", () => {
      if (s.over) return start();
      summary = null;
      persist();
      render();
      maybeBot();
    });
  }

  function clearUi() {
    token++;
    ver++;
    busy = false;
    sel = null;
    choosing = false;
    hint = null;
    hintBusy = false;
    warn = "";
    hist = [];
    summary = null;
  }

  function start() {
    clearUi();
    s = E.newGame((Math.random() * 2 ** 31) | 0);
    log = "";
    persist();
    render();
    window.scrollTo(0, 0);
    maybeBot();
  }

  function reset() {
    clearUi();
    s = null;
    persist();
    render();
  }

  return {
    render() {
      render();
      if (s && !summary && s.turn === BOT) maybeBot();
    },
  };
})();
