# CityBuilder

A tiny, original, browser-based city-building game inspired by the general
gameplay feel of games like *Cities: Skylines* — built from scratch with
vanilla HTML, CSS, and ES6 JavaScript. No backend, no build step, no
frameworks. **For personal educational use.**

This is the **first playable version**: a solid core engine (camera, map,
roads, zoning, growth, traffic, economy, time, save/load) plus a first pass
at city services (water/power coverage, industrial worker shortages and
abandonment), designed so deeper systems (police, garbage, hospitals,
schools, …) can be added later without rewriting what's already here.

![status](https://img.shields.io/badge/status-first%20playable%20version-e8c94a)

## Play it

No build tools required — it's plain ES modules, which browsers load
directly. You only need a local static server because `file://` pages block
ES module imports for security reasons.

```bash
# from the CityBuilder/ folder, pick any one of these:
python3 -m http.server 8000
# or
npx serve .
# or
npx http-server -p 8000
```

Then open **http://localhost:8000** in a modern desktop browser (Chrome,
Firefox, Edge, Safari all work).

## Controls

| Action | Input |
|---|---|
| Use the active tool | Left-click / left-drag on the map |
| Pan the camera | Right-click drag, or hold `Space` + drag |
| Zoom | Mouse wheel |
| Select a tool | Toolbar buttons at the top |
| Change simulation speed | Slow / Normal / Fast buttons |
| Pause | ⏸ button in the toolbar |
| Save / Load | 💾 / 📂 buttons (also autosaves every 30s) |

On touch devices, one-finger drag pans the map and a tap uses the active tool.

## How to play

You start with a small cross-shaped highway already laid down the middle of
the map so there's somewhere to build from immediately.

1. Pick the **Road** tool and drag out roads connected to the starter highway.
2. Pick **Residential**, **Commercial**, or **Industrial** and drag a
   rectangle of zoning next to a road.
3. Wait — zoned lots next to a road slowly grow into buildings.
4. Residents commute to jobs by car in the morning and back home in the
   evening; watch traffic flow along your road network.
5. Buildings pay daily taxes (settled once per in-game day) which fund your
   budget; roads cost a small daily upkeep.
6. Buildings that stay busy and happy can upgrade once to a bigger version.
7. Use **Bulldoze** to remove roads, zones, buildings, or trees you don't want.

### Water & power

A couple of water pumps and three power plants are placed automatically at
map generation, with coverage radiating out along any road they touch (see
the in-game legend, top-right, for the icons and line colors). Buildings
outside water/power coverage grow more slowly and are less happy — look for
the small red dot on a building's roof as the "needs service" indicator.

### Worker shortages & abandonment

If your industrial zones can't find enough workers (population isn't keeping
up with jobs), you'll get a toast warning. A factory that stays understaffed
for too long is abandoned — the lot clears and sits vacant for a while before
it's eligible to regrow, so keep residential and industrial growth roughly
balanced.

There's no failure state in this first version — it's meant to be a calm
sandbox foundation, not a challenge run.

## Project structure

```text
CityBuilder/
│
├── index.html          Page shell: canvas, toolbar, info bar, infra legend
├── README.md
├── LICENSE
├── package.json         `npm test` runs the Node test suite
│
├── .devcontainer/
│   └── devcontainer.json  Claude Code dev container config
│
├── css/
│   └── style.css        All UI chrome styling (canvas is drawn by JS)
│
├── js/
│   ├── main.js           Boots the Game once the DOM is ready
│   │
│   ├── engine/            Core engine: camera, input, game loop, composition root
│   │   ├── Game.js         Wires every system together; the composition root
│   │   ├── Camera.js       Pan / zoom / world<->screen<->tile conversions
│   │   ├── InputHandler.js Mouse/touch/keyboard -> camera + tool events
│   │   └── GameLoop.js     requestAnimationFrame wrapper with clamped dt
│   │
│   ├── simulation/         World state that isn't roads/zoning specifically
│   │   ├── CityMap.js       Tile grid + terrain generation (grass/trees/water)
│   │   ├── Tile.js          Single grid cell data model
│   │   ├── Building.js      Population/workers/happiness/tax/upgrade/abandonment
│   │   ├── InfrastructureManager.js Water pump/power plant coverage over roads
│   │   ├── TimeManager.js   Day counter, time-of-day fraction, speed control
│   │   └── EconomyManager.js Money, placement costs, daily tax/upkeep
│   │
│   ├── zoning/
│   │   └── ZoneManager.js   Paint zones, grow lots into Buildings over time
│   │
│   ├── traffic/
│   │   ├── RoadNetwork.js   Road placement + connection bitmasks + adjacency graph
│   │   ├── Pathfinder.js    A* pathfinding across the road graph
│   │   ├── Car.js            Single car agent following a path
│   │   └── TrafficManager.js Commute spawning, following-distance movement, service alerts
│   │
│   ├── rendering/          Canvas drawing, one concern per file
│   │   ├── Renderer.js       Draw-order orchestration + tile highlight/preview
│   │   ├── MapRenderer.js    Terrain (grass/water/trees)
│   │   ├── RoadRenderer.js   Asphalt + connection-aware lane markings
│   │   ├── BuildingRenderer.js Zone tint/growth bar + building shapes + service badge
│   │   └── CarRenderer.js    Simple oriented car rectangles
│   │
│   ├── ui/                 DOM glue (no game logic)
│   │   ├── UIManager.js      Coordinates toolbar/info bar/toasts
│   │   ├── ToolController.js Drag interpretation -> road/zone/bulldoze actions
│   │   ├── Toolbar.js        Tool/speed/save button wiring
│   │   └── InfoBar.js        Bottom status readout
│   │
│   ├── save/
│   │   └── SaveManager.js   Serialize/restore to Local Storage, autosave
│   │
│   └── utils/               Stateless helpers shared everywhere
│       ├── Constants.js      All tunable numbers in one place
│       ├── EventBus.js       Tiny pub/sub used for cross-system notifications
│       └── MathUtils.js      clamp/lerp/pathing helpers, seeded RNG
│
├── test/
│   └── traffic-services.test.js  Node `--test` coverage for shortage alerts
│
├── assets/                 Reserved for future sprites/audio (currently empty)
└── saves/                  Reserved for future exportable save files
```

