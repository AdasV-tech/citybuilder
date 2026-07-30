// js/simulation/CityMap.js
// Owns the tile grid and generates the starting landscape: a noise-driven
// coastline/lakes, a meandering river, forests and rocky outcrops. Terrain is a
// pure function of the seed, so saves only need to store the seed plus the
// handful of tiles the player actually changed.

import { MAP_SIZE, TERRAIN } from '../utils/Constants.js';
import { Tile } from './Tile.js';
import { makeRng, makeNoise2D, fbm, clamp } from '../utils/MathUtils.js';

export class CityMap {
    constructor(width = MAP_SIZE, height = MAP_SIZE, seed = Date.now() % 100000) {
        this.width = width;
        this.height = height;
        this.seed = seed >>> 0;
        this.tiles = new Array(width * height);
        this._generate();
    }

    index(x, y) { return y * this.width + x; }

    inBounds(x, y) {
        return x >= 0 && y >= 0 && x < this.width && y < this.height;
    }

    getTile(x, y) {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) return null;
        return this.tiles[y * this.width + x];
    }

    forEachTile(callback) {
        const tiles = this.tiles;
        for (let i = 0; i < tiles.length; i++) {
            const t = tiles[i];
            callback(t, t.x, t.y);
        }
    }

    /** True when any of the four neighbours is water — used by pumps/outlets. */
    touchesWater(x, y) {
        return !!(this.getTile(x - 1, y)?.isWater || this.getTile(x + 1, y)?.isWater ||
                  this.getTile(x, y - 1)?.isWater || this.getTile(x, y + 1)?.isWater);
    }

    // --- generation -----------------------------------------------------------

    _generate() {
        const rng = makeRng(this.seed);
        const land = makeNoise2D(this.seed);
        const detail = makeNoise2D(this.seed ^ 0x9e3779b9);
        const w = this.width, h = this.height;
        const scale = 1 / 26;

        // Height field: fbm plus a mild bowl so water tends to sit at the edges.
        const height = new Float32Array(w * h);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const nx = x * scale, ny = y * scale;
                let v = fbm(land, nx, ny, 4);
                const dx = (x / w - 0.5) * 2, dy = (y / h - 0.5) * 2;
                const edge = Math.max(Math.abs(dx), Math.abs(dy));
                v -= Math.max(0, edge - 0.72) * 0.9; // taper to water near the border
                height[y * w + x] = v;
            }
        }

        this._carveRiver(height, rng);

        const WATER_LEVEL = 0.42;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = y * w + x;
                const v = height[i];
                let terrain;
                if (v < WATER_LEVEL) terrain = TERRAIN.WATER;
                else if (v < WATER_LEVEL + 0.025) terrain = TERRAIN.SHORE;
                else if (v > 0.80) terrain = TERRAIN.ROCK;
                else terrain = TERRAIN.GRASS;

                if (terrain === TERRAIN.GRASS) {
                    // Forest clumps: separate noise band, thinned by a little jitter.
                    const f = fbm(detail, x * 0.09, y * 0.09, 3);
                    if (f > 0.60 && rng() > 0.25) terrain = TERRAIN.FOREST;
                }
                const variant = Math.floor(rng() * 256);
                this.tiles[i] = new Tile(x, y, terrain, variant);
            }
        }

        this.start = this._findStartLocation();
    }

    /** A meandering river from the north edge to the south edge. */
    _carveRiver(height, rng) {
        const w = this.width, h = this.height;
        let x = w * (0.25 + rng() * 0.5);
        let drift = (rng() - 0.5) * 0.6;
        const halfWidth = 1.6 + rng() * 1.4;

        for (let y = 0; y < h; y++) {
            drift += (rng() - 0.5) * 0.28;
            drift = clamp(drift, -0.9, 0.9);
            x = clamp(x + drift, 6, w - 7);
            const span = Math.ceil(halfWidth) + 2;
            for (let dx = -span; dx <= span; dx++) {
                const tx = Math.round(x) + dx;
                if (tx < 0 || tx >= w) continue;
                const d = Math.abs(tx - x);
                // Carve a smooth valley so the banks get a shore ring for free.
                const cut = Math.max(0, 1 - d / (halfWidth + 1.8)) * 0.34;
                height[y * w + tx] -= cut;
            }
        }
    }

    /**
     * Pick where the city starts: the dry, unblocked spot nearest the middle of
     * the map. Nothing about the terrain is edited to make room — the player
     * gets the landscape the seed produced, we just point them at a good bit.
     */
    _findStartLocation() {
        const cx = Math.floor(this.width / 2), cy = Math.floor(this.height / 2);
        const r = 6;
        let best = { x: cx, y: cy }, bestScore = -Infinity;

        for (let y = r; y < this.height - r; y++) {
            for (let x = r; x < this.width - r; x++) {
                let land = 0;
                for (let dy = -r; dy <= r; dy += 2) {
                    for (let dx = -r; dx <= r; dx += 2) {
                        const t = this.getTile(x + dx, y + dy);
                        if (t && !t.isWater && !t.isRock) land++;
                    }
                }
                const distanceToCentre = Math.hypot(x - cx, y - cy);
                const score = land * 10 - distanceToCentre;
                if (score > bestScore) { bestScore = score; best = { x, y }; }
            }
        }
        return best;
    }
}
