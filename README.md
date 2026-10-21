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

**Sync (optional).** Finished games (not in-progress score cards) can be shared between devices through a GitHub gist. Games merge by id; deletions are remembered so they don't come back. Each device keeps its own full history, so a lost gist is rebuilt from any device. Games sync after saving or deleting one, on opening the app, when the tab becomes visible again, and via "Sync now".

To enable: run `python3 tools/setup_sync.py` and commit the generated `config.js`. With an empty `config.js` the Stats tab offers a manual setup instead.

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
config.js    sync settings, written by tools/setup_sync.py
tools/       setup_sync.py
img/         logo, cover, moss background, avatars, icons
```

## Credits

Pixies is designed by Johannes Goupy, with miniatures and photography by Sylvain Trabut, published by Bombyx. This is an unofficial fan tool. The logo and card images are taken from the game and belong to their respective owners.
