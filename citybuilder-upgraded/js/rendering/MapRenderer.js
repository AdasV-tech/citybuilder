// js/rendering/MapRenderer.js
// Draws terrain: grass (with a subtle checker tint), water, and trees.

import { TILE_SIZE, COLORS } from '../utils/Constants.js';
import { Terrain } from '../simulation/Tile.js';

export function drawMap(ctx, cityMap, bounds) {
    for (let y = bounds.minY; y <= bounds.maxY; y++) {
        for (let x = bounds.minX; x <= bounds.maxX; x++) {
            const tile = cityMap.getTile(x, y);
            if (!tile) continue;
            const px = x * TILE_SIZE, py = y * TILE_SIZE;

            if (tile.terrain === Terrain.WATER) {
                ctx.fillStyle = COLORS.water;
                ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            } else {
                ctx.fillStyle = ((x + y) % 2 === 0) ? COLORS.grass : COLORS.grassAlt;
                ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            }
        }
    }

    // Trees drawn in a second pass so canopies can slightly overlap neighboring tiles.
    for (let y = bounds.minY; y <= bounds.maxY; y++) {
        for (let x = bounds.minX; x <= bounds.maxX; x++) {
            const tile = cityMap.getTile(x, y);
            if (tile && tile.terrain === Terrain.TREE) {
                drawTree(ctx, x * TILE_SIZE, y * TILE_SIZE);
            }
        }
    }
}

function drawTree(ctx, px, py) {
    const cx = px + TILE_SIZE / 2, cy = py + TILE_SIZE / 2;
    ctx.fillStyle = COLORS.treeTrunk;
    ctx.fillRect(cx - 2, cy - 2, 4, 8);
    ctx.fillStyle = COLORS.tree;
    ctx.beginPath();
    ctx.arc(cx, cy - 6, 9, 0, Math.PI * 2);
    ctx.fill();
}
