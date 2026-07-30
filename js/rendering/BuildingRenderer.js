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

export function drawBuildings(ctx, cityMap, bounds, infrastructure) {
    for (let y = bounds.minY; y <= bounds.maxY; y++) {
        for (let x = bounds.minX; x <= bounds.maxX; x++) {
            const tile = cityMap.getTile(x, y);
            if (!tile || !tile.building) continue;
            drawBuilding(ctx, x * TILE_SIZE, y * TILE_SIZE, tile.building, infrastructure);
        }
    }
}

function drawBuilding(ctx, px, py, building, infrastructure) {
    const pad = 3;
    const size = TILE_SIZE - pad * 2;
    const heightBoost = (building.level - 1) * 4;
    const baseColor = BUILDING_COLOR[building.zoneType];
    const bodyHeight = size + heightBoost;
    const bodyTop = py + pad - heightBoost;
    const bodyLeft = px + pad;

    ctx.save();
    // shadow and foundation base depth
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(bodyLeft + 2, bodyTop + 2, size, bodyHeight);

    // building body
    ctx.fillStyle = baseColor;
    ctx.fillRect(bodyLeft, bodyTop, size, bodyHeight);
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bodyLeft + 0.5, bodyTop + 0.5, size - 1, bodyHeight - 1);

    // roof and type-specific details
    switch (building.zoneType) {
        case 'residential':
            drawResidential(ctx, bodyLeft, bodyTop, size, bodyHeight, building);
            break;
        case 'commercial':
            drawCommercial(ctx, bodyLeft, bodyTop, size, bodyHeight, building);
            break;
        case 'industrial':
            drawIndustrial(ctx, bodyLeft, bodyTop, size, bodyHeight, building);
            break;
    }

    // service warning badge
    if (infrastructure && infrastructure.getServiceAccessFactor(building.x, building.y) < 1) {
        ctx.fillStyle = 'rgba(224, 87, 77, 0.95)';
        ctx.beginPath();
        ctx.arc(bodyLeft + size - 4, bodyTop + 6, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 7px sans-serif';
        ctx.fillText('!', bodyLeft + size - 5.5, bodyTop + 9);
    }
    ctx.restore();
}

function drawResidential(ctx, x, y, size, height, building) {
    const roofHeight = 10;
    ctx.fillStyle = 'rgba(240, 200, 160, 0.95)';
    ctx.beginPath();
    ctx.moveTo(x - 2, y + roofHeight);
    ctx.lineTo(x + size / 2, y - 4);
    ctx.lineTo(x + size + 2, y + roofHeight);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.16)';
    ctx.stroke();

    const doorWidth = 6;
    const doorHeight = 9;
    ctx.fillStyle = '#623b1d';
    ctx.fillRect(x + size / 2 - doorWidth / 2, y + height - doorHeight - 3, doorWidth, doorHeight);

    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    const windows = 2 + building.level;
    for (let i = 0; i < windows; i++) {
        const wx = x + 5 + (i % 2) * 12;
        const wy = y + 10 + Math.floor(i / 2) * 10;
        ctx.fillRect(wx, wy, 6, 6);
    }
}

function drawCommercial(ctx, x, y, size, height, building) {
    const rows = 2 + building.level;
    const cols = 3;
    const windowWidth = 6;
    const windowHeight = 5;
    const gapX = (size - cols * windowWidth) / (cols + 1);
    const gapY = 8;

    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const wx = x + gapX + col * (windowWidth + gapX);
            const wy = y + 12 + row * (windowHeight + gapY);
            ctx.fillRect(wx, wy, windowWidth, windowHeight);
        }
    }

    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillRect(x + 4, y + height - 14, size - 8, 8);
    ctx.fillStyle = 'rgba(60,120,210,0.98)';
    ctx.font = 'bold 8px sans-serif';
    ctx.fillText('OFFICE', x + 6, y + height - 8);
}

function drawIndustrial(ctx, x, y, size, height, building) {
    ctx.fillStyle = 'rgba(200,180,120,0.95)';
    ctx.fillRect(x + 4, y + height - 18, size - 8, 12);
    ctx.fillStyle = 'rgba(100,100,90,0.95)';
    ctx.fillRect(x + size - 10, y + height - 34 - building.level * 2, 6, 20 + building.level * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    for (let i = 0; i < 3; i++) {
        ctx.fillRect(x + 8 + i * 10, y + height - 14, 6, 6);
    }
    ctx.fillStyle = 'rgba(140,120,80,0.95)';
    ctx.fillRect(x + 8, y + height - 24, 12, 4);
}
