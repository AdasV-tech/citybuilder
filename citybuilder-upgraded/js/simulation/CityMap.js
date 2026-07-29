// js/simulation/CityMap.js
// Owns the 2D grid of Tiles, generates starting terrain (grass / trees / water),
// and provides safe accessors used by every other system.

import { MAP_WIDTH, MAP_HEIGHT, TREE_DENSITY } from '../utils/Constants.js';
import { Tile, Terrain } from './Tile.js';
import { makeRng } from '../utils/MathUtils.js';

export class CityMap {
    constructor(width = MAP_WIDTH, height = MAP_HEIGHT, seed = 1337) {
        this.width = width;
        this.height = height;
        this.seed = seed;
        this.rng = makeRng(seed);
        this.tiles = this._generate();
    }

    inBounds(x, y) {
        return x >= 0 && y >= 0 && x < this.width && y < this.height;
    }

    getTile(x, y) {
        if (!this.inBounds(x, y)) return null;
        return this.tiles[y][x];
    }

    forEachTile(callback) {
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                callback(this.tiles[y][x], x, y);
            }
        }
    }

    _generate() {
        const rng = this.rng;
        const grid = [];
        for (let y = 0; y < this.height; y++) {
            const row = [];
            for (let x = 0; x < this.width; x++) {
                row.push(new Tile(x, y, Terrain.GRASS));
            }
            grid.push(row);
        }

        this._carveRiver(grid, rng);
        this._carveLake(grid, rng);
        this._scatterTrees(grid, rng);

        return grid;
    }

    // A gently wandering river crossing the map diagonally.
    _carveRiver(grid, rng) {
        const width = this.width, height = this.height;
        let x = Math.floor(width * 0.15);
        const riverHalfWidth = 2;
        for (let y = 0; y < height; y++) {
            // random walk with gentle drift
            x += Math.round((rng() - 0.45) * 2.2);
            x = Math.max(4, Math.min(width - 5, x));
            for (let dx = -riverHalfWidth; dx <= riverHalfWidth; dx++) {
                const tx = x + dx;
                if (tx >= 0 && tx < width) {
                    grid[y][tx].terrain = Terrain.WATER;
                }
            }
        }
    }

    // One or two circular-ish lakes away from the river.
    _carveLake(grid, rng) {
        const width = this.width, height = this.height;
        const cx = Math.floor(width * 0.72);
        const cy = Math.floor(height * 0.30);
        const radius = 7 + Math.floor(rng() * 3);
        for (let y = -radius; y <= radius; y++) {
            for (let x = -radius; x <= radius; x++) {
                const tx = cx + x, ty = cy + y;
                if (tx < 0 || ty < 0 || tx >= width || ty >= height) continue;
                const dist = Math.sqrt(x * x + y * y) + (rng() - 0.5) * 2.2;
                if (dist <= radius) {
                    grid[ty][tx].terrain = Terrain.WATER;
                }
            }
        }
    }

    _scatterTrees(grid, rng) {
        const width = this.width, height = this.height;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const tile = grid[y][x];
                if (tile.terrain === Terrain.GRASS && rng() < TREE_DENSITY) {
                    tile.terrain = Terrain.TREE;
                }
            }
        }
    }
}
