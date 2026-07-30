// js/engine/Game.js
// Composition root: builds every system, owns the update/render loop and
// exposes the handful of "the player did a thing" actions the tools call.
// Deliberately thin on logic — each system owns its own rules — so new systems
// (transit, districts, policies…) can be added by wiring them in here.

import {
    MAP_SIZE, FIELD_REBUILD_MS, UTILITY_REBUILD_MS, AUTOSAVE_MS,
    COST_PER_TILE, ZOOM_MAX
} from '../utils/Constants.js';
import { CityMap } from '../simulation/CityMap.js';
import { TimeManager } from '../simulation/TimeManager.js';
import { EconomyManager } from '../simulation/EconomyManager.js';
import { ServiceManager } from '../simulation/ServiceManager.js';
import { UtilityGrid } from '../simulation/UtilityGrid.js';
import { FieldManager } from '../simulation/FieldManager.js';
import { DemandManager } from '../simulation/DemandManager.js';
import { MilestoneManager } from '../simulation/MilestoneManager.js';
import { Advisor } from '../simulation/Advisor.js';
import { ZoneManager } from '../zoning/ZoneManager.js';
import { RoadNetwork } from '../traffic/RoadNetwork.js';
import { Pathfinder } from '../traffic/Pathfinder.js';
import { TrafficManager } from '../traffic/TrafficManager.js';
import { Camera } from './Camera.js';
import { InputHandler } from './InputHandler.js';
import { GameLoop } from './GameLoop.js';
import { Renderer } from '../rendering/Renderer.js';
import { UIManager } from '../ui/UIManager.js';
import { SaveManager } from '../save/SaveManager.js';
import { getService } from '../data/ServiceCatalog.js';
import { eventBus } from '../utils/EventBus.js';

const SIM_STEP_MS = 200;      // fixed simulation step for buildings/growth
const MAX_STEPS_PER_FRAME = 6;

