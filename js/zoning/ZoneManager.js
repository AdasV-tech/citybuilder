// js/zoning/ZoneManager.js
// Zoning, lot growth and the per-building simulation step.
//
// Growth used to scan all ~9,000 tiles every frame; instead we keep a set of
// "pending lots" (zoned, empty) and only ever touch those, so an empty map
// costs nothing and a fully built city costs nothing either.

import { GROWTH_TIME_MS, ZONE_LIST } from '../utils/Constants.js';
import { Building, resetBuildingIds } from '../simulation/Building.js';
import { eventBus } from '../utils/EventBus.js';
import { clamp01 } from '../utils/MathUtils.js';

export class ZoneManager {
    constructor(cityMap, roadNetwork) {
        this.map = cityMap;
        this.roads = roadNetwork;
        this.buildings = [];
        this.pendingLots = new Set();  // Tile refs waiting to grow

        this.stats = {
            population: 0, jobs: 0, commercialJobs: 0, industrialJobs: 0,
            residentialCapacity: 0, jobCapacity: 0, happiness: 0.6,
            abandoned: 0, unpowered: 0, unwatered: 0
        };
    }

    // --- painting ---------------------------------------------------------------

    zoneTile(x, y, zone) {
        const tile = this.map.getTile(x, y);
        if (!tile || !tile.isZonable) return false;
        if (tile.zone === zone) return false;
        tile.clearTrees();
        tile.zone = zone;
        tile.growth = 0;
        this.pendingLots.add(tile);
        return true;
    }

    /** Remove zoning and any building on the tile. */
    unzoneTile(x, y) {
        const tile = this.map.getTile(x, y);
        if (!tile) return false;
        let changed = false;
        if (tile.building) {
            this._removeBuilding(tile.building);
            changed = true;
        }
        if (tile.zone) {
            tile.zone = null;
            tile.growth = 0;
            changed = true;
        }
        this.pendingLots.delete(tile);
        return changed;
    }

    /**
     * Recount population/jobs. Called once after a batch edit (bulldozing,
     * de-zoning) so the HUD doesn't keep showing residents who no longer have
     * a house until the next simulation step.
     */
    refreshStats() { this._recomputeStats(); }

    _removeBuilding(building) {
        const index = this.buildings.indexOf(building);
        if (index !== -1) this.buildings.splice(index, 1);
        const tile = this.map.getTile(building.x, building.y);
        if (tile && tile.building === building) tile.building = null;
    }

    clear() {
        for (const building of this.buildings) {
            const tile = this.map.getTile(building.x, building.y);
            if (tile) { tile.building = null; tile.zone = null; tile.growth = 0; }
        }
        this.buildings = [];
        this.pendingLots.clear();
        resetBuildingIds(1);
    }

    // --- simulation -----------------------------------------------------------------

    /**
     * @param {number} dtMs simulated ms
     * @param {object} ctx  { demand, fields, taxes, utilityRatios }
     */
    update(dtMs, ctx) {
        this._growLots(dtMs, ctx);
        this._updateBuildings(dtMs, ctx);
        this._recomputeStats();
    }

    _growLots(dtMs, ctx) {
        if (this.pendingLots.size === 0) return;
        const grown = [];

        for (const tile of this.pendingLots) {
            if (!tile.zone || tile.building) { grown.push(tile); continue; }
            if (!this.roads.hasAdjacentRoad(tile.x, tile.y)) { tile.growth = 0; continue; }

            const demand = ctx.demand.get(tile.zone);
            if (demand < 0.08) continue;                       // nobody wants to build here

            const serviced = (tile.powered ? 0.5 : 0) + (tile.watered ? 0.5 : 0);
            if (serviced === 0) continue;                      // no utilities, no construction

            tile.growth += dtMs * (0.35 + demand) * serviced;
            if (tile.growth >= GROWTH_TIME_MS) {
                const building = new Building(tile.x, tile.y, tile.zone, tile.variant);
                // Inherit the lot's service state so a new building isn't
                // unhappy for the split second before the next grid rebuild.
                building.powered = tile.powered;
                building.watered = tile.watered;
                tile.building = building;
                tile.growth = 0;
                this.buildings.push(building);
                grown.push(tile);
                eventBus.emit('building:spawned', building);
            }
        }
        for (const tile of grown) this.pendingLots.delete(tile);
    }

