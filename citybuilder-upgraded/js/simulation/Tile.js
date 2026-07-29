// js/simulation/Tile.js
// A single grid cell. Holds terrain (permanent-ish) plus whatever the player
// has built on top of it (road / zone / building). Kept as a plain-ish class
// so it stays cheap to create thousands of.

export const Terrain = Object.freeze({
    GRASS: 'grass',
    WATER: 'water',
    TREE: 'tree'
});

export class Tile {
    constructor(x, y, terrain = Terrain.GRASS) {
        this.x = x;
        this.y = y;
        this.terrain = terrain;

        this.road = null;      // { connections: bitmask N|E|S|W } when a road occupies this tile
        this.zoneType = null;  // 'residential' | 'commercial' | 'industrial' | null
        this.building = null;  // Building instance | null
        this.growthTimer = 0;  // ms accumulated toward spawning a building on a zoned lot
    }

    get isWater() { return this.terrain === Terrain.WATER; }
    get isTree() { return this.terrain === Terrain.TREE; }

    /** Buildable = not water, and not already a road/building. Trees are clearable. */
    get isBuildable() {
        return this.terrain !== Terrain.WATER && !this.road && !this.building && !this.zoneType;
    }

    get isEmptyZonable() {
        return this.terrain !== Terrain.WATER && this.terrain !== Terrain.TREE && !this.road && !this.building;
    }

    /** Whether the bulldozer tool has anything to do here (road/zone/building/tree). */
    get isBulldozable() {
        return !!(this.road || this.zoneType || this.building || this.terrain === Terrain.TREE);
    }

    clearNature() {
        if (this.terrain === Terrain.TREE) this.terrain = Terrain.GRASS;
    }
}
