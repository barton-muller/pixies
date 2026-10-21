"use strict";

const $ = (s, r = document) => r.querySelector(s);
const KEYS = { cur: "pixies.current", hist: "pixies.history", pref: "pixies.prefs" };
const MULT = [2, 3, 4];

const store = {
  get(k, d) {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; }
  },
  set(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ }
  },
};

let game = store.get(KEYS.cur, null);
let history = store.get(KEYS.hist, []);
let prefs = Object.assign({ letters: ["A", "B", "C", "D"], avatars: [0, 1, 2, 3], n: 2, pixies: false }, store.get(KEYS.pref, {}));
let tab = "game";
let lastSaved = null;
let focusIdx = 0;

const AV = (i) => `img/av${i}.png`;
const avOf = (g, p) => (g.avatars && g.avatars[p] !== undefined ? g.avatars[p] : g.players.indexOf(p));
const num = (v) => Math.max(0, parseInt(v, 10) || 0);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const svg = (body, vb = "0 0 24 24") => `<svg viewBox="${vb}" aria-hidden="true">${body}</svg>`;
const ICON = {
  full: svg('<rect x="9" y="3" width="11" height="14" rx="2.5" fill="#b9c9a8"/><rect x="4" y="7" width="11" height="14" rx="2.5" fill="#fffaf0" stroke="currentColor" stroke-width="2"/>'),
  area: (m) => svg(`<g fill="currentColor"><rect x="1" y="12.5" width="7.4" height="7.4" rx="1.4"/><rect x="8.3" y="12.5" width="7.4" height="7.4" rx="1.4"/><rect x="15.6" y="12.5" width="7.4" height="7.4" rx="1.4"/><rect x="8.3" y="5.1" width="7.4" height="7.4" rx="1.4"/></g><g fill="#fff" font-size="7.6" font-weight="800" text-anchor="middle" font-family="system-ui,sans-serif"><text x="4.7" y="18.2">${m}</text><text x="12" y="18.2">${m}</text><text x="19.3" y="18.2">${m}</text><text x="12" y="10.8">${m}</text></g>`),
  swirl: svg('<path d="M12 12.4c-1.1.1-1.6-1.2-.8-1.9 1.1-.9 2.9-.1 3.2 1.4.4 2.1-1.5 3.8-3.7 3.5-2.8-.4-4.2-3.4-3.4-5.9.9-3 4.2-4.5 7.1-3.6 3.6 1.1 5 5.3 3.6 8.6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>', '3 3 18 18'),
  cross: svg('<path d="M6.5 6.500l11 11M17.5 6.500l-11 11" stroke="#c9433b" stroke-width="3.6" stroke-linecap="round"/>'),
  pix: '<img src="img/head.png" alt="">',
};

function scoreOf(d, r, withPix) {
  const c = cats(d, r, withPix);
  return c.full + c.area + c.swirl - c.cross + c.pix;
}

function cats(d, r, withPix) {
  const x = d[r];
  return {
    full: num(x.full),
    area: num(x.area) * MULT[r],
    swirl: num(x.swirl),
    cross: num(x.cross),
    pix: withPix ? num(x.pix) : 0,
  };
}

function totals(g) {
  return g.players.map((p) => [0, 1, 2].reduce((a, r) => a + scoreOf(g.scores[p], r, g.pixies), 0));
}

function blankScores() {
  return [0, 1, 2].map(() => ({ full: "", area: "", swirl: "", cross: "", pix: "" }));
}

function saveGame() { store.set(KEYS.cur, game); }

/* ---------- views ---------- */

function show() {
  document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
  $("#view-setup").hidden = !(tab === "game" && !game);
  $("#view-game").hidden = !(tab === "game" && game);
  $("#view-stats").hidden = tab !== "stats";
  if (tab === "stats") renderStats();
  else if (game) renderGame();
  else renderSetup();
}

/* ---------- setup ---------- */