    _updateBuildings(dtMs, ctx) {
        const fields = ctx.fields;
        const width = this.map.width;
        const doomed = [];

        for (const building of this.buildings) {
            const i = building.y * width + building.x;
            const result = building.update(dtMs, {
                demand: ctx.demand.get(building.zone),
                landValue: fields.landValue[i],
                pollution: fields.pollution[i],
                congestion: this._localCongestion(building.x, building.y),
                taxRate: ctx.taxes[building.zone],
                // The utility grid allocates supply building-by-building, so a
                // shortage browns out part of the city. Those per-building flags
                // are the truth here, not the network-wide tile flag.
                powered: building.powered,
                watered: building.watered,
                services: fields.servicesAt(building.x, building.y)
            });
            if (result === 'abandoned') doomed.push(building);
        }

        for (const building of doomed) {
            const tile = this.map.getTile(building.x, building.y);
            this._removeBuilding(building);
            if (tile && tile.zone) {
                tile.growth = 0;
                this.pendingLots.add(tile);   // the lot can be rebuilt later
            }
            eventBus.emit('building:abandoned', building);
        }
    }

    _localCongestion(x, y) {
        let worst = 0;
        const around = [
            this.map.getTile(x - 1, y), this.map.getTile(x + 1, y),
            this.map.getTile(x, y - 1), this.map.getTile(x, y + 1)
        ];
        for (const tile of around) {
            if (tile?.road) worst = Math.max(worst, tile.road.congestion);
        }
        return worst;
    }

    _recomputeStats() {
        const s = this.stats;
        s.population = 0; s.jobs = 0; s.commercialJobs = 0; s.industrialJobs = 0;
        s.residentialCapacity = 0; s.jobCapacity = 0;
        s.abandoned = 0; s.unpowered = 0; s.unwatered = 0;

        let happinessSum = 0, counted = 0;
        for (const b of this.buildings) {
            if (b.abandoned) { s.abandoned++; continue; }
            if (b.isResidential) {
                s.population += b.occupants;
                s.residentialCapacity += b.capacity;
            } else {
                s.jobs += b.occupants;
                s.jobCapacity += b.capacity;
                if (b.isCommercial) s.commercialJobs += b.occupants;
                else s.industrialJobs += b.occupants;
            }
            if (!b.powered) s.unpowered++;
            if (!b.watered) s.unwatered++;
            happinessSum += b.happiness;
            counted++;
        }
        s.population = Math.round(s.population);
        s.jobs = Math.round(s.jobs);
        s.commercialJobs = Math.round(s.commercialJobs);
        s.industrialJobs = Math.round(s.industrialJobs);
        s.happiness = counted > 0 ? happinessSum / counted : 0.6;
    }

    /** Share of each zone type among built lots — feeds the demand model. */
    get zoneShares() {
        const counts = { residential: 0, commercial: 0, industrial: 0 };
        for (const b of this.buildings) counts[b.zone]++;
        const total = Math.max(1, this.buildings.length);
        const shares = {};
        for (const zone of ZONE_LIST) shares[zone] = counts[zone] / total;
        return shares;
    }

    get residentialBuildings() { return this.buildings.filter(b => b.isResidential && !b.abandoned); }
    get jobBuildings() { return this.buildings.filter(b => !b.isResidential && !b.abandoned); }
    get totalPopulation() { return this.stats.population; }
    get totalJobs() { return this.stats.jobs; }
    get averageHappiness() { return clamp01(this.stats.happiness); }

    serialize() {
        const zones = [];
        for (const tile of this.map.tiles) {
            if (tile.zone && !tile.building) zones.push([tile.x, tile.y, ZONE_LIST.indexOf(tile.zone), Math.round(tile.growth)]);
        }
        return { zones, buildings: this.buildings.map(b => b.toJSON()) };
    }

    restore(data = {}) {
        this.clear();
        for (const [x, y, zoneIndex, growth] of data.zones || []) {
            const tile = this.map.getTile(x, y);
            if (!tile) continue;
            tile.clearTrees();
            tile.zone = ZONE_LIST[zoneIndex] ?? 'residential';
            tile.growth = growth || 0;
            this.pendingLots.add(tile);
        }
        for (const entry of data.buildings || []) {
            const building = Building.fromJSON(entry);
            const tile = this.map.getTile(building.x, building.y);
            if (!tile) continue;
            tile.clearTrees();
            tile.zone = building.zone;
            tile.building = building;
            this.buildings.push(building);
        }
        this._recomputeStats();
    }
}
