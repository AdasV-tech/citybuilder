// js/rendering/MapRenderer.js
// Terrain drawing. Every tile is a pure function of (terrain, variant), which
// is what lets the chunk cache work: a chunk only ever needs redrawing when the
// player changes something inside it.

import { TILE_SIZE, TERRAIN, COLORS } from '../utils/Constants.js';

const GRASS_SHADES = [COLORS.grass, COLORS.grassDark, COLORS.grassLight, COLORS.grass];
const FOREST_SHADES = [COLORS.forest, COLORS.forestDark];
const WATER_SHADES = [COLORS.water, COLORS.waterDeep, COLORS.waterShallow];

/** Base ground colour under everything else. */
export function drawTerrainTile(ctx, tile, px, py) {
    const v = tile.variant;
    switch (tile.terrain) {
        case TERRAIN.WATER:
            ctx.fillStyle = WATER_SHADES[v % WATER_SHADES.length];
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            // ripple highlight
            ctx.fillStyle = 'rgba(255,255,255,0.05)';
            ctx.fillRect(px + (v % 5) * 4, py + ((v >> 2) % 6) * 4, TILE_SIZE * 0.4, 2);
            break;
        case TERRAIN.SHORE:
            ctx.fillStyle = COLORS.shore;
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            ctx.fillStyle = 'rgba(0,0,0,0.05)';
            ctx.fillRect(px, py, TILE_SIZE, (v % 3) + 1);
            break;
        case TERRAIN.ROCK:
            ctx.fillStyle = COLORS.rock;
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            ctx.fillStyle = 'rgba(0,0,0,0.14)';
            ctx.beginPath();
            ctx.moveTo(px + 6, py + TILE_SIZE - 6);
            ctx.lineTo(px + TILE_SIZE * 0.5, py + 5 + (v % 5));
            ctx.lineTo(px + TILE_SIZE - 5, py + TILE_SIZE - 6);
            ctx.closePath();
            ctx.fill();
            break;
        case TERRAIN.FOREST:
            ctx.fillStyle = GRASS_SHADES[v % GRASS_SHADES.length];
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            drawTrees(ctx, px, py, v);
            break;
        default:
            ctx.fillStyle = GRASS_SHADES[v % GRASS_SHADES.length];
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            if (v % 11 === 0) {
                // sparse grass tufts break up the flat colour
                ctx.fillStyle = 'rgba(255,255,255,0.06)';
                ctx.fillRect(px + (v % 20), py + ((v >> 3) % 20), 3, 3);
            }
            break;
    }
}

function drawTrees(ctx, px, py, variant) {
    const count = 2 + (variant % 2);
    for (let i = 0; i < count; i++) {
        const seed = variant + i * 47;
        const cx = px + 7 + (seed % 18);
        const cy = py + 8 + ((seed >> 2) % 16);
        const r = 5 + (seed % 3);
        ctx.fillStyle = 'rgba(0,0,0,0.16)';
        ctx.beginPath();
        ctx.ellipse(cx + 2, cy + 3, r, r * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = FOREST_SHADES[seed % FOREST_SHADES.length];
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.10)';
        ctx.beginPath();
        ctx.arc(cx - r * 0.3, cy - r * 0.3, r * 0.42, 0, Math.PI * 2);
        ctx.fill();
    }
}

/** Zone paint under an empty lot. */
export function drawZoneTint(ctx, tile, px, py) {
    if (!tile.zone || tile.building) return;
    ctx.fillStyle = COLORS.zone[tile.zone];
    ctx.fillRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 1.5, py + 1.5, TILE_SIZE - 3, TILE_SIZE - 3);
}

/** Player-laid pipes and wires (roads carry utilities invisibly). */
export function drawUtilityTile(ctx, tile, px, py) {
    if (tile.pipe) {
        ctx.strokeStyle = tile.watered ? COLORS.waterLine : 'rgba(120,160,180,0.75)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(px, py + TILE_SIZE * 0.5);
        ctx.lineTo(px + TILE_SIZE, py + TILE_SIZE * 0.5);
        ctx.stroke();
    }
    if (tile.wire) {
        ctx.strokeStyle = tile.powered ? COLORS.power : 'rgba(150,150,120,0.75)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px + TILE_SIZE * 0.5, py);
        ctx.lineTo(px + TILE_SIZE * 0.5, py + TILE_SIZE);
        ctx.stroke();
        ctx.fillStyle = '#6b5a3c';
        ctx.fillRect(px + TILE_SIZE * 0.5 - 2, py + TILE_SIZE * 0.5 - 5, 4, 10);
    }
}
