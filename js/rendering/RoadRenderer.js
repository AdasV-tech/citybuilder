// js/rendering/RoadRenderer.js
// Roads are drawn from their connection bitmask: pavement is inset from the
// tile edge except where a neighbour connects, so straights, corners, T's and
// crossroads all form automatically — no sprite sheet, no special cases.

import { TILE_SIZE, COLORS } from '../utils/Constants.js';
import { DIR } from '../traffic/RoadNetwork.js';

const ROAD_WIDTH = { street: 0.72, avenue: 0.92 };

export function drawRoadTile(ctx, tile, px, py) {
    const road = tile.road;
    if (!road) return;

    const width = ROAD_WIDTH[road.type] ?? ROAD_WIDTH.street;
    const half = (TILE_SIZE * width) / 2;
    const cx = px + TILE_SIZE / 2;
    const cy = py + TILE_SIZE / 2;
    const mask = road.connections;

    // Sidewalk apron, then asphalt, drawn as a plus-shape from the centre out.
    const kerb = half + TILE_SIZE * 0.1;
    paintCross(ctx, cx, cy, kerb, mask, COLORS.sidewalk);
    paintCross(ctx, cx, cy, half, mask, road.type === 'avenue' ? COLORS.asphalt : COLORS.asphaltDark);

    drawMarkings(ctx, cx, cy, half, mask, road.type);
}

/** Fills the tile centre plus an arm toward every connected neighbour. */
function paintCross(ctx, cx, cy, half, mask, color) {
    ctx.fillStyle = color;
    ctx.fillRect(cx - half, cy - half, half * 2, half * 2);
    const reach = TILE_SIZE / 2;
    if (mask & DIR.N) ctx.fillRect(cx - half, cy - reach, half * 2, reach);
    if (mask & DIR.S) ctx.fillRect(cx - half, cy, half * 2, reach);
    if (mask & DIR.W) ctx.fillRect(cx - reach, cy - half, reach, half * 2);
    if (mask & DIR.E) ctx.fillRect(cx, cy - half, reach, half * 2);
    // Dead ends get their cap rounded off so they don't look chopped.
    const arms = countArms(mask);
    if (arms <= 1) {
        ctx.beginPath();
        ctx.arc(cx, cy, half, 0, Math.PI * 2);
        ctx.fill();
    }
}

function countArms(mask) {
    return ((mask & DIR.N) ? 1 : 0) + ((mask & DIR.E) ? 1 : 0) +
           ((mask & DIR.S) ? 1 : 0) + ((mask & DIR.W) ? 1 : 0);
}

function drawMarkings(ctx, cx, cy, half, mask, type) {
    const arms = countArms(mask);
    const reach = TILE_SIZE / 2;

    // Junctions have no centre line — just stop lines on each approach.
    if (arms >= 3) {
        ctx.strokeStyle = 'rgba(232, 232, 220, 0.55)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (mask & DIR.N) { ctx.moveTo(cx - half, cy - half); ctx.lineTo(cx + half, cy - half); }
        if (mask & DIR.S) { ctx.moveTo(cx - half, cy + half); ctx.lineTo(cx + half, cy + half); }
        if (mask & DIR.W) { ctx.moveTo(cx - half, cy - half); ctx.lineTo(cx - half, cy + half); }
        if (mask & DIR.E) { ctx.moveTo(cx + half, cy - half); ctx.lineTo(cx + half, cy + half); }
        ctx.stroke();
        return;
    }

    ctx.strokeStyle = type === 'avenue' ? COLORS.laneDash : COLORS.laneLine;
    ctx.lineWidth = type === 'avenue' ? 1.8 : 1.2;
    ctx.setLineDash(type === 'avenue' ? [] : [5, 5]);
    ctx.beginPath();
    if (mask & DIR.N) { ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - reach); }
    if (mask & DIR.S) { ctx.moveTo(cx, cy); ctx.lineTo(cx, cy + reach); }
    if (mask & DIR.W) { ctx.moveTo(cx, cy); ctx.lineTo(cx - reach, cy); }
    if (mask & DIR.E) { ctx.moveTo(cx, cy); ctx.lineTo(cx + reach, cy); }
    ctx.stroke();
    ctx.setLineDash([]);

    // Avenues get an extra outer lane line each side of the median.
    if (type === 'avenue' && arms === 2) {
        ctx.strokeStyle = 'rgba(235, 235, 225, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        if ((mask & DIR.N) && (mask & DIR.S)) {
            ctx.moveTo(cx - half * 0.55, cy - reach); ctx.lineTo(cx - half * 0.55, cy + reach);
            ctx.moveTo(cx + half * 0.55, cy - reach); ctx.lineTo(cx + half * 0.55, cy + reach);
        } else if ((mask & DIR.E) && (mask & DIR.W)) {
            ctx.moveTo(cx - reach, cy - half * 0.55); ctx.lineTo(cx + reach, cy - half * 0.55);
            ctx.moveTo(cx - reach, cy + half * 0.55); ctx.lineTo(cx + reach, cy + half * 0.55);
        }
        ctx.stroke();
    }
}