function renderSetup() {
  const el = $("#view-setup");
  const n = prefs.n;
  const used = [...new Set(history.flatMap((h) => h.players.map((p) => p.name)))].sort();
  el.innerHTML = `
    <div class="card">
      <div class="bar">New game</div>
      <div class="seg">${[2, 3, 4].map((k) => `<button data-n="${k}" class="${k === n ? "on" : ""}">${k} players</button>`).join("")}</div>
      <div class="letters">
        ${Array.from({ length: n }, (_, i) => `<div class="seat"><button class="av c${prefs.avatars[i]}" data-av="${i}" aria-label="Change pixie"><img src="${AV(prefs.avatars[i])}" alt=""></button><input class="c${prefs.avatars[i]}" data-i="${i}" maxlength="1" autocapitalize="characters" autocomplete="off" spellcheck="false" value="${esc(prefs.letters[i] || "")}" placeholder="?" aria-label="Player ${i + 1}"></div>`).join("")}
      </div>
      <p class="hint">Tap a pixie to change it</p>
      <div class="chips">${used.map((u) => `<button data-chip="${esc(u)}">${esc(u)}</button>`).join("")}</div>
      <label class="switch"><span>Count pixies<small>+1 per pixie in the card photos</small></span><input type="checkbox" id="setup-pix" ${prefs.pixies ? "checked" : ""}></label>
      <div class="err" id="setup-err"></div>
      <button class="btn" id="start">Start game</button>
    </div>`;

  el.querySelectorAll(".seg button").forEach((b) => b.addEventListener("click", () => {
    readLetters();
    prefs.n = +b.dataset.n;
    store.set(KEYS.pref, prefs);
    renderSetup();
  }));
  el.querySelectorAll(".letters input").forEach((inp) => {
    inp.addEventListener("focus", () => { focusIdx = +inp.dataset.i; inp.select(); });
    inp.addEventListener("input", () => { inp.value = inp.value.trim().toUpperCase().slice(0, 1); });
  });
  el.querySelectorAll("[data-av]").forEach((b) => b.addEventListener("click", () => {
    readLetters();
    const i = +b.dataset.av;
    const next = (prefs.avatars[i] + 1) % 4;
    const other = prefs.avatars.findIndex((a, j) => j !== i && a === next);
    if (other >= 0) prefs.avatars[other] = prefs.avatars[i];
    prefs.avatars[i] = next;
    store.set(KEYS.pref, prefs);
    renderSetup();
  }));
  el.querySelectorAll("[data-chip]").forEach((b) => b.addEventListener("click", () => {
    const inputs = [...el.querySelectorAll(".letters input")];
    const target = inputs[focusIdx] || inputs[0];
    target.value = b.dataset.chip;
    const next = inputs[inputs.indexOf(target) + 1];
    if (next) next.focus();
  }));
  $("#setup-pix").addEventListener("change", (e) => { prefs.pixies = e.target.checked; store.set(KEYS.pref, prefs); });
  $("#start").addEventListener("click", startGame);
}

function readLetters() {
  document.querySelectorAll(".letters input").forEach((inp) => { prefs.letters[+inp.dataset.i] = inp.value; });
}

function startGame() {
  readLetters();
  const players = prefs.letters.slice(0, prefs.n);
  if (players.some((p) => !p)) return ($("#setup-err").textContent = "Every player needs a letter.");
  if (new Set(players).size !== players.length) return ($("#setup-err").textContent = "Letters must be unique.");
  store.set(KEYS.pref, prefs);
  game = {
    id: Date.now(),
    started: new Date().toISOString(),
    players,
    avatars: Object.fromEntries(players.map((p, i) => [p, prefs.avatars[i]])),
    pixies: prefs.pixies,
    scores: Object.fromEntries(players.map((p) => [p, blankScores()])),
  };
  saveGame();
  show();
}

/* ---------- game ---------- */

function row(label, cells, cls = "") {
  return `<div class="row ${cls}"><div class="lab">${label}</div>${cells}</div>`;
}

