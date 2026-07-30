// js/traffic/Pathfinder.js
// A* over the road graph with a binary heap and typed-array bookkeeping, so a
// city with thousands of road tiles still finds routes in well under a
// millisecond. Avenues cost less per tile than streets, which makes traffic
// naturally prefer the big roads — exactly the behaviour a player expects.
//
// Results are cached per (start, goal) and the whole cache is dropped whenever
// the road network's version changes.

const MAX_CACHE = 900;
const TILE_COST = { street: 1, avenue: 0.62 };

class MinHeap {
    constructor(capacity) {
        this.keys = new Int32Array(capacity);
        this.scores = new Float64Array(capacity);
        this.size = 0;
    }
    clear() { this.size = 0; }
    push(key, score) {
        let i = this.size++;
        this.keys[i] = key; this.scores[i] = score;
        while (i > 0) {
            const parent = (i - 1) >> 1;
            if (this.scores[parent] <= this.scores[i]) break;
            this._swap(i, parent);
            i = parent;
        }
    }
    pop() {
        const top = this.keys[0];
        this.size--;
        if (this.size > 0) {
            this.keys[0] = this.keys[this.size];
            this.scores[0] = this.scores[this.size];
            let i = 0;
            for (;;) {
                const l = i * 2 + 1, r = l + 1;
                let smallest = i;
                if (l < this.size && this.scores[l] < this.scores[smallest]) smallest = l;
                if (r < this.size && this.scores[r] < this.scores[smallest]) smallest = r;
                if (smallest === i) break;
                this._swap(i, smallest);
                i = smallest;
            }
        }
        return top;
    }
    _swap(a, b) {
        const k = this.keys[a]; this.keys[a] = this.keys[b]; this.keys[b] = k;
        const s = this.scores[a]; this.scores[a] = this.scores[b]; this.scores[b] = s;
    }
}

export class Pathfinder {
    constructor(roadNetwork) {
        this.roads = roadNetwork;
        this.map = roadNetwork.map;
        const size = this.map.width * this.map.height;

        this._gScore = new Float64Array(size);
        this._cameFrom = new Int32Array(size);
        this._visited = new Int32Array(size);   // stamped with `_stamp` instead of cleared
        this._stamp = 0;
        this._heap = new MinHeap(size);

        this._cache = new Map();
        this._cacheVersion = roadNetwork.version;
    }

    clearCache() {
        this._cache.clear();
        this._cacheVersion = this.roads.version;
    }

    /** @returns {Array<{x,y}>|null} inclusive path from start to goal. */
    findPath(startX, startY, goalX, goalY) {
        if (this._cacheVersion !== this.roads.version) this.clearCache();

        const w = this.map.width;
        const startIndex = startY * w + startX;
        const goalIndex = goalY * w + goalX;
        const cacheKey = startIndex * 1000000 + goalIndex;

        const cached = this._cache.get(cacheKey);
        if (cached !== undefined) return cached;

        const path = this._search(startIndex, goalIndex);
        if (this._cache.size >= MAX_CACHE) {
            // Drop the oldest quarter; Map preserves insertion order.
            let toDrop = MAX_CACHE / 4;
            for (const key of this._cache.keys()) {
                this._cache.delete(key);
                if (--toDrop <= 0) break;
            }
        }
        this._cache.set(cacheKey, path);
        return path;
    }

    _search(startIndex, goalIndex) {
        const map = this.map, w = map.width, h = map.height;
        const tiles = map.tiles;
        if (!tiles[startIndex]?.road || !tiles[goalIndex]?.road) return null;
        if (startIndex === goalIndex) {
            return [{ x: startIndex % w, y: (startIndex / w) | 0 }];
        }

        const stamp = ++this._stamp;
        const gScore = this._gScore, cameFrom = this._cameFrom, visited = this._visited;
        const heap = this._heap;
        heap.clear();

        const gx = goalIndex % w, gy = (goalIndex / w) | 0;
        const heuristic = (index) => {
            const x = index % w, y = (index / w) | 0;
            return (Math.abs(x - gx) + Math.abs(y - gy)) * 0.62;
        };

        gScore[startIndex] = 0;
        cameFrom[startIndex] = -1;
        visited[startIndex] = stamp;
        heap.push(startIndex, heuristic(startIndex));

        let expansions = 0;
        const MAX_EXPANSIONS = 20000;

        while (heap.size > 0 && expansions++ < MAX_EXPANSIONS) {
            const current = heap.pop();
            if (current === goalIndex) return this._reconstruct(current, startIndex);

            const x = current % w, y = (current / w) | 0;
            const currentG = gScore[current];

            for (let dir = 0; dir < 4; dir++) {
                let next;
                if (dir === 0) { if (y === 0) continue; next = current - w; }
                else if (dir === 1) { if (x === w - 1) continue; next = current + 1; }
                else if (dir === 2) { if (y === h - 1) continue; next = current + w; }
                else { if (x === 0) continue; next = current - 1; }

                const road = tiles[next].road;
                if (!road) continue;

                const cost = (TILE_COST[road.type] ?? 1) * (1 + road.congestion * 1.4);
                const tentative = currentG + cost;
                if (visited[next] === stamp && tentative >= gScore[next]) continue;

                visited[next] = stamp;
                gScore[next] = tentative;
                cameFrom[next] = current;
                heap.push(next, tentative + heuristic(next));
            }
        }
        return null;
    }

    _reconstruct(goalIndex, startIndex) {
        const w = this.map.width;
        const path = [];
        let index = goalIndex;
        while (index !== -1) {
            path.push({ x: index % w, y: (index / w) | 0 });
            if (index === startIndex) break;
            index = this._cameFrom[index];
        }
        path.reverse();
        return path;
    }
}
