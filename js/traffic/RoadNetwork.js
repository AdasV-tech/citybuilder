// js/traffic/RoadNetwork.js
// Tracks which tiles have roads and keeps their connection bitmasks up to date
// whenever a road is added/removed nearby. Also exposes the adjacency graph
// that the Pathfinder walks over.

export const DIR = Object.freeze({ N: 1, E: 2, S: 4, W: 8 });

const NEIGHBOR_OFFSETS = [
    { dx: 0, dy: -1, bit: DIR.N, opposite: DIR.S },
    { dx: 1, dy: 0, bit: DIR.E, opposite: DIR.W },
    { dx: 0, dy: 1, bit: DIR.S, opposite: DIR.N },
    { dx: -1, dy: 0, bit: DIR.W, opposite: DIR.E }
];

export class RoadNetwork {
    constructor(cityMap) {
        this.map = cityMap;
        this.roadTiles = new Set(); // "x,y" keys, mirrors tile.road existing
    }

    key(x, y) { return `${x},${y}`; }

    hasRoad(x, y) {
        const tile = this.map.getTile(x, y);
        return !!(tile && tile.road);
    }

    /** Place a road tile. Returns true if a new road was actually created. */
    placeRoad(x, y) {
        const tile = this.map.getTile(x, y);
        if (!tile) return false;
        if (tile.road) return false; // already a road
        if (tile.isWater) return false;
        if (tile.building || tile.zoneType) return false; // can't pave over zoned/built lots

        tile.clearNature();
        tile.road = { connections: 0 };
        this.roadTiles.add(this.key(x, y));
        this._updateConnections(x, y);
        return true;
    }

    /** Remove a road tile. Returns true if something was removed. */
    removeRoad(x, y) {
        const tile = this.map.getTile(x, y);
        if (!tile || !tile.road) return false;
        tile.road = null;
        this.roadTiles.delete(this.key(x, y));
        this._updateConnections(x, y);
        return true;
    }

    /** Recompute this tile's and its neighbors' connection bitmasks. */
    _updateConnections(x, y) {
        for (const { dx, dy } of [{ dx: 0, dy: 0 }, ...NEIGHBOR_OFFSETS]) {
            const tx = x + dx, ty = y + dy;
            const tile = this.map.getTile(tx, ty);
            if (!tile || !tile.road) continue;
            let mask = 0;
            for (const n of NEIGHBOR_OFFSETS) {
                if (this.hasRoad(tx + n.dx, ty + n.dy)) mask |= n.bit;
            }
            tile.road.connections = mask;
        }
    }

    /** Returns array of {x,y} neighboring road tiles connected to (x,y). */
    getConnectedNeighbors(x, y) {
        const results = [];
        for (const n of NEIGHBOR_OFFSETS) {
            const nx = x + n.dx, ny = y + n.dy;
            if (this.hasRoad(nx, ny)) results.push({ x: nx, y: ny });
        }
        return results;
    }

    /** Find the nearest road tile to (x, y) within a small search radius, or null. */
    findNearestRoad(x, y, maxRadius = 4) {
        if (this.hasRoad(x, y)) return { x, y };
        for (let r = 1; r <= maxRadius; r++) {
            for (let dx = -r; dx <= r; dx++) {
                for (let dy = -r; dy <= r; dy++) {
                    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
                    const tx = x + dx, ty = y + dy;
                    if (this.hasRoad(tx, ty)) return { x: tx, y: ty };
                }
            }
        }
        return null;
    }

    get totalRoadTiles() {
        return this.roadTiles.size;
    }
}