function renderGame() {
  const el = $("#view-game");
  const P = game.players;
  const inputs = (r, k) => P.map((p) =>
    `<input type="number" inputmode="numeric" min="0" ${k === "cross" ? 'class="neg"' : ""} data-p="${esc(p)}" data-r="${r}" data-k="${k}" value="${game.scores[p][r][k]}" placeholder="0" aria-label="${esc(p)} round ${r + 1} ${k}">`).join("");
  const outs = (id) => P.map((p) => `<div class="out" data-out="${id}:${esc(p)}">0</div>`).join("");

  const rounds = [0, 1, 2].map((r) => `
    <div class="card">
      <div class="bar">Round ${r + 1}</div>
      <div class="pad" style="--n:${P.length}">
        ${row(`<i>${ICON.full}</i>`, inputs(r, "full"))}
        ${row(`<i>${ICON.area(MULT[r])}</i>`, inputs(r, "area"))}
        ${row(`<i>${ICON.swirl}</i>`, inputs(r, "swirl"))}
        ${row(`<i>${ICON.cross}</i>`, inputs(r, "cross"))}
        ${game.pixies ? row(`<i>${ICON.pix}</i>`, inputs(r, "pix")) : ""}
        ${row("+", outs(`r${r}`), "sub")}
        ${r === 1 ? row("1 + 2", outs("c12"), "sub cum") : ""}
      </div>
    </div>`).join("");

  el.innerHTML = `
    <div class="scorebar"><div class="pad row" style="--n:${P.length}">
      <div class="lab">=</div>
      ${P.map((p, i) => `<div class="pl c${avOf(game, p)}" data-pl="${esc(p)}"><b><img src="${AV(avOf(game, p))}" alt="">${esc(p)}</b><span data-out="tot:${esc(p)}">0</span></div>`).join("")}
    </div></div>
    ${rounds}
    <label class="switch card"><span>Count pixies<small>+1 per pixie in the card photos</small></span><input type="checkbox" id="game-pix" ${game.pixies ? "checked" : ""}></label>
    <div class="actions">
      <button class="btn" id="finish">Finish game</button>
      <button class="link" id="abandon">Discard game</button>
    </div>`;

  el.querySelectorAll("input[type=number]").forEach((inp) => {
    inp.addEventListener("focus", () => inp.select());
    inp.addEventListener("input", () => {
      game.scores[inp.dataset.p][+inp.dataset.r][inp.dataset.k] = inp.value === "" ? "" : num(inp.value);
      saveGame();
      recalc();
    });
  });
  $("#game-pix").addEventListener("change", (e) => { game.pixies = e.target.checked; saveGame(); renderGame(); });
  $("#finish").addEventListener("click", finishDialog);
  $("#abandon").addEventListener("click", () => {
    if (confirm("Discard this game without saving?")) { game = null; store.set(KEYS.cur, null); show(); }
  });
  recalc();
}

function recalc() {
  const set = (id, v) => { const e = document.querySelector(`[data-out="${CSS.escape(id)}"]`); if (e) e.textContent = v; };
  const P = game.players;
  const tot = totals(game);
  const max = Math.max(...tot);
  P.forEach((p, i) => {
    const rs = [0, 1, 2].map((r) => scoreOf(game.scores[p], r, game.pixies));
    rs.forEach((v, r) => set(`r${r}:${p}`, v));
    set(`c12:${p}`, rs[0] + rs[1]);
    set(`tot:${p}`, tot[i]);
    document.querySelector(`[data-pl="${CSS.escape(p)}"]`).classList.toggle("lead", max > 0 && tot[i] === max);
  });
}

/* ---------- finish ---------- */

function summarize(g) {
  const tot = totals(g);
  const max = Math.max(...tot);
  return {
    id: g.id,
    date: g.started,
    pixies: g.pixies,
    players: g.players.map((name, i) => ({
      name,
      av: avOf(g, name),
      total: tot[i],
      rounds: [0, 1, 2].map((r) => scoreOf(g.scores[name], r, g.pixies)),
    })),
    winners: g.players.filter((_, i) => tot[i] === max),
  };
}

