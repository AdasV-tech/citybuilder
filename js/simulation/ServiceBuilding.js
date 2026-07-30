// js/simulation/ServiceBuilding.js
// An instance of a catalog entry placed on the map (power plant, pump, school…).
// It knows its footprint and whether it is currently able to operate; the
// managers around it read `def` for everything static.

import { getService } from '../data/ServiceCatalog.js';

let nextStructureId = 1;

export function resetStructureIds(value = 1) { nextStructureId = value; }

export class ServiceBuilding {
    constructor(defId, x, y) {
        this.id = nextStructureId++;
        this.defId = defId;
        this.def = getService(defId);
        this.x = x;                 // top-left tile of the footprint
        this.y = y;
        this.size = this.def?.size ?? 1;
        this.powered = false;
        this.watered = false;
        this.builtAtDay = 0;
    }

    get name() { return this.def?.name ?? this.defId; }
    get icon() { return this.def?.icon ?? '⬛'; }
    get upkeep() { return this.def?.upkeep ?? 0; }

    /** Centre of the footprint in tile coordinates. */
    get centerX() { return this.x + this.size / 2; }
    get centerY() { return this.y + this.size / 2; }

    get powerDemand() { return this.def?.demandPower ?? 0; }
    get waterDemand() { return this.def?.demandWater ?? 0; }

    /** A service only does its job when its own utilities are satisfied. */
    get operational() {
        if (this.powerDemand > 0 && !this.powered) return false;
        if (this.waterDemand > 0 && !this.watered) return false;
        return true;
    }

    get powerOutput() { return this.def?.power ?? 0; }
    get waterOutput() { return this.operational ? (this.def?.water ?? 0) : 0; }
    get sewageCapacity() { return this.operational ? (this.def?.sewage ?? 0) : 0; }

    coversTile(x, y) {
        return x >= this.x && y >= this.y && x < this.x + this.size && y < this.y + this.size;
    }

    forEachTile(callback) {
        for (let dy = 0; dy < this.size; dy++) {
            for (let dx = 0; dx < this.size; dx++) callback(this.x + dx, this.y + dy);
        }
    }

    toJSON() {
        return { i: this.id, d: this.defId, x: this.x, y: this.y };
    }

    static fromJSON(data) {
        const s = new ServiceBuilding(data.d, data.x, data.y);
        s.id = data.i ?? s.id;
        if (s.id >= nextStructureId) nextStructureId = s.id + 1;
        return s;
    }
}
