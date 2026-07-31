// js/rendering/OverlayRenderer.js
// Everything painted *over* the city: the data views (land value, pollution,
// coverage, power, water, traffic, happiness), the tool preview, coverage
// radius rings and the current selection.

import { TILE_SIZE, COLORS, OVERLAY_RAMPS } from '../utils/Constants.js';
import { sampleRamp } from '../utils/MathUtils.js';
import { INFO_VIEWS } from '../data/Toolbox.js';

const VIEW_BY_ID = new Map(INFO_VIEWS.map(v => [v.id, v]));

const POLLUTION_HAZE_THRESHOLD = 0.18;

/**
 * Faint smog hanging over polluted ground, always visible (not just while the
 * Pollution data view is toggled on) so industrial districts read as dirty at
 * a glance, the way parks read as green. Reuses the same simulated pollution
 * field the data view samples, so the haze always sits exactly where industry
 * (and busy roads) actually put it.
 */
export function drawPollutionHaze(ctx, fields, bounds, mapWidth) {
    const pollution = fields.pollution;
    ctx.save();
    for (let y = bounds.minY; y <= bounds.maxY; y++) {
        for (let x = bounds.minX; x <= bounds.maxX; x++) {
            const value = pollution[y * mapWidth + x];
            if (value < POLLUTION_HAZE_THRESHOLD) continue;
            ctx.globalAlpha = Math.min(0.5, (value - POLLUTION_HAZE_THRESHOLD) * 0.75);
            ctx.fillStyle = '#57503c';
            ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
    }
    ctx.restore();
}

/** Paints the active data view across the visible tiles. */
export function drawDataView(ctx, viewId, state, bounds) {
    if (!viewId || viewId === 'none') return;
    const view = VIEW_BY_ID.get(viewId);
    if (!view) return;

    const { cityMap, fields } = state;
    const ramp = OVERLAY_RAMPS[viewId] ?? OVERLAY_RAMPS.landvalue;
    const width = cityMap.width;

    ctx.save();
    ctx.globalAlpha = 0.62;

    for (let y = bounds.minY; y <= bounds.maxY; y++) {
        for (let x = bounds.minX; x <= bounds.maxX; x++) {
            const i = y * width + x;
            const tile = cityMap.tiles[i];
            if (!tile || tile.isWater) continue;

            let value = null;
            if (view.field) {
                value = fields[view.field][i];
                if (value <= 0.001) continue;
            } else if (viewId === 'power') {
                if (!tile.conductsPower) continue;
                value = tile.powered ? 1 : 0;
                ctx.fillStyle = tile.powered ? COLORS.power : COLORS.bad;
                ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                continue;
            } else if (viewId === 'water') {
                if (!tile.conductsWater) continue;
                ctx.fillStyle = tile.watered ? COLORS.waterLine : COLORS.bad;
                ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                continue;
            } else if (viewId === 'traffic') {
                if (!tile.road) continue;
                value = tile.road.congestion;
            } else if (viewId === 'happiness') {
                if (!tile.building || tile.building.abandoned) continue;
                value = tile.building.happiness;
            }
            if (value === null) continue;

            ctx.fillStyle = sampleRamp(ramp, value);
            ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
    }
    ctx.restore();
}

/** Tool preview: green where the action is legal, red where it isn't. */
export function drawPreview(ctx, preview) {
    if (!preview || preview.tiles.length === 0) return;

    ctx.save();
    for (const tile of preview.tiles) {
        const px = tile.x * TILE_SIZE, py = tile.y * TILE_SIZE;
        ctx.fillStyle = tile.valid ? 'rgba(120, 226, 140, 0.35)' : 'rgba(226, 88, 77, 0.42)';
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        ctx.strokeStyle = tile.valid ? 'rgba(190, 255, 200, 0.85)' : 'rgba(255, 150, 140, 0.85)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(px + 0.75, py + 0.75, TILE_SIZE - 1.5, TILE_SIZE - 1.5);
    }

    // Footprint outline + coverage ring for service placement.
    if (preview.footprint) {
        const { x, y, size, radius, valid } = preview.footprint;
        ctx.strokeStyle = valid ? 'rgba(190, 255, 200, 0.95)' : 'rgba(255, 150, 140, 0.95)';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(x * TILE_SIZE, y * TILE_SIZE, size * TILE_SIZE, size * TILE_SIZE);
        if (radius) {
            ctx.strokeStyle = 'rgba(255,255,255,0.35)';
            ctx.lineWidth = 2;
            ctx.setLineDash([8, 6]);
            ctx.beginPath();
            ctx.arc((x + size / 2) * TILE_SIZE, (y + size / 2) * TILE_SIZE, radius * TILE_SIZE, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }
    ctx.restore();
}

/** Hover cursor when no drag is in progress. */
export function drawHover(ctx, hover, cityMap) {
    if (!hover || !cityMap.inBounds(hover.x, hover.y)) return;
    const px = hover.x * TILE_SIZE, py = hover.y * TILE_SIZE;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(px + 0.75, py + 0.75, TILE_SIZE - 1.5, TILE_SIZE - 1.5);
    ctx.restore();
}

/** Ring + pulse around whatever the player has selected. */
export function drawSelection(ctx, selection, timeMs) {
    if (!selection) return;
    const size = (selection.size ?? 1) * TILE_SIZE;
    const px = selection.x * TILE_SIZE, py = selection.y * TILE_SIZE;
    const pulse = 0.5 + Math.sin(timeMs / 260) * 0.25;

    ctx.save();
    ctx.strokeStyle = `rgba(255, 236, 150, ${0.55 + pulse * 0.4})`;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(px - 2, py - 2, size + 4, size + 4);

    if (selection.radius) {
        ctx.strokeStyle = 'rgba(255, 236, 150, 0.32)';
        ctx.lineWidth = 2;
        ctx.setLineDash([9, 7]);
        ctx.beginPath();
        ctx.arc(px + size / 2, py + size / 2, selection.radius * TILE_SIZE, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
    }
    ctx.restore();
}
