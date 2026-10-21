"use strict";

const PixiesSync = (() => {
  const API = "https://api.github.com";
  const FILE = "pixies.json";
  const DESC = "Pixies score pad data";

  function merge(a, b) {
    const deleted = [...new Set([...(a.deleted || []), ...(b.deleted || [])])];
    const gone = new Set(deleted);
    const byId = new Map();
    for (const g of [...(b.games || []), ...(a.games || [])]) if (!gone.has(g.id)) byId.set(g.id, g);
    return { games: [...byId.values()].sort((x, y) => x.id - y.id), deleted: deleted.sort((x, y) => x - y) };
  }

  const key = (d) => JSON.stringify([d.games.map((g) => g.id), d.deleted]);

  async function gh(path, token, opts = {}) {
    let res;
    try {
      res = await fetch(API + path, {
        ...opts,
        cache: "no-store",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          ...(opts.body ? { "Content-Type": "application/json" } : {}),
        },
      });
    } catch {
      throw new Error("Offline");
    }
    if (res.status === 401) throw new Error("Token rejected");
    if (res.status === 403 || res.status === 429) throw new Error("GitHub rate limit or missing gist scope");
    if (res.status === 404) throw new Error("Gist not found");
    if (!res.ok) throw new Error(`GitHub error ${res.status}`);
    return res.json();
  }

  async function findGist(token) {
    for (let page = 1; page <= 5; page++) {
      const list = await gh(`/gists?per_page=100&page=${page}`, token);
      const hits = list.filter((g) => g.description === DESC && g.files && g.files[FILE]);
      if (hits.length) return hits.sort((x, y) => x.created_at.localeCompare(y.created_at))[0].id;
      if (list.length < 100) break;
    }
    return null;
  }

  async function readGist(id, token) {
    const g = await gh(`/gists/${id}`, token);
    const f = g.files && g.files[FILE];
    if (!f) return { games: [], deleted: [] };
    const text = f.truncated ? await (await fetch(f.raw_url, { cache: "no-store" })).text() : f.content;
    try {
      const d = JSON.parse(text);
      return { games: d.games || [], deleted: d.deleted || [] };
    } catch {
      return { games: [], deleted: [] };
    }
  }

  const body = (d) => JSON.stringify({ v: 1, games: d.games, deleted: d.deleted });

  async function sync(cfg, local) {
    const { token } = cfg;
    let id = cfg.gistId || (await findGist(token));
    if (!id) {
      const g = await gh("/gists", token, {
        method: "POST",
        body: JSON.stringify({ description: DESC, public: false, files: { [FILE]: { content: body(local) } } }),
      });
      return { gistId: g.id, data: local };
    }
    const remote = await readGist(id, token);
    const merged = merge(local, remote);
    if (key(merged) !== key(remote)) {
      await gh(`/gists/${id}`, token, { method: "PATCH", body: JSON.stringify({ files: { [FILE]: { content: body(merged) } } }) });
    }
    return { gistId: id, data: merged };
  }

  return { merge, sync };
})();

if (typeof module !== "undefined") module.exports = PixiesSync;
