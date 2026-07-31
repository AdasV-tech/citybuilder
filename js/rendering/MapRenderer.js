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

/**
 * Player-laid pipes and wires (roads carry utilities invisibly). Drawn as a
 * spine reaching toward every neighbour that also conducts the same utility —
 * the same connection-aware approach `drawRoadTile` uses — so a line that
 * turns a corner or meets a road actually looks joined up instead of always
 * being a straight horizontal (pipe) or vertical (wire) stroke regardless of
 * which way it runs.
 */
export function drawUtilityTile(ctx, map, tile, px, py) {
    if (tile.pipe) {
        drawUtilitySpine(ctx, map, tile, px, py, 'conductsWater',
            tile.watered ? COLORS.waterLine : 'rgba(120,160,180,0.75)', 3);
    }
    if (tile.wire) {
        drawUtilitySpine(ctx, map, tile, px, py, 'conductsPower',
            tile.powered ? COLORS.power : 'rgba(150,150,120,0.75)', 2);
        const cx = px + TILE_SIZE * 0.5, cy = py + TILE_SIZE * 0.5;
        ctx.fillStyle = '#6b5a3c';
        ctx.fillRect(cx - 2, cy - 5, 4, 10);
    }
}

function drawUtilitySpine(ctx, map, tile, px, py, conductsKey, color, width) {
    const cx = px + TILE_SIZE * 0.5, cy = py + TILE_SIZE * 0.5;
    const reach = TILE_SIZE * 0.5 + 1; // 1px overlap so neighbouring segments visually meet
    const north = map.getTile(tile.x, tile.y - 1);
    const south = map.getTile(tile.x, tile.y + 1);
    const west = map.getTile(tile.x - 1, tile.y);
    const east = map.getTile(tile.x + 1, tile.y);
    const linked = [north, south, west, east].filter(t => t?.[conductsKey]).length;

    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (north?.[conductsKey]) { ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - reach); }
    if (south?.[conductsKey]) { ctx.moveTo(cx, cy); ctx.lineTo(cx, cy + reach); }
    if (west?.[conductsKey]) { ctx.moveTo(cx, cy); ctx.lineTo(cx - reach, cy); }
    if (east?.[conductsKey]) { ctx.moveTo(cx, cy); ctx.lineTo(cx + reach, cy); }
    // Not connected to anything yet — still show a short stub so a freshly
    // placed tile is visible instead of vanishing.
    if (linked === 0) { ctx.moveTo(cx - TILE_SIZE * 0.2, cy); ctx.lineTo(cx + TILE_SIZE * 0.2, cy); }
    ctx.stroke();
}
