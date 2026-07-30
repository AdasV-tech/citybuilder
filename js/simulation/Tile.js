// js/simulation/Tile.js
// One grid cell. Terrain is generated once; everything else is player-built.
// Kept as a small monomorphic class so V8 can allocate ~10k of them cheaply.

import { TERRAIN } from '../utils/Constants.js';

export class Tile {
    constructor(x, y, terrain = TERRAIN.GRASS, variant = 0) {
        this.x = x;
        this.y = y;
        this.terrain = terrain;
        this.variant = variant;   // deterministic 0..255 detail seed for rendering

        this.road = null;         // { type, connections, cars, congestion }
        this.zone = null;         // 'residential' | 'commercial' | 'industrial'
        this.building = null;     // Building on a zoned lot
        this.structure = null;    // ServiceBuilding occupying this tile
        this.structureOrigin = false;

        this.pipe = false;        // player-laid water pipe
        this.wire = false;        // player-laid power line

        this.growth = 0;          // ms accumulated toward spawning a building
        this.powered = false;     // refreshed by UtilityGrid
        this.watered = false;
    }

    get isWater() { return this.terrain === TERRAIN.WATER; }
    get isForest() { return this.terrain === TERRAIN.FOREST; }
    get isRock() { return this.terrain === TERRAIN.ROCK; }

    /** Nothing built here and the ground can be built on. */
    get isFree() {
        return !this.isWater && !this.isRock && !this.road && !this.building &&
               !this.structure && !this.zone;
    }

    /** Can a zone be painted here? Trees are cleared automatically. */
    get isZonable() {
        return !this.isWater && !this.isRock && !this.road && !this.building && !this.structure;
    }

    get hasAnything() {
        return !!(this.road || this.zone || this.building || this.structure ||
                  this.pipe || this.wire || this.isForest);
    }

    /** Roads carry utilities underneath, so they conduct as well as pipes/wires. */
    get conductsPower() { return !!this.road || this.wire || !!this.structure || !!this.building; }
    get conductsWater() { return !!this.road || this.pipe || !!this.structure || !!this.building; }

    clearTrees() {
        if (this.terrain === TERRAIN.FOREST) this.terrain = TERRAIN.GRASS;
    }
}
