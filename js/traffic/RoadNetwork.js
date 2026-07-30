// js/traffic/RoadNetwork.js
// Tracks road tiles, their connection bitmasks (for drawing junctions and for
// pathfinding), their type (street/avenue) and their live congestion. Also
// counts pipe/wire tiles so the economy can bill for them.

export const DIR = Object.freeze({ N: 1, E: 2, S: 4, W: 8 });

const NEIGHBORS = [
    { dx: 0, dy: -1, bit: DIR.N },
    { dx: 1, dy: 0, bit: DIR.E },
    { dx: 0, dy: 1, bit: DIR.S },
    { dx: -1, dy: 0, bit: DIR.W }
];

export class RoadNetwork {
    constructor(cityMap) {
        this.map = cityMap;
        this.roadTiles = new Set();   // "x,y"
        this.version = 0;             // bumped on any change; invalidates the path cache
    }

    hasRoad(x, y) {
        const tile = this.map.getTile(x, y);
        return !!(tile && tile.road);
    }

    roadType(x, y) {
        return this.map.getTile(x, y)?.road?.type ?? null;
    }

    /** Place (or upgrade) a road. Returns 'placed' | 'upgraded' | null. */
    placeRoad(x, y, type = 'street') {
        const tile = this.map.getTile(x, y);
        if (!tile) return null;
        if (tile.isWater || tile.isRock) return null;
        if (tile.building || tile.structure) return null;

        if (tile.road) {
            if (tile.road.type === type) return null;
            tile.road.type = type;
            this.version++;
            return 'upgraded';
        }

        tile.clearTrees();
        tile.zone = null;
        tile.growth = 0;
        tile.road = { type, connections: 0, cars: 0, congestion: 0 };
        this.roadTiles.add(`${x},${y}`);
        this._refreshConnections(x, y);
        this.version++;
        return 'placed';
    }

    removeRoad(x, y) {
        const tile = this.map.getTile(x, y);
        if (!tile || !tile.road) return false;
        tile.road = null;
        this.roadTiles.delete(`${x},${y}`);
        this._refreshConnections(x, y);
        this.version++;
        return true;
    }

    _refreshConnections(x, y) {
        const update = (tx, ty) => {
            const tile = this.map.getTile(tx, ty);
            if (!tile || !tile.road) return;
            let mask = 0;
            for (const n of NEIGHBORS) {
                if (this.hasRoad(tx + n.dx, ty + n.dy)) mask |= n.bit;
            }
            tile.road.connections = mask;
        };
        update(x, y);
        for (const n of NEIGHBORS) update(x + n.dx, y + n.dy);
    }

    getConnectedNeighbors(x, y) {
        const results = [];
        for (const n of NEIGHBORS) {
            const nx = x + n.dx, ny = y + n.dy;
            if (this.hasRoad(nx, ny)) results.push({ x: nx, y: ny });
        }
        return results;
    }

    /** Nearest road tile within `maxRadius`, searched in expanding rings. */
    findNearestRoad(x, y, maxRadius = 4) {
        if (this.hasRoad(x, y)) return { x, y };
        for (let r = 1; r <= maxRadius; r++) {
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
                    if (this.hasRoad(x + dx, y + dy)) return { x: x + dx, y: y + dy };
                }
            }
        }
        return null;
    }

    hasAdjacentRoad(x, y) {
        return this.hasRoad(x - 1, y) || this.hasRoad(x + 1, y) ||
               this.hasRoad(x, y - 1) || this.hasRoad(x, y + 1);
    }

    get totalRoadTiles() { return this.roadTiles.size; }

    tileCountsByType() {
        let street = 0, avenue = 0;
        for (const tile of this.map.tiles) {
            if (!tile.road) continue;
            if (tile.road.type === 'avenue') avenue++; else street++;
        }
        return { street, avenue };
    }

    get utilityTileCount() {
        let pipe = 0, wire = 0;
        for (const tile of this.map.tiles) {
            if (tile.pipe) pipe++;
            if (tile.wire) wire++;
        }
        return { pipe, wire };
    }

    /** Called by TrafficManager with fresh per-tile car counts. */
    applyCongestion(counts, capacityFor) {
        for (const tile of this.map.tiles) {
            if (!tile.road) continue;
            const cars = counts.get(`${tile.x},${tile.y}`) ?? 0;
            tile.road.cars = cars;
            const target = Math.min(1, cars / capacityFor(tile.road.type));
            // Ease toward the target so the traffic view doesn't strobe.
            tile.road.congestion += (target - tile.road.congestion) * 0.25;
        }
    }

    serialize() {
        const out = [];
        for (const tile of this.map.tiles) {
            if (tile.road) out.push([tile.x, tile.y, tile.road.type === 'avenue' ? 1 : 0]);
        }
        return out;
    }

    restore(data = []) {
        this.roadTiles.clear();
        for (const [x, y, isAvenue] of data) {
            this.placeRoad(x, y, isAvenue ? 'avenue' : 'street');
        }
    }
}
