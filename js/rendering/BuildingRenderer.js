// js/rendering/BuildingRenderer.js
// Draws zone tint overlays (with a growth progress indicator) and the simple
// geometric buildings that spawn on them once grown.

import { TILE_SIZE, COLORS, GROWTH_TIME_MS } from '../utils/Constants.js';

const ZONE_COLOR = {
    residential: COLORS.zoneResidential,
    commercial: COLORS.zoneCommercial,
    industrial: COLORS.zoneIndustrial
};

const BUILDING_COLOR = {
    residential: COLORS.buildingResidential,
    commercial: COLORS.buildingCommercial,
    industrial: COLORS.buildingIndustrial
};

export function drawZones(ctx, cityMap, bounds) {
    for (let y = bounds.minY; y <= bounds.maxY; y++) {
        for (let x = bounds.minX; x <= bounds.maxX; x++) {
            const tile = cityMap.getTile(x, y);
            if (!tile || !tile.zoneType || tile.building) continue;
            const px = x * TILE_SIZE, py = y * TILE_SIZE;
            ctx.fillStyle = ZONE_COLOR[tile.zoneType];
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

            // growth progress bar along the bottom edge
            const progress = Math.min(1, tile.growthTimer / GROWTH_TIME_MS);
            if (progress > 0) {
                ctx.fillStyle = 'rgba(255,255,255,0.85)';
                ctx.fillRect(px + 3, py + TILE_SIZE - 5, (TILE_SIZE - 6) * progress, 2.5);
            }
        }
    }
}

export function drawBuildings(ctx, cityMap, bounds) {
    for (let y = bounds.minY; y <= bounds.maxY; y++) {
        for (let x = bounds.minX; x <= bounds.maxX; x++) {
            const tile = cityMap.getTile(x, y);
            if (!tile || !tile.building) continue;
            drawBuilding(ctx, x * TILE_SIZE, y * TILE_SIZE, tile.building);
        }
    }
}

function drawBuilding(ctx, px, py, building) {
    const pad = 3;
    const size = TILE_SIZE - pad * 2;
    const heightBoost = (building.level - 1) * 3; // taller with each level, purely visual
    const baseColor = BUILDING_COLOR[building.zoneType];

    ctx.save();
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(px + pad + 2, py + pad + 2, size, size);

    // body
    ctx.fillStyle = baseColor;
    ctx.fillRect(px + pad, py + pad - heightBoost, size, size + heightBoost);

    // roof cap
    ctx.fillStyle = COLORS.buildingRoof;
    ctx.fillRect(px + pad, py + pad - heightBoost, size, 4);

    // occupancy ratio as a small window grid intensity (purely decorative)
    const ratio = building.capacity > 0 ? building.occupancy / building.capacity : 0;
    ctx.fillStyle = `rgba(255, 240, 180, ${0.25 + ratio * 0.5})`;
    const dots = building.level + 1;
    for (let i = 0; i < dots; i++) {
        const wx = px + pad + 4 + i * ((size - 8) / Math.max(1, dots - 1 || 1));
        ctx.fillRect(wx, py + pad - heightBoost + size * 0.4, 2, 2);
    }
    ctx.restore();
}