function finishDialog() {
  const s = summarize(game);
  const sorted = [...s.players].sort((a, b) => b.total - a.total);
  const dlg = $("#dlg");
  dlg.innerHTML = `
    <div class="dlg-hero">${s.winners.length > 1 ? "Tie: " : "Winner: "}${s.winners.map(esc).join(" & ")}</div>
    <div class="dlg-body">
      <div class="game-scores">${sorted.map((p) => `<span class="${s.winners.includes(p.name) ? "w" : ""}">${esc(p.name)} ${p.total}</span>`).join("")}</div>
      <div class="dlg-actions">
        <button class="btn" id="save">Save game</button>
        <button class="btn ghost" id="back">Back</button>
      </div>
    </div>`;
  dlg.showModal();
  $("#back").onclick = () => dlg.close();
  $("#save").onclick = () => {
    history.push(s);
    store.set(KEYS.hist, history);
    lastSaved = s.id;
    game = null;
    store.set(KEYS.cur, null);
    dlg.close();
    tab = "stats";
    show();
    window.scrollTo(0, 0);
  };
}

/* ---------- stats ---------- */

function renderStats() {
  const el = $("#view-stats");
  if (!history.length) {
    el.innerHTML = `<div class="card empty"><img src="img/pixie.jpg" alt=""><p>No games saved yet.<br>Finished games show up here.</p></div>`;
    return;
  }
  const by = {};
  history.forEach((h) => h.players.forEach((p) => {
    const s = (by[p.name] ||= { g: 0, w: 0, sum: 0, best: -Infinity });
    s.g++;
    s.sum += p.total;
    s.best = Math.max(s.best, p.total);
    if (h.winners.includes(p.name)) s.w++;
  }));
  const rows = Object.entries(by).sort((a, b) => b[1].w / b[1].g - a[1].w / a[1].g || b[1].g - a[1].g);
  const topScore = Math.max(...history.flatMap((h) => h.players.map((p) => p.total)));
  const avg = Math.round(history.flatMap((h) => h.players.map((p) => p.total)).reduce((a, b) => a + b, 0) / history.reduce((a, h) => a + h.players.length, 0));

  const lastAv = {};
  history.forEach((h) => h.players.forEach((p) => { if (p.av !== undefined) lastAv[p.name] = p.av; }));
  const face = (n, c = "") => (lastAv[n] !== undefined ? `<img class="face ${c}" src="${AV(lastAv[n])}" alt="">` : "");
  const tag = (n) => `<span class="tag">${face(n)}${esc(n)}</span>`;
  const fmt = (iso) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

  el.innerHTML = `
    <div class="card">
      <div class="bar">Overview</div>
      <div class="kpis">
        <div><b>${history.length}</b><span>games</span></div>
        <div><b>${avg}</b><span>avg score</span></div>
        <div><b>${topScore}</b><span>high score</span></div>
      </div>
    </div>
    <div class="card">
      <div class="bar">Players</div>
      <table>
        <tr><th>Player</th><th>Games</th><th>Wins</th><th>Win %</th><th>Avg</th><th>Best</th></tr>
        ${rows.map(([n, s]) => `<tr><td>${tag(n)}</td><td>${s.g}</td><td>${s.w}</td><td>${Math.round((100 * s.w) / s.g)}%</td><td>${Math.round(s.sum / s.g)}</td><td>${s.best}</td></tr>`).join("")}
      </table>
    </div>
    <div class="card">
      <div class="bar">History</div>
      ${[...history].reverse().map((h) => `
        <div class="game-row ${h.id === lastSaved ? "new" : ""}">
          <div class="game-main">
            <div class="game-date">${fmt(h.date)}${h.pixies ? ` · <span class="mini">${ICON.pix}</span>` : ""}</div>
            <div class="game-scores">${[...h.players].sort((a, b) => b.total - a.total).map((p) => `<span class="${h.winners.includes(p.name) ? "w" : ""}">${h.winners.includes(p.name) ? "★ " : ""}${p.av !== undefined ? `<img class="face" src="${AV(p.av)}" alt="">` : ""}${esc(p.name)} ${p.total}</span>`).join("")}</div>
          </div>
          <button class="del" data-del="${h.id}" aria-label="Delete game">×</button>
        </div>`).join("")}
    </div>`;

  el.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => {
    if (!confirm("Delete this game from history?")) return;
    history = history.filter((h) => h.id !== +b.dataset.del);
    store.set(KEYS.hist, history);
    renderStats();
  }));
  lastSaved = null;
}

document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => {
  if (tab === "game" && !game) readLetters();
  tab = b.dataset.tab;
  show();
}));

show();
