// js/engine/Game.js
// The composition root. Creates every system, wires them together, and owns
// the update/render loop. Keeping this file focused on *wiring* (rather than
// logic) is what makes it feasible to add new systems (water, power, services...)
// later without a rewrite: they just plug in here the same way traffic/zoning do.

import { MAP_WIDTH, MAP_HEIGHT } from '../utils/Constants.js';
import { CityMap } from '../simulation/CityMap.js';
import { TimeManager } from '../simulation/TimeManager.js';
import { EconomyManager } from '../simulation/EconomyManager.js';
import { RoadNetwork } from '../traffic/RoadNetwork.js';
import { Pathfinder } from '../traffic/Pathfinder.js';
import { TrafficManager } from '../traffic/TrafficManager.js';
import { ZoneManager } from '../zoning/ZoneManager.js';
import { Camera } from './Camera.js';
import { InputHandler } from './InputHandler.js';
import { GameLoop } from './GameLoop.js';
import { Renderer } from '../rendering/Renderer.js';
import { UIManager } from '../ui/UIManager.js';
import { SaveManager } from '../save/SaveManager.js';
import { eventBus } from '../utils/EventBus.js';

export class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // --- simulation state ---
        this.cityMap = new CityMap(MAP_WIDTH, MAP_HEIGHT, 1337);
        this.roadNetwork = new RoadNetwork(this.cityMap);
        this.pathfinder = new Pathfinder(this.roadNetwork);
        this.zoneManager = new ZoneManager(this.cityMap, this.roadNetwork);
        this.time = new TimeManager('normal');
        this.economy = new EconomyManager();
        this.trafficManager = new TrafficManager(this.roadNetwork, this.pathfinder, this.zoneManager, this.time);

        // --- engine / view ---
        this.camera = new Camera(canvas, this.cityMap.width, this.cityMap.height);
        this.renderer = new Renderer(this.ctx, canvas, this.camera);

        // --- ui + input (UI creates the ToolController that input drives) ---
        this.ui = new UIManager(this);
        this.input = new InputHandler(canvas, this.camera, this.ui.toolController);

        this.saveManager = new SaveManager();

        this._lastDay = this.time.day;
        this._autosaveTimer = 0;
        this._upgradeTimer = 0;

        this.loop = new GameLoop(this._update.bind(this), this._render.bind(this));

        this._resizeCanvasToDisplaySize();
        window.addEventListener('resize', () => this._resizeCanvasToDisplaySize());

        this._tryLoadAutosaveOnBoot();
    }

    start() {
        this.loop.start();
    }

    _resizeCanvasToDisplaySize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const displayWidth = this.canvas.clientWidth;
        const displayHeight = this.canvas.clientHeight;
        this.canvas.width = Math.round(displayWidth * dpr);
        this.canvas.height = Math.round(displayHeight * dpr);
    }

    // --- tool actions (called by ToolController) -----------------------------

    placeRoads(tiles) {
        let placedCount = 0;
        const placeable = tiles.filter(t => {
            const tile = this.cityMap.getTile(t.x, t.y);
            return tile && !tile.road && !tile.isWater && !tile.building && !tile.zoneType;
        });
        const cost = this.economy.roadCost(placeable.length);
        if (placeable.length === 0) return;
        if (!this.economy.canAfford(cost)) {
            eventBus.emit('ui:toast', `Not enough money (need §${cost})`);
            return;
        }
        for (const t of placeable) {
            if (this.roadNetwork.placeRoad(t.x, t.y)) placedCount++;
        }
        if (placedCount > 0) this.economy.spend(this.economy.roadCost(placedCount));
    }

    placeZones(tiles, zoneType) {
        const placeable = tiles.filter(t => {
            const tile = this.cityMap.getTile(t.x, t.y);
            return tile && tile.isEmptyZonable;
        });
        if (placeable.length === 0) return;
        const cost = this.economy.zoneCost(placeable.length);
        if (!this.economy.canAfford(cost)) {
            eventBus.emit('ui:toast', `Not enough money (need §${cost})`);
            return;
        }
        let count = 0;
        for (const t of placeable) {
            if (this.zoneManager.zoneTile(t.x, t.y, zoneType)) count++;
        }
        if (count > 0) this.economy.spend(this.economy.zoneCost(count));
    }

    bulldoze(tiles) {
        for (const t of tiles) {
            const tile = this.cityMap.getTile(t.x, t.y);
            if (!tile) continue;
            if (tile.road) this.roadNetwork.removeRoad(t.x, t.y);
            if (tile.zoneType || tile.building) this.zoneManager.unzoneTile(t.x, t.y);
            tile.clearNature();
        }
    }

    // --- save / load -----------------------------------------------------------

    saveGame() {
        this.saveManager.save(this);
        eventBus.emit('ui:toast', 'City saved');
    }

    loadGame() {
        const data = this.saveManager.loadRaw(false);
        if (!data) {
            eventBus.emit('ui:toast', 'No saved city found');
            return;
        }
        this._resetMutableState();
        this.saveManager.applyTo(this, data);
        eventBus.emit('ui:toast', 'City loaded');
    }

    _tryLoadAutosaveOnBoot() {
        // Prefer an explicit save; fall back to the autosave if present.
        const data = this.saveManager.loadRaw(false) || this.saveManager.loadRaw(true);
        if (data) {
            this.saveManager.applyTo(this, data);
        }
    }

    _resetMutableState() {
        // Wipe player-built content but keep the same terrain (same seed/map).
        this.cityMap.forEachTile(tile => {
            tile.road = null;
            tile.zoneType = null;
            tile.building = null;
            tile.growthTimer = 0;
        });
        this.roadNetwork.roadTiles.clear();
        this.zoneManager.buildings = [];
        this.trafficManager.cars = [];
    }

    // --- main loop --------------------------------------------------------------

    _update(dtMs) {
        this.camera.update(dtMs / 1000);
        this.time.update(dtMs);

        if (this.time.paused) return;

        const simDtMs = dtMs * this.time.simMultiplier;

        this.zoneManager.update(simDtMs);
        this._updateBuildingStats(simDtMs);
        this.trafficManager.update(simDtMs);

        if (this.time.day !== this._lastDay) {
            this._lastDay = this.time.day;
            this.economy.settleDailyBudget(this.zoneManager, this.roadNetwork);
        }

        this._autosaveTimer += dtMs;
        if (this._autosaveTimer > 30000) {
            this._autosaveTimer = 0;
            this.saveManager.autosave(this);
        }

        this.ui.update();
    }

    _updateBuildingStats(dtMs) {
        const pop = this.zoneManager.totalPopulation;
        const jobs = this.zoneManager.totalJobs;
        // Simple city-wide demand model: residential demand rises with available
        // jobs, job demand rises with available population, giving a soft
        // supply/demand loop without needing a full economic simulation.
        const residentialDemand = Math.min(1, 0.35 + jobs / Math.max(20, pop + 20));
        const jobDemand = Math.min(1, 0.35 + pop / Math.max(20, jobs + 20));
        const congestionPenalty = Math.min(0.3, this.trafficManager.carCount / 400);

        this._upgradeTimer += dtMs;
        const shouldCheckUpgrade = this._upgradeTimer > 10000;
        if (shouldCheckUpgrade) this._upgradeTimer = 0;

        for (const b of this.zoneManager.buildings) {
            const demand = b.isResidential ? residentialDemand : jobDemand;
            b.updateOccupancy(dtMs, demand);
            b.updateHappiness({ taxRateComfort: 0.1, congestionPenalty });
            if (shouldCheckUpgrade) b.tryUpgrade();
        }
    }

    _render() {
        this.renderer.render({
            cityMap: this.cityMap,
            roadNetwork: this.roadNetwork,
            zoneManager: this.zoneManager,
            trafficManager: this.trafficManager,
            hoverTile: this.ui.toolController.hoverTile,
            activeTool: this.ui.toolController.activeTool,
            dragPreviewTiles: this.ui.toolController.previewTiles
        });
    }
}
