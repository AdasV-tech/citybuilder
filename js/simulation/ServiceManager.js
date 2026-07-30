// js/simulation/ServiceManager.js
// Placement rules and bookkeeping for every service building. Placement is
// validated in one place (`checkPlacement`) so the UI can show *why* a spot is
// invalid before the player clicks, using exactly the rule the game enforces.

import { ServiceBuilding, resetStructureIds } from './ServiceBuilding.js';
import { getService } from '../data/ServiceCatalog.js';

export class ServiceManager {
    constructor(cityMap) {
        this.map = cityMap;
        this.structures = [];
    }

    clear() {
        for (const s of this.structures) this._detach(s);
        this.structures = [];
        resetStructureIds(1);
    }

    /**
     * @returns {{ok: boolean, reason?: string}} why a footprint is or isn't legal.
     */
    checkPlacement(defId, x, y) {
        const def = getService(defId);
        if (!def) return { ok: false, reason: 'Unknown building' };

        let touchesRoad = false;
        let touchesWater = false;

        for (let dy = 0; dy < def.size; dy++) {
            for (let dx = 0; dx < def.size; dx++) {
                const tile = this.map.getTile(x + dx, y + dy);
                if (!tile) return { ok: false, reason: 'Outside the map' };
                if (tile.isWater) return { ok: false, reason: 'Cannot build on water' };
                if (tile.isRock) return { ok: false, reason: 'Ground is too rocky' };
                if (tile.road) return { ok: false, reason: 'A road is in the way' };
                if (tile.structure) return { ok: false, reason: 'Already occupied' };
                if (tile.building) return { ok: false, reason: 'Demolish the building first' };
                if (tile.zone) return { ok: false, reason: 'De-zone this land first' };
                if (this.map.touchesWater(x + dx, y + dy)) touchesWater = true;
                touchesRoad = touchesRoad || this._tileTouchesRoad(x + dx, y + dy);
            }
        }

        if (def.needsWater && !touchesWater) return { ok: false, reason: 'Must touch fresh water' };
        if (def.needsRoad && !touchesRoad) return { ok: false, reason: 'Needs road access' };
        return { ok: true };
    }

    _tileTouchesRoad(x, y) {
        return !!(this.map.getTile(x - 1, y)?.road || this.map.getTile(x + 1, y)?.road ||
                  this.map.getTile(x, y - 1)?.road || this.map.getTile(x, y + 1)?.road);
    }

    /** Place a validated structure. Returns the instance, or null if illegal. */
    place(defId, x, y, day = 0) {
        if (!this.checkPlacement(defId, x, y).ok) return null;
        const structure = new ServiceBuilding(defId, x, y);
        structure.builtAtDay = day;
        structure.forEachTile((tx, ty) => {
            const tile = this.map.getTile(tx, ty);
            if (!tile) return;
            tile.clearTrees();
            tile.structure = structure;
            tile.structureOrigin = (tx === x && ty === y);
        });
        this.structures.push(structure);
        return structure;
    }

    /** Remove a structure (from any tile it covers). Returns its refund value. */
    remove(structure) {
        if (!structure) return 0;
        const index = this.structures.indexOf(structure);
        if (index === -1) return 0;
        this.structures.splice(index, 1);
        this._detach(structure);
        return Math.round((structure.def?.cost ?? 0) * 0.25);
    }

    _detach(structure) {
        structure.forEachTile((tx, ty) => {
            const tile = this.map.getTile(tx, ty);
            if (tile && tile.structure === structure) {
                tile.structure = null;
                tile.structureOrigin = false;
            }
        });
    }

    structureAt(x, y) {
        return this.map.getTile(x, y)?.structure ?? null;
    }

    get totalUpkeep() {
        return this.structures.reduce((sum, s) => sum + s.upkeep, 0);
    }

    /** Aggregate supply figures used by the utility grid and the HUD. */
    get totals() {
        let power = 0, water = 0, sewage = 0;
        for (const s of this.structures) {
            power += s.powerOutput;
            water += s.waterOutput;
            sewage += s.sewageCapacity;
        }
        return { power, water, sewage };
    }

    serialize() {
        return this.structures.map(s => s.toJSON());
    }

    restore(data = []) {
        this.clear();
        for (const entry of data) {
            const structure = ServiceBuilding.fromJSON(entry);
            if (!structure.def) continue;
            structure.forEachTile((tx, ty) => {
                const tile = this.map.getTile(tx, ty);
                if (!tile) return;
                tile.clearTrees();
                tile.structure = structure;
                tile.structureOrigin = (tx === structure.x && ty === structure.y);
            });
            this.structures.push(structure);
        }
    }
}
