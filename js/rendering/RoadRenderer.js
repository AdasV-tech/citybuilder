// js/rendering/RoadRenderer.js
// Draws road tiles as asphalt squares with lane markings that follow the
// tile's connection bitmask, so straight runs, corners, T-junctions and
// crossroads all read correctly without needing dozens of sprite variants.

import { TILE_SIZE, COLORS } from '../utils/Constants.js';
import { DIR } from '../traffic/RoadNetwork.js';

export function drawRoads(ctx, cityMap, bounds) {
    for (let y = bounds.minY; y <= bounds.maxY; y++) {
        for (let x = bounds.minX; x <= bounds.maxX; x++) {
            const tile = cityMap.getTile(x, y);
            if (!tile || !tile.road) continue;
            drawRoadTile(ctx, x * TILE_SIZE, y * TILE_SIZE, tile.road.connections);
        }
    }
}

function drawRoadTile(ctx, px, py, mask) {
    ctx.fillStyle = COLORS.road;
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

    // faint edge so isolated road tiles / dead ends still read as pavement
    ctx.strokeStyle = COLORS.roadEdge;
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);

    const cx = px + TILE_SIZE / 2, cy = py + TILE_SIZE / 2;
    ctx.strokeStyle = COLORS.roadLine;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);

    const hasN = mask & DIR.N, hasE = mask & DIR.E, hasS = mask & DIR.S, hasW = mask & DIR.W;
    const connectionCount = [hasN, hasE, hasS, hasW].filter(Boolean).length;

    ctx.beginPath();
    {
        // draw a line stub from center toward each connected side (handles straight + curves + ends + junctions)
        if (hasN) { ctx.moveTo(cx, cy); ctx.lineTo(cx, py); }
        if (hasS) { ctx.moveTo(cx, cy); ctx.lineTo(cx, py + TILE_SIZE); }
        if (hasE) { ctx.moveTo(cx, cy); ctx.lineTo(px + TILE_SIZE, cy); }
        if (hasW) { ctx.moveTo(cx, cy); ctx.lineTo(px, cy); }
        if (connectionCount === 0) {
            // isolated road stub: little cross so it's visible
            ctx.moveTo(cx - 5, cy); ctx.lineTo(cx + 5, cy);
        }
    }
    ctx.stroke();
    ctx.setLineDash([]);
}
