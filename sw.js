"use strict";

const CACHE = "pixies-v1";
const NET_TIMEOUT_MS = 4000;
const ASSETS = [
  "./", "index.html", "style.css", "app.js", "battle.js", "practice.js", "sync.js", "config.js", "manifest.webmanifest",
  "bot/deck.js", "bot/engine.js", "bot/bot.js", "bot/worker.js",
  "img/cover.jpg", "img/moss.jpg", "img/logo.png", "img/pixie.jpg", "img/flower.png", "img/icon.png",
  "img/icon-180.png", "img/icon-192.png", "img/icon-512.png", "img/av0.png", "img/av1.png", "img/av2.png", "img/av3.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled(ASSETS.map((a) => c.add(a))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Network first so a new deploy shows up immediately; the cache answers when offline or the network stalls.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  const fromNet = fetch(req).then((res) => {
    if (res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
    }
    return res;
  });
  const stalled = new Promise((_, reject) => setTimeout(reject, NET_TIMEOUT_MS));
  e.respondWith(
    Promise.race([fromNet, stalled]).catch(() =>
      caches.match(req, { ignoreSearch: true }).then((hit) => hit || (req.mode === "navigate" ? caches.match("index.html") : null) || fromNet)),
  );
});
