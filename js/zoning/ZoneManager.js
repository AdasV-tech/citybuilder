// js/zoning/ZoneManager.js
// Handles painting zone tiles and growing them into Buildings over time.
// A lot only starts growing once it has a road neighbor, mirroring how
// city builders require road access for development.

import { GROWTH_TIME_MS } from '../utils/Constants.js';
import { Building } from '../simulation/Building.js';
import { eventBus } from '../utils/EventBus.js';

export class ZoneManager {
    constructor(cityMap, roadNetwork) {
        this.map = cityMap;
        this.roads = roadNetwork;
        this.buildings = []; // flat list for easy iteration by simulation/traffic
    }

    /** Paint a zone on a single tile. Returns true if it changed the tile. */
    zoneTile(x, y, zoneType) {
        const tile = this.map.getTile(x, y);
        if (!tile) return false;
        if (!tile.isEmptyZonable) return false;
        tile.clearNature();
        tile.zoneType = zoneType;
        tile.growthTimer = 0;
        return true;
    }

    /** Remove zoning (and any building) from a tile. */
    unzoneTile(x, y) {
        const tile = this.map.getTile(x, y);
        if (!tile) return false;
        let changed = false;
        if (tile.building) {
            this.buildings = this.buildings.filter(b => b !== tile.building);
            tile.building = null;
            changed = true;
        }
        if (tile.zoneType) {
            tile.zoneType = null;
            tile.growthTimer = 0;
            changed = true;
        }
        return changed;
    }

    _hasAdjacentRoad(x, y) {
        return this.roads.hasRoad(x - 1, y) || this.roads.hasRoad(x + 1, y) ||
               this.roads.hasRoad(x, y - 1) || this.roads.hasRoad(x, y + 1);
    }

    /** Advance growth timers and spawn buildings. Called every sim tick. */
    update(dtMs) {
        this.map.forEachTile((tile) => {
            if (!tile.zoneType || tile.building) return;
            if (!this._hasAdjacentRoad(tile.x, tile.y)) return; // waits for road access

            tile.growthTimer += dtMs;
            if (tile.growthTimer >= GROWTH_TIME_MS) {
                const building = new Building(tile.x, tile.y, tile.zoneType);
                tile.building = building;
                this.buildings.push(building);
                eventBus.emit('building:spawned', building);
            }
        });
    }

    get residentialBuildings() { return this.buildings.filter(b => b.isResidential); }
    get commercialBuildings() { return this.buildings.filter(b => b.isCommercial); }
    get industrialBuildings() { return this.buildings.filter(b => b.isIndustrial); }

    get totalPopulation() {
        return Math.round(this.buildings.reduce((sum, b) => sum + (b.isResidential ? b.population : 0), 0));
    }

    get totalJobs() {
        return Math.round(this.buildings.reduce((sum, b) => sum + (!b.isResidential ? b.workers : 0), 0));
    }

    serialize() {
        return this.buildings.map(b => b.toJSON());
    }

    /** Rebuild buildings list from saved data and re-link them onto tiles. */
    restore(buildingsData) {
        this.buildings = buildingsData.map(data => {
            const b = Building.fromJSON(data);
            const tile = this.map.getTile(b.x, b.y);
            if (tile) {
                tile.zoneType = b.zoneType;
                tile.building = b;
            }
            return b;
        });
    }
}