## Design notes for extending this later

Water and power coverage, and industrial worker-shortage/abandonment, are now
in. Police, garbage, hospitals, schools, and any richer land-value/happiness
model are still deliberately **out of scope** for this version. The
architecture leaves room for them:

- **New simulation systems** (e.g. `PoliceManager`, `GarbageManager`) can
  follow the exact shape of `InfrastructureManager`/`ZoneManager`: own their
  state, expose an `update(dtMs)` or `rebuildNetworks()`-style method, and get
  wired into `Game._update()` / `Game.placeRoads()` the way infrastructure is.
- **New tools** (e.g. a dedicated power-line tool, if freeform placement is
  wanted instead of automatic road-following coverage) plug into
  `ToolController` the same way `road`/`zone-*`/`bulldoze` do — add a case in
  `_isTileValidForTool` and `_commit`, and a toolbar button with a matching
  `data-tool`.
- **New renderers** are just another `draw*()` function called from
  `Renderer.render()` in the right draw-order slot, the way
  `Renderer._drawInfrastructure()` was added alongside the existing ones.
- **More building requirements** (e.g. "needs garbage collection to stay
  happy") are a small addition to `Building.updateHappiness()` /
  `updateServiceState()`, following the pattern `serviceCoverage` already uses.
- **Save format** is versioned (`version: 1` in `SaveManager`) so future
  systems can add fields without breaking old saves — just default missing
  fields when restoring, the way `economy.restore()` and `time.restore()`
  already do. Infrastructure itself doesn't need saving: pump/plant positions
  are deterministic from the map seed, and coverage is recomputed with
  `infrastructure.rebuildNetworks()` after any load.

## Testing

A small Node test suite covers the service-alert logic:

```bash
npm test
```

It uses Node's built-in test runner (`node --test`), so no extra dependencies
are required.

## Performance

- Rendering culls to only the tiles currently on screen (`Renderer.getVisibleTileBounds`).
- Traffic caps concurrent cars (`MAX_CARS` in `Constants.js`) and reuses a
  simple per-tile occupancy check for following distance instead of full
  physics collision.
- Buildings/zones are stored as flat arrays and plain tile references rather
  than deeply nested structures, keeping per-frame iteration cheap even with
  hundreds of buildings.

## Improvements in this workspace

This branch includes several quality-of-life and performance improvements
implemented to make the game smoother and more polished:

- **Static layer caching:** the renderer now caches the map + road layer to an
  offscreen canvas and blits it each frame, greatly reducing draw work
  when the viewport doesn't change ([`js/rendering/Renderer.js`](js/rendering/Renderer.js)).
- **HiDPI canvas transforms:** the game now sets an appropriate devicePixelRatio
  transform so the canvas renders crisply on Retina/HiDPI displays
  ([`js/engine/Game.js`](js/engine/Game.js)).
- **Pathfinder caching:** repeated A* lookups are cached and invalidated
  when the road network changes, improving traffic path reuse
  ([`js/traffic/Pathfinder.js`](js/traffic/Pathfinder.js)).
- **Save export/import:** toolbar buttons to export a JSON save and import
  one from disk were added to make sharing/debugging saves easier
  ([`index.html`](index.html), [`js/ui/Toolbar.js`](js/ui/Toolbar.js)).
- **Small UI sounds:** a lightweight WebAudio-based `AudioManager` plays
  subtle sounds for save/load and clicks ([`js/audio/AudioManager.js`](js/audio/AudioManager.js)).
- **CI workflow:** added a GitHub Actions workflow to run `npm test` on push
  and PRs to keep test coverage enforced (see `.github/workflows/nodejs.yml`).

## License

MIT — see [LICENSE](./LICENSE). This is an original codebase created for
personal educational use; it is not affiliated with or derived from any
commercial game.
