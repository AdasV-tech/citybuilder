// js/traffic/Pathfinder.js
// Simple A* over the road network's tile graph. The road grid is small enough
// (hundreds of tiles) that a plain binary-heap-free A* is fast enough for our
// purposes; if the network grows huge this is the place to optimize first.

import { manhattan, tileKey } from '../utils/MathUtils.js';

export class Pathfinder {
    constructor(roadNetwork) {
        this.roads = roadNetwork;
        this._cache = new Map();
    }

    /** Returns an array of {x,y} tile coordinates from start to goal (inclusive), or null. */
    findPath(startX, startY, goalX, goalY) {
        const cacheKey = startX + ',' + startY + '|' + goalX + ',' + goalY;
        const cached = this._cache.get(cacheKey);
        if (cached) return cached;
        if (!this.roads.hasRoad(startX, startY) || !this.roads.hasRoad(goalX, goalY)) {
            return null;
        }
        if (startX === goalX && startY === goalY) return [{ x: startX, y: startY }];

        const startKey = tileKey(startX, startY);
        const goalKey = tileKey(goalX, goalY);

        const openSet = new Map(); // key -> {x,y,f}
        const cameFrom = new Map();
        const gScore = new Map();
        gScore.set(startKey, 0);
        openSet.set(startKey, { x: startX, y: startY, f: manhattan(startX, startY, goalX, goalY) });

        const closed = new Set();
        let iterations = 0;
        const MAX_ITER = 6000; // safety valve

        while (openSet.size > 0 && iterations < MAX_ITER) {
            iterations++;
            // pick lowest-f node (linear scan; fine at this scale)
            let currentKey = null, current = null, bestF = Infinity;
            for (const [k, v] of openSet) {
                if (v.f < bestF) { bestF = v.f; currentKey = k; current = v; }
            }
            openSet.delete(currentKey);

            if (currentKey === goalKey) {
                const path = this._reconstructPath(cameFrom, currentKey, startKey);
                this._cache.set(cacheKey, path);
                return path;
            }
            closed.add(currentKey);

            const neighbors = this.roads.getConnectedNeighbors(current.x, current.y);
            for (const n of neighbors) {
                const nKey = tileKey(n.x, n.y);
                if (closed.has(nKey)) continue;
                const tentativeG = gScore.get(currentKey) + 1;
                if (tentativeG < (gScore.get(nKey) ?? Infinity)) {
                    cameFrom.set(nKey, currentKey);
                    gScore.set(nKey, tentativeG);
                    const f = tentativeG + manhattan(n.x, n.y, goalX, goalY);
                    openSet.set(nKey, { x: n.x, y: n.y, f });
                }
            }
        }
        return null; // no path found
    }

    clearCache() {
        this._cache.clear();
    }

    _reconstructPath(cameFrom, currentKey, startKey) {
        const path = [];
        let key = currentKey;
        while (key) {
            const [x, y] = key.split(',').map(Number);
            path.unshift({ x, y });
            if (key === startKey) break;
            key = cameFrom.get(key);
        }
        return path;
    }
}