export class Game {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: false });
        this.cityName = options.cityName ?? 'Riverside';

        this._buildWorld(options.seed ?? (Date.now() % 1000000));

        this.camera = new Camera(this.cityMap.width, this.cityMap.height);
        this.renderer = new Renderer(this.ctx, canvas, this.camera, this.cityMap);
        this.saveManager = new SaveManager();

        this.ui = new UIManager(this);
        this.input = new InputHandler(canvas, this.camera, this.ui.tools, {
            onHotkey: (key, event) => this.ui.handleHotkey(key, event),
            onCancel: () => this.ui.cancelCurrent(),
            onTogglePause: () => this.setSpeed(this.time.togglePause() ? 0 : this.time.lastRunningSpeed)
        });

        this._simAccumulator = 0;
        this._fieldTimer = FIELD_REBUILD_MS;
        this._utilityTimer = UTILITY_REBUILD_MS;
        this._autosaveTimer = 0;

        this.loop = new GameLoop(this._update.bind(this), this._render.bind(this));

        this._resize();
        window.addEventListener('resize', () => this._resize());
        this._bindEvents();

        this.camera.centerOnTile(this.cityMap.start.x, this.cityMap.start.y, 1.1);

        const restored = this._loadOnBoot();
        if (!restored) {
            this._seedStartingCity();
            this._welcome();
        }
        this._refreshAll();
    }

    start() { this.loop.start(); }

    // --- construction ---------------------------------------------------------

    _buildWorld(seed) {
        this.cityMap = new CityMap(MAP_SIZE, MAP_SIZE, seed);
        this.roads = new RoadNetwork(this.cityMap);
        this.pathfinder = new Pathfinder(this.roads);
        this.zones = new ZoneManager(this.cityMap, this.roads);
        this.services = new ServiceManager(this.cityMap);
        this.utilities = new UtilityGrid(this.cityMap, this.services, this.zones);
        this.fields = new FieldManager(this.cityMap, this.services, this.zones, this.roads);
        this.demand = new DemandManager();
        this.economy = new EconomyManager();
        this.time = new TimeManager(1);
        this.milestones = new MilestoneManager();
        this.advisor = new Advisor();
        this.traffic = new TrafficManager(this.roads, this.pathfinder, this.zones, this.time);
    }

    get stats() { return this.zones.stats; }

    _bindEvents() {
        eventBus.on('time:newMonth', () => {
            this.economy.settleMonth({
                buildings: this.zones.buildings,
                roadNetwork: this.roads,
                serviceManager: this.services,
                educationLevel: this.fields.averages.education
            });
        });
        eventBus.on('building:spawned', (building) => this.renderer.invalidateTile(building.x, building.y));
        eventBus.on('building:abandoned', (building) => this.renderer.invalidateTile(building.x, building.y));
    }

    /**
     * First-run guidance. Without power and water nothing will ever grow, and
     * with an empty city the advisor has no problem to report yet — so the
     * opening moves are spelled out once.
     */
    _welcome() {
        eventBus.emit('ui:notify', {
            id: 'welcome', icon: '🏙️', kind: 'info',
            title: `Welcome to ${this.cityName}`,
            body: 'Zone land beside a road (🏘️), then give it electricity (⚡) and water (💧). Buildings only grow where all three meet.'
        });
    }

    /** A short starter road so a brand new city has somewhere to zone against. */
    _seedStartingCity() {
        const { x, y } = this.cityMap.start;
        for (let i = -8; i <= 8; i++) {
            this.roads.placeRoad(x + i, y, 'street');
            this.roads.placeRoad(x, y + i, 'street');
        }
        this.renderer.invalidateAll();
    }

    _resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const cssWidth = this.canvas.clientWidth || window.innerWidth;
        const cssHeight = this.canvas.clientHeight || window.innerHeight;
        this.canvas.width = Math.round(cssWidth * dpr);
        this.canvas.height = Math.round(cssHeight * dpr);
        this.camera.resize(cssWidth, cssHeight, dpr);
    }

    // --- player actions ---------------------------------------------------------

    placeRoads(tiles, type = 'street') {
        let cost = 0;
        for (const t of tiles) {
            const tile = this.cityMap.getTile(t.x, t.y);
            cost += COST_PER_TILE[type] * (tile?.road ? 0.6 : 1);
        }
        if (!this.economy.spend(Math.round(cost), 'road')) return;

        for (const t of tiles) {
            if (this.roads.placeRoad(t.x, t.y, type)) this.renderer.invalidateArea(t.x - 1, t.y - 1, 3, 3);
        }
        this.pathfinder.clearCache();
        this._markUtilitiesDirty();
        this.ui.audio.playBuild();
    }

    placeZones(tiles, zone) {
        const cost = tiles.length * COST_PER_TILE.zone;
        if (!this.economy.spend(cost, 'zone')) return;
        for (const t of tiles) {
            if (this.zones.zoneTile(t.x, t.y, zone)) this.renderer.invalidateTile(t.x, t.y);
        }
        this.ui.audio.playZone();
    }

    dezone(tiles) {
        for (const t of tiles) {
            if (this.zones.unzoneTile(t.x, t.y)) this.renderer.invalidateTile(t.x, t.y);
        }
        this.zones.refreshStats();
        this._markUtilitiesDirty();
    }

    placeUtilities(tiles, kind) {
        const cost = tiles.length * COST_PER_TILE[kind];
        if (!this.economy.spend(cost, kind)) return;
        for (const t of tiles) {
            const tile = this.cityMap.getTile(t.x, t.y);
            if (!tile) continue;
            tile.clearTrees();
            if (kind === 'pipe') tile.pipe = true; else tile.wire = true;
            this.renderer.invalidateTile(t.x, t.y);
        }
        this._markUtilitiesDirty();
        this.ui.audio.playBuild();
    }

    placeService(defId, x, y) {
        const def = getService(defId);
        if (!def) return;
        if (!this.milestones.isUnlocked(def.unlockPop)) {
            eventBus.emit('ui:toast', { text: `${def.name} is not unlocked yet`, kind: 'warn' });
            return;
        }
        if (!this.economy.canAfford(def.cost)) {
            eventBus.emit('ui:toast', { text: 'Not enough money', kind: 'bad' });
            return;
        }
        const structure = this.services.place(defId, x, y, this.time.totalDays);
        if (!structure) {
            eventBus.emit('ui:toast', { text: 'Cannot build here', kind: 'bad' });
            return;
        }
        this.economy.spend(def.cost, 'service');
        this.renderer.invalidateArea(x - 1, y - 1, def.size + 2, def.size + 2);
        this._markUtilitiesDirty();
        this.ui.audio.playBuild();
        eventBus.emit('ui:toast', { text: `${def.name} built`, kind: 'good' });
    }

    bulldoze(tiles) {
        let refund = 0;
        let cost = 0;

        for (const t of tiles) {
            const tile = this.cityMap.getTile(t.x, t.y);
            if (!tile || !tile.hasAnything) continue;

            if (tile.structure) {
                const structure = tile.structure;
                refund += this.services.remove(structure);
                this.renderer.invalidateArea(structure.x - 1, structure.y - 1, structure.size + 2, structure.size + 2);
                continue;
            }
            cost += COST_PER_TILE.bulldoze;
            if (tile.road) this.roads.removeRoad(t.x, t.y);
            if (tile.zone || tile.building) this.zones.unzoneTile(t.x, t.y);
            tile.pipe = false;
            tile.wire = false;
            tile.clearTrees();
            this.renderer.invalidateArea(t.x - 1, t.y - 1, 3, 3);
        }

        if (cost > 0) this.economy.spend(Math.round(cost), 'bulldoze');
        if (refund > 0) this.economy.earn(refund, 'demolition refund');
        this.zones.refreshStats();
        this.pathfinder.clearCache();
        this._markUtilitiesDirty();
        this.ui.audio.playBulldoze();
    }

    setSpeed(speed) {
        this.time.setSpeed(speed);
    }

    _markUtilitiesDirty() {
        this._utilityTimer = UTILITY_REBUILD_MS;
        this._fieldTimer = Math.max(this._fieldTimer, FIELD_REBUILD_MS * 0.6);
    }

    // --- simulation ---------------------------------------------------------------

    _update(dtMs) {
        this.camera.update(dtMs / 1000);
        this.input.update(dtMs / 1000);

        const simDt = this.time.update(dtMs);

        if (simDt > 0) {
            this._utilityTimer += simDt;
            if (this._utilityTimer >= UTILITY_REBUILD_MS) {
                this._utilityTimer = 0;
                this.utilities.rebuild();
            }

            this._fieldTimer += simDt;
            if (this._fieldTimer >= FIELD_REBUILD_MS) {
                this._fieldTimer = 0;
                this.fields.rebuild();
            }

            this.traffic.update(simDt);

            this._simAccumulator += simDt;
            let steps = 0;
            while (this._simAccumulator >= SIM_STEP_MS && steps < MAX_STEPS_PER_FRAME) {
                this._simAccumulator -= SIM_STEP_MS;
                steps++;
                this._simulationStep(SIM_STEP_MS);
            }
            if (steps === MAX_STEPS_PER_FRAME) this._simAccumulator = 0;
        }

        this._autosaveTimer += dtMs;
        if (this._autosaveTimer >= AUTOSAVE_MS) {
            this._autosaveTimer = 0;
            this.saveManager.autosave(this);
        }

        this.ui.update(dtMs);
    }

    _simulationStep(stepMs) {
        this.zones.update(stepMs, {
            demand: this.demand,
            fields: this.fields,
            taxes: this.economy.taxes
        });

        const stats = this.zones.stats;
        const shares = this.zones.zoneShares;
        this.demand.update(stepMs, {
            population: stats.population,
            jobs: stats.jobs,
            commercialJobs: stats.commercialJobs,
            industrialJobs: stats.industrialJobs,
            happiness: this.zones.averageHappiness,
            commercialShare: shares.commercial,
            industrialShare: shares.industrial,
            taxes: this.economy.taxes
        });

        this.milestones.update(stats.population, this.economy);
        this.advisor.update(stepMs, this);
    }

    _render() {
        this.renderer.render({
            cityMap: this.cityMap,
            fields: this.fields,
            trafficManager: this.traffic,
            dataView: this.ui.dataView,
            preview: this.ui.tools.preview,
            hover: this.ui.tools.hover,
            selection: this.ui.tools.selection,
            night: this.time.nightFactor > 0.35,
            nightFactor: this.time.nightFactor
        });
    }

    /** Restore the most recent save on boot; returns false for a fresh city. */
    _loadOnBoot() {
        const data = this.saveManager.loadRaw(false) || this.saveManager.loadRaw(true);
        if (!data) return false;
        this.applySave(data);
        return true;
    }

    // --- save / load ------------------------------------------------------------------

    _refreshAll() {
        this.utilities.rebuild();
        this.fields.rebuild();
        this.renderer.invalidateAll();
        this.ui.refresh();
    }

    saveGame() {
        this.saveManager.save(this);
        eventBus.emit('ui:toast', { text: 'City saved', kind: 'good' });
    }

    loadGame() {
        const data = this.saveManager.loadRaw(false) || this.saveManager.loadRaw(true);
        if (!data) {
            eventBus.emit('ui:toast', { text: 'No saved city found', kind: 'warn' });
            return false;
        }
        this.applySave(data);
        eventBus.emit('ui:toast', { text: 'City loaded', kind: 'good' });
        return true;
    }

    applySave(data) {
        if (data.seed !== undefined && data.seed !== this.cityMap.seed) {
            this._buildWorld(data.seed);
            this.renderer.setMap(this.cityMap);
        }
        this.resetCity({ silent: true, keepSeed: true });
        this.saveManager.applyTo(this, data);
        this.traffic.reset();
        this.pathfinder.clearCache();
        this.advisor.reset();
        this._refreshAll();
    }

    /** Wipe everything the player built, keeping the same terrain. */
    resetCity({ silent = false, keepSeed = true } = {}) {
        if (!keepSeed) this._buildWorld(Date.now() % 1000000);

        this.zones.clear();
        this.services.clear();
        for (const tile of this.cityMap.tiles) {
            if (tile.road) this.roads.removeRoad(tile.x, tile.y);
            tile.pipe = false;
            tile.wire = false;
            tile.powered = false;
            tile.watered = false;
        }
        this.roads.roadTiles.clear();
        this.traffic.reset();
        this.pathfinder.clearCache();
        this.economy = new EconomyManager();
        this.demand = new DemandManager();
        this.milestones = new MilestoneManager();
        this.time = new TimeManager(1);
        this.advisor.reset();
        this.utilities = new UtilityGrid(this.cityMap, this.services, this.zones);
        this.traffic.time = this.time;

        if (!silent) {
            this._seedStartingCity();
            this._refreshAll();
            eventBus.emit('ui:toast', { text: 'New city started', kind: 'good' });
        }
    }

    newCity() {
        this._buildWorld(Date.now() % 1000000);
        this.renderer.setMap(this.cityMap);
        this.camera.centerOnTile(this.cityMap.start.x, this.cityMap.start.y, 1.1);
        this._seedStartingCity();
        this._refreshAll();
        eventBus.emit('ui:toast', { text: 'New city generated', kind: 'good' });
    }

    zoomBy(factor) {
        this.camera.setZoom(Math.min(ZOOM_MAX, this.camera.targetZoom * factor));
    }
}
