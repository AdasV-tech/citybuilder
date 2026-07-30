# CityBuilder

An original browser city-building game in the spirit of *Cities: Skylines* —
zone land, run power and water to it, police it, tax it, and watch the traffic
back up. Vanilla HTML, CSS and ES modules: no backend, no build step, no
frameworks. **For personal educational use.**

![status](https://img.shields.io/badge/status-v3-f5c542)

## Play it

Plain ES modules, so any static server works (`file://` blocks module imports):

```bash
python3 -m http.server 8000     # or: npx serve .  /  npx http-server -p 8000
```

Then open **http://localhost:8000**.

## The interface

The bottom bar is **logos only** — each one opens a flyout with the tools in
that category, so the map is never buried under chrome:

| Logo | Opens | Key |
|---|---|---|
| 🛣️ | Streets and avenues | `1` |
| 🏘️ | Residential / commercial / industrial zoning, de-zone | `2` |
| ⚡ | Power lines, coal plant, wind turbine, solar farm | `3` |
| 💧 | Pipes, pumping station, water tower, sewage, treatment | `4` |
| 🚑 | Police, fire, clinic, school, university | `5` |
| 🌳 | Parks, plaza, stadium | `6` |
| 💣 | Bulldozer | `7` |
| 📊 | Data views (land value, pollution, coverage, traffic…) | `T` |
| 💰 | Budget and tax rates | `B` |
| 📈 | City info and milestones | `I` |
| ☰ | Save, load, export, import, new city | `M` |

The top bar carries the treasury and monthly balance, population and jobs,
average happiness, power/water supply meters, the RCI demand bars, the date and
the speed controls. Click anything on the map to open its info card.

### Controls

| Action | Input |
|---|---|
| Use the active tool | Left-click / left-drag |
| Select a building or tile | Left-click with no tool armed |
| Pan | Right-drag, middle-drag, `Space`+drag, or `WASD` / arrows |
| Zoom | Wheel (zooms to the cursor), or `+` / `-` |
| Pause | `Space` · **Cancel tool** `Esc` or right-click |

On touch: one finger uses the tool, two fingers pan and pinch-zoom.

## How to play

1. **Draw roads** out from the starter crossroads.
2. **Zone** land beside them — residential, commercial, industrial.
3. **Power and plumb it.** Nothing grows without both. Utilities travel under
   roads, so a connected road network distributes them; pipes and power lines
   are only needed to bridge gaps (across a river, or out to a remote plant).
4. **Watch the RCI bars** — they say which zone type the city actually wants.
5. **Add services.** Police, fire, clinics and schools raise happiness; parks
   raise land value, and land value is what lets buildings level up (5 levels).
6. **Balance the budget.** Taxes settle monthly against road, utility and
   service upkeep. Above ~10% tax citizens start to grumble.
7. **Hit milestones.** Population thresholds pay cash grants and unlock the
   bigger buildings — avenues at 500, clinics and schools at 600, university at
   4,000, stadium at 6,000.

Things that will go wrong, and where to look:

| Symptom | Data view | Usual fix |
|---|---|---|
| ⚡ badges on buildings | Power Grid | More generation, or a line to that district |
| 💧 badges | Water Grid | Another pump/tower; check the network is connected |
| Buildings won't level up | Land Value | Parks, services, less pollution and traffic |
| Abandoned ruins 🏚️ | Happiness | Fix the cause, then bulldoze |
| Gridlock | Traffic | Upgrade to avenues, or add parallel routes |

## Simulation model

- **Utility grids** — flood fill from each generator across conducting tiles
  (roads, pipes/wires, buildings). Supply is handed out consumer by consumer,
  so a shortage browns out *part* of the city rather than nothing.
- **Fields** — land value, ground pollution, traffic and five service-coverage
  maps are `Float32Array`s over the grid, rebuilt on a timer and sampled by
  every other system, so "why is this block bad?" always has one answer.
- **Buildings** — each lot scores its own happiness from utilities, coverage,
  pollution, congestion, taxes and land value; that drives occupancy, levelling
  up and, if it stays miserable, abandonment.
- **Demand (RCI)** — homes are wanted when there are spare jobs, industry when
  there are spare workers, commerce when there are customers and goods. Demand
  decides whether *new* lots get built; happiness decides how full they get.
- **Traffic** — commuters run home↔work during two rush windows and freight
  runs industry→commerce all day. Cars per tile become congestion, which feeds
  back into pathfinding cost, land value and happiness.

## Project structure

```text
├── index.html            Shell only — every widget is built by JS
├── css/style.css         HUD, rail, flyouts, panels, cards
│
├── js/
│   ├── main.js             Boot + on-screen error reporting
│   │
│   ├── data/               Content tables, no logic
│   │   ├── ServiceCatalog.js  Every placeable service and its rules
│   │   └── Toolbox.js         Rail categories, data views, city menu
│   │
│   ├── engine/
│   │   ├── Game.js            Composition root, update/render loop, player actions
│   │   ├── Camera.js          Smoothed pan/zoom; CSS-pixel space only
│   │   ├── InputHandler.js    Mouse/touch/keyboard -> camera + tool events
│   │   └── GameLoop.js        rAF driver with clamped dt and FPS average
│   │
│   ├── simulation/
│   │   ├── CityMap.js         Noise terrain: coast, river, forest, rock
│   │   ├── Tile.js            One grid cell
│   │   ├── Building.js        Happiness -> occupancy -> levelling -> abandonment
│   │   ├── ServiceBuilding.js Placed catalog instance
│   │   ├── ServiceManager.js  Placement rules, footprints, upkeep
│   │   ├── UtilityGrid.js     Power/water networks and supply allocation
│   │   ├── FieldManager.js    Coverage, pollution, traffic, land value maps
│   │   ├── DemandManager.js   The RCI model
│   │   ├── EconomyManager.js  Money, tax policy, monthly ledger
│   │   ├── TimeManager.js     Days/months/years, speeds, day-night factor
│   │   ├── MilestoneManager.js Population tiers, grants, unlocks
│   │   └── Advisor.js         Watches for problems, notifies once each
│   │
│   ├── zoning/ZoneManager.js  Zoning, growth queue, per-building stepping
│   │
│   ├── traffic/               RoadNetwork, Pathfinder (A* + heap), Car, TrafficManager
│   │
│   ├── rendering/
│   │   ├── Renderer.js        Draw order, chunk cache, LOD, night tint
│   │   ├── MapRenderer.js     Terrain, zone paint, pipes/wires
│   │   ├── RoadRenderer.js    Connection-mask roads, kerbs, lane markings
│   │   ├── BuildingSprites.js Pre-rendered 2x sprites for every building
│   │   ├── BuildingRenderer.js Sprite blitting, construction sites, badges
│   │   ├── CarRenderer.js     Vehicles with night headlights
│   │   └── OverlayRenderer.js Data views, previews, selection
│   │
│   ├── ui/                    UIManager, ToolPalette (the rail), HUD, Panels,
│   │                          SelectionCard, Notifications, ToolController
│   ├── save/SaveManager.js    Local Storage v2 + JSON export/import
│   ├── audio/AudioManager.js  Synthesised UI blips (no asset files)
│   └── utils/                 Constants, EventBus, MathUtils (noise, ramps…)
│
└── test/                      Node --test suite + headless city helper
```

## Performance

Two ideas carry most of the load:

- **Chunked ground cache.** Terrain, zone paint, pipes and roads are baked into
  16×16-tile canvases and blitted; a chunk is only repainted when a tile inside
  it changes. Above zoom ~1.3 the cache is bypassed and tiles are drawn
  directly, since few are visible up close and it stays pixel sharp.
- **Sprite-cached buildings.** Every building is drawn once into an offscreen
  canvas at 2× resolution, then blitted — one `drawImage` per building.

Also: growth only ever touches a set of pending lots (never a full-grid scan),
the simulation runs on a fixed 200 ms step decoupled from the frame rate,
pathfinding is A* with a binary heap over typed arrays plus a version-keyed
cache, coverage fields rebuild on a timer, and the HUD writes to the DOM only
when a value actually changed.

A ~1,000-building city measures ~0.3 ms/frame of simulation and ~1 ms/frame of
draw calls in the headless benchmark.

## Testing

```bash
npm test
```

Node's built-in runner, no dependencies. The suite covers terrain determinism,
road connectivity and upgrades, avenue-preferring pathfinding, utility networks
and brownouts, service placement rules, land value and pollution, the monthly
budget, milestones, traffic spawning, and a full save/load round trip.

## Extending it

- **A new building** is one entry in `data/ServiceCatalog.js` — the palette,
  placement rules, upkeep, coverage and rendering all read from it.
- **A new tool** is an entry in `data/Toolbox.js` plus a case in
  `ToolController._isValid` / `_commit` and the matching `Game` action.
- **A new simulation system** owns its state, exposes `update()` or
  `rebuild()`, and is wired into `Game._buildWorld()` and `_simulationStep()`.
- **A new data view** is an entry in `INFO_VIEWS` and a ramp in `OVERLAY_RAMPS`.
- **Saves are versioned** (`v2`); restore methods default missing fields, so
  new state can be added without breaking old cities.

## License

See [LICENSE](LICENSE).
