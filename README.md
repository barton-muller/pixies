# Pixies Score Pad

Score counter for the board game Pixies (2–4 players), modelled on the score sheet in the box. Static site: no build, no server, no dependencies. Everything is stored in the browser's `localStorage`.

## Features

- 2–4 players, one letter each, plus a pixie avatar per player (tap to cycle; duplicates allowed). The avatar sets the player's colour.
- Score sheet layout, one card per round:
  - full cells (sum of the numbers on full cells)
  - colour area (number of cells in the largest region, auto-multiplied ×2 / ×3 / ×4 for rounds 1–3)
  - swirls (+1 each)
  - crosses (−1 each)
  - pixies (+1 each, optional, toggle at setup or mid-game)
- Round subtotals, cumulative `1 + 2` row, and a sticky total bar that marks the leader.
- The game in progress survives reloads.
- Finish a game to save it. Winner (ties credit everyone) and scores go to history.
- Stats tab: games, average and high score, and per-player games / wins / win % / average / best. History entries can be deleted.

Pixie bonus points are included in saved totals when the toggle was on, so averages mix games played with and without it. History marks pixie games with the flower icon.

## Data and sync

Everything lives in `localStorage` (`pixies.*` keys), per browser. Clearing site data erases it unless sync is on.

**Sync (optional).** Finished games (not in-progress score cards) can be shared between devices through a private GitHub gist:

1. Stats tab → Sync devices → create a *classic* personal access token with only the `gist` scope (the link there pre-fills it).
2. Paste the token and Connect. The first device creates a secret gist named "Pixies score pad data"; other devices find it automatically from the same token.

Games sync after saving or deleting one, on opening the app, when the tab becomes visible again, and via "Sync now". Games merge by id; deletions are kept as tombstones so they don't come back. The token is stored in the browser's `localStorage` and only ever sent to `api.github.com`. Fine-grained tokens cannot access gists, hence classic. Last-write-wins applies only to the narrow window of two devices syncing at the same instant; the next sync repairs it.

## Run locally

Open `index.html`, or serve the folder:

```sh
python3 -m http.server
```

## Deploy

GitHub Pages deploys from `main` via `.github/workflows/static.yml`. In the repo settings, Pages → Source must be set to "GitHub Actions".

## Layout

```
index.html   page shell
style.css    styling
app.js       state, scoring, views, stats
sync.js      gist sync and merge logic
img/         logo, cover, moss background, avatars, icons
```

## Credits

Pixies is designed by Johannes Goupy, with miniatures and photography by Sylvain Trabut, published by Bombyx. This is an unofficial fan tool. The logo and card images are taken from the game and belong to their respective owners.
